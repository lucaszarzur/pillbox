// Cliente das APIs públicas VTEX (as mesmas que o site da loja usa).
// Usado pela cotação automática: busca de produto e simulação de carrinho com CEP.

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; Pillbox/1.0)",
  Accept: "application/json",
  "Content-Type": "application/json",
}
const TIMEOUT_MS = 20_000

export interface VtexCandidate {
  sku: string
  seller: string
  productName: string
  itemName: string
  url: string
  imageUrl: string | null
  price: number
  listPrice: number
  available: boolean
}

export interface VtexSla {
  name: string
  price: number
  estimate: string
  pickup: boolean
}

export interface VtexSimulation {
  // total pago pelos itens (já com promoções de quantidade)
  subtotal: number
  available: boolean
  // quantidade que a loja aceitou por SKU (ela pode limitar o máximo por pedido)
  quantities: Record<string, number>
  // opções de entrega que atendem todos os itens, da mais barata para a mais cara
  delivery: VtexSla[]
  pickup: VtexSla[]
}

async function vtexFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new Error(`VTEX ${res.status} em ${new URL(url).host}`)
  return res.json()
}

export async function vtexSearch(host: string, term: string, limit = 30): Promise<VtexCandidate[]> {
  const url = `https://${host}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(term)}&_from=0&_to=${limit - 1}`
  const products = (await vtexFetch(url)) as Array<{
    productName: string
    linkText: string
    items: Array<{
      itemId: string
      name: string
      images?: Array<{ imageUrl: string }>
      sellers: Array<{ sellerId: string; commertialOffer: { Price: number; ListPrice: number; AvailableQuantity: number } }>
    }>
  }>
  const out: VtexCandidate[] = []
  for (const p of products) {
    for (const item of p.items) {
      for (const s of item.sellers) {
        const o = s.commertialOffer
        if (!o?.Price) continue
        out.push({
          sku: item.itemId,
          seller: s.sellerId,
          productName: p.productName,
          itemName: item.name,
          url: `https://${host}/${p.linkText}/p`,
          imageUrl: item.images?.[0]?.imageUrl ?? null,
          price: o.Price,
          listPrice: o.ListPrice,
          available: o.AvailableQuantity > 0,
        })
      }
    }
  }
  return out
}

/** Prazo VTEX ("1bd", "2d", "90m", "2h") em dias úteis aproximados. */
export function estimateDays(estimate: string): number {
  const m = /^(\d+)(bd|d|h|m)$/.exec(estimate)
  if (!m) return 99
  const n = Number(m[1])
  return m[2] === "bd" || m[2] === "d" ? n : 0
}

export async function vtexSimulate(
  host: string,
  postalCode: string,
  items: { sku: string; seller: string; quantity: number }[]
): Promise<VtexSimulation> {
  const body = {
    items: items.map((i) => ({ id: i.sku, seller: i.seller, quantity: i.quantity })),
    postalCode: postalCode.replace(/\D/g, ""),
    country: "BRA",
  }
  const data = (await vtexFetch(`https://${host}/api/checkout/pub/orderForms/simulation?sc=1`, {
    method: "POST",
    body: JSON.stringify(body),
  })) as {
    items: Array<{ id: string; sellingPrice?: number; quantity: number; availability?: string }>
    logisticsInfo: Array<{
      itemIndex: number
      slas: Array<{ name: string; price: number; shippingEstimate: string; deliveryChannel?: string }>
    }>
  }

  const subtotal = data.items.reduce((s, i) => s + ((i.sellingPrice ?? 0) * i.quantity) / 100, 0)
  const available = data.items.length > 0 && data.items.every((i) => !i.availability || i.availability === "available")
  const quantities: Record<string, number> = {}
  for (const i of data.items) quantities[i.id] = (quantities[i.id] ?? 0) + i.quantity

  // A VTEX devolve as opções por item; uma opção vale para o pedido se atende todos os itens
  const slas = new Map<string, { sla: VtexSla; count: number }>()
  const itemIndexes = new Set(data.logisticsInfo.map((l) => l.itemIndex))
  for (const li of data.logisticsInfo) {
    for (const s of li.slas) {
      const pickup = s.deliveryChannel === "pickup-in-point"
      const key = `${s.name}:${pickup}`
      const e = slas.get(key) ?? { sla: { name: s.name, price: 0, estimate: s.shippingEstimate, pickup }, count: 0 }
      e.sla.price += s.price / 100
      e.count += 1
      slas.set(key, e)
    }
  }
  const full = [...slas.values()].filter((e) => e.count === itemIndexes.size).map((e) => ({ ...e.sla, price: Math.round(e.sla.price * 100) / 100 }))
  const byPrice = (a: VtexSla, b: VtexSla) => a.price - b.price || estimateDays(a.estimate) - estimateDays(b.estimate)
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    available,
    quantities,
    delivery: full.filter((s) => !s.pickup).sort(byPrice),
    pickup: full.filter((s) => s.pickup).sort(byPrice),
  }
}

/** Executa tarefas com no máximo `limit` em paralelo. */
export async function mapLimit<T, R>(list: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const i = next++
      out[i] = await fn(list[i])
    }
  })
  await Promise.all(workers)
  return out
}

// Comparador "Melhor compra": dado o que precisa comprar e as ofertas de cada farmácia,
// encontra a divisão de pedidos mais barata considerando frete, frete grátis e retirada.

export interface OptPharmacy {
  id: string
  name: string
  shippingCost: number | null
  freeShippingMin: number | null
  deliveryDays: number | null
  pickupAvailable: boolean
  pickupNotes: string | null
  vtex?: boolean // tem cotação automática (dá para conferir no carrinho)
}

export interface OptOffer {
  pharmacyId: string
  presentationId: string
  unitPrice: number
  quantityTotals?: Record<string, number> | null
  kitPrice?: number | null
  kitQuantity?: number | null
  shippingEstimate?: number | null
  inStock: boolean | null
  notes?: string | null
  quotedAt: string
}

export interface OptNeed {
  presentationId: string
  name: string
  quantity: number
}

export interface OrderLine {
  presentationId: string
  name: string
  quantity: number
  unitsBought: number
  total: number
  offer: OptOffer
}

export interface Order {
  pharmacy: OptPharmacy
  lines: OrderLine[]
  subtotal: number
  shipping: number
  mode: "delivery" | "pickup"
}

export interface Plan {
  total: number
  orders: Order[]
}

export interface OptResult {
  delivery: Plan[]
  withPickup: Plan[]
  singleOrder: Plan[]
  missing: OptNeed[]
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Custo de levar `q` caixas, respeitando kit e promoções por quantidade. */
export function lineCost(offer: OptOffer, q: number): { total: number; units: number } {
  if (q <= 0) return { total: 0, units: 0 }
  if (offer.kitPrice && offer.kitQuantity && offer.kitQuantity > 1) {
    const packs = Math.ceil(q / offer.kitQuantity)
    return { total: round2(packs * offer.kitPrice), units: packs * offer.kitQuantity }
  }
  const tiers = offer.quantityTotals ?? {}
  const keys = Object.keys(tiers).map(Number).filter((k) => k > 0 && Number.isFinite(tiers[k]))
  const tier = (n: number): number => {
    if (n <= 0) return 0
    if (tiers[n] !== undefined) return tiers[n]
    const maxK = keys.length ? Math.max(...keys) : 0
    // Acima da maior faixa conhecida, repete o "pacote" promocional
    if (maxK > 1 && n > maxK) return Math.floor(n / maxK) * tiers[maxK] + tier(n % maxK)
    return n * offer.unitPrice
  }
  return { total: round2(tier(q)), units: q }
}

function orderShipping(
  pharmacy: OptPharmacy,
  subtotal: number,
  lines: OrderLine[],
  allowPickup: boolean
): { cost: number; mode: "delivery" | "pickup" } | null {
  const estimates = lines.map((l) => l.offer.shippingEstimate).filter((v): v is number => v !== null && v !== undefined)
  return shippingFor(pharmacy, subtotal, estimates, allowPickup)
}

/**
 * Frete do pedido. Sem frete padrão na farmácia, usa o maior frete informado nos itens da cotação.
 * Item com frete maior que o padrão (vendedor parceiro, envio de outro estado) é cobrado à parte
 * e não entra no frete grátis.
 */
function shippingFor(
  pharmacy: OptPharmacy,
  subtotal: number,
  estimates: number[],
  allowPickup: boolean
): { cost: number; mode: "delivery" | "pickup" } | null {
  const base = pharmacy.shippingCost
  let delivery: number | null = base ?? (estimates.length ? Math.max(...estimates) : null)
  if (delivery !== null && pharmacy.freeShippingMin !== null && subtotal >= pharmacy.freeShippingMin) delivery = 0
  if (delivery !== null && base !== null) {
    // Margem para não confundir pequena variação de frete entre itens com envio separado
    delivery += estimates.filter((e) => e > base * 1.5 + 1).reduce((sum, e) => sum + e, 0)
  }

  const pickup = allowPickup && pharmacy.pickupAvailable ? 0 : null
  if (delivery === null && pickup === null) return null
  // Em empate, prefere entrega (não precisa sair de casa)
  if (delivery !== null && (pickup === null || delivery <= pickup)) return { cost: delivery, mode: "delivery" }
  return { cost: 0, mode: "pickup" }
}

interface Ctx {
  needs: OptNeed[]
  options: OptOffer[][] // ofertas válidas por item (mesma ordem de needs)
  pharmacies: Map<string, OptPharmacy>
}

function evaluate(ctx: Ctx, choice: number[], allowPickup: boolean): Plan | null {
  const groups = new Map<string, OrderLine[]>()
  ctx.needs.forEach((need, i) => {
    const offer = ctx.options[i][choice[i]]
    const { total, units } = lineCost(offer, need.quantity)
    const line: OrderLine = { presentationId: need.presentationId, name: need.name, quantity: need.quantity, unitsBought: units, total, offer }
    const list = groups.get(offer.pharmacyId) ?? []
    list.push(line)
    groups.set(offer.pharmacyId, list)
  })
  const orders: Order[] = []
  let total = 0
  for (const [pharmacyId, lines] of groups) {
    const pharmacy = ctx.pharmacies.get(pharmacyId)
    if (!pharmacy) return null
    const subtotal = round2(lines.reduce((s, l) => s + l.total, 0))
    const ship = orderShipping(pharmacy, subtotal, lines, allowPickup)
    if (!ship) return null
    orders.push({ pharmacy, lines, subtotal, shipping: ship.cost, mode: ship.mode })
    total += subtotal + ship.cost
  }
  orders.sort((a, b) => b.subtotal - a.subtotal)
  return { total: round2(total), orders }
}

const planKey = (p: Plan) =>
  p.orders.map((o) => `${o.pharmacy.id}:${o.mode}:${o.lines.map((l) => l.presentationId).sort().join(",")}`).sort().join("|")

function keepTop(plans: Plan[], limit: number): Plan[] {
  const seen = new Set<string>()
  return plans
    .sort((a, b) => a.total - b.total || a.orders.length - b.orders.length)
    .filter((p) => {
      const k = planKey(p)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, limit)
}

const EXACT_LIMIT = 2_000_000

/** Busca exata com somas incrementais e poda: descarta ramos que já não entram no top. */
function searchExact(ctx: Ctx, allowPickup: boolean, limit: number): number[][] {
  const n = ctx.needs.length
  const storeIds = [...new Set(ctx.options.flat().map((o) => o.pharmacyId))]
  const storeIndex = new Map(storeIds.map((id, i) => [id, i]))
  const stores = storeIds.map((id) => ctx.pharmacies.get(id)!)
  const cost = ctx.options.map((opts, i) => opts.map((o) => lineCost(o, ctx.needs[i].quantity).total))
  const store = ctx.options.map((opts) => opts.map((o) => storeIndex.get(o.pharmacyId)!))
  const estimate = ctx.options.map((opts) => opts.map((o) => o.shippingEstimate ?? null))
  // menor custo possível dos itens restantes (frete ≥ 0), usado como limite inferior
  const minRest = new Array(n + 1).fill(0)
  for (let i = n - 1; i >= 0; i--) minRest[i] = minRest[i + 1] + Math.min(...cost[i])

  const sub = new Float64Array(stores.length)
  const count = new Int32Array(stores.length)
  const maxEst: (number | null)[][] = stores.map(() => [])
  const choice = new Array(n).fill(0)
  const top: { total: number; choice: number[] }[] = []
  let partial = 0

  const leaf = () => {
    let total = 0
    for (let s = 0; s < stores.length; s++) {
      if (!count[s]) continue
      const ests = maxEst[s].filter((v): v is number => v !== null)
      const ship = shippingFor(stores[s], Math.round(sub[s] * 100) / 100, ests, allowPickup)
      if (!ship) return
      // Desempate: com o mesmo total, prefere menos pedidos e menos retiradas
      total += sub[s] + ship.cost + 1e-6 + (ship.mode === "pickup" ? 1e-7 : 0)
    }
    if (top.length === limit && total >= top[top.length - 1].total) return
    top.push({ total, choice: [...choice] })
    top.sort((a, b) => a.total - b.total)
    if (top.length > limit) top.pop()
  }

  const walk = (i: number) => {
    if (i === n) return leaf()
    if (top.length === limit && partial + minRest[i] >= top[top.length - 1].total) return
    for (let k = 0; k < cost[i].length; k++) {
      const s = store[i][k]
      choice[i] = k
      sub[s] += cost[i][k]
      count[s]++
      maxEst[s].push(estimate[i][k])
      partial += cost[i][k]
      walk(i + 1)
      partial -= cost[i][k]
      maxEst[s].pop()
      count[s]--
      sub[s] -= cost[i][k]
    }
  }
  walk(0)
  return top.map((t) => t.choice)
}

function search(ctx: Ctx, allowPickup: boolean, limit: number): Plan[] {
  const n = ctx.needs.length
  if (!n) return []
  const space = ctx.options.reduce((acc, o) => acc * o.length, 1)
  const found: Plan[] = []

  if (space <= EXACT_LIMIT) {
    for (const choice of searchExact(ctx, allowPickup, limit)) {
      const plan = evaluate(ctx, choice, allowPickup)
      if (plan) found.push(plan)
    }
    return keepTop(found, limit)
  }

  // Muitas combinações: parte do mais barato por item e melhora movendo um item por vez
  const start = ctx.options.map((opts) => opts.reduce((best, o, k) => (o.unitPrice < opts[best].unitPrice ? k : best), 0))
  const climb = (choice: number[]) => {
    let current = evaluate(ctx, choice, allowPickup)
    let improved = true
    while (improved && current) {
      improved = false
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < ctx.options[i].length; k++) {
          if (k === choice[i]) continue
          const next = [...choice]
          next[i] = k
          const plan = evaluate(ctx, next, allowPickup)
          if (plan) found.push(plan)
          if (plan && current && plan.total < current.total - 0.001) {
            choice = next
            current = plan
            improved = true
          }
        }
      }
    }
    if (current) found.push(current)
  }
  climb(start)
  // Também tenta concentrar tudo em cada farmácia como ponto de partida
  for (const ph of ctx.pharmacies.keys()) {
    const choice = ctx.options.map((opts, i) => {
      const k = opts.findIndex((o) => o.pharmacyId === ph)
      return k >= 0 ? k : start[i]
    })
    climb(choice)
  }
  return keepTop(found, limit)
}

export function optimizePurchase(needs: OptNeed[], offers: OptOffer[], pharmacies: OptPharmacy[], limit = 5): OptResult {
  const pharmacyMap = new Map(pharmacies.map((p) => [p.id, p]))
  const active = needs.filter((n) => n.quantity > 0)
  const valid = (o: OptOffer) => o.inStock !== false && o.unitPrice > 0 && pharmacyMap.has(o.pharmacyId)

  const missing: OptNeed[] = []
  const withOffers: OptNeed[] = []
  const options: OptOffer[][] = []
  for (const need of active) {
    const opts = offers.filter((o) => o.presentationId === need.presentationId && valid(o))
    if (opts.length) {
      withOffers.push(need)
      options.push(opts)
    } else {
      missing.push(need)
    }
  }
  const ctx: Ctx = { needs: withOffers, options, pharmacies: pharmacyMap }

  const singleOrder: Plan[] = []
  for (const ph of pharmacies) {
    const choice = options.map((opts) => opts.findIndex((o) => o.pharmacyId === ph.id))
    if (!choice.length || choice.some((k) => k < 0)) continue
    const plan = evaluate(ctx, choice, false) ?? evaluate(ctx, choice, true)
    if (plan) singleOrder.push(plan)
  }

  return {
    delivery: search(ctx, false, limit),
    withPickup: search(ctx, true, limit),
    singleOrder: keepTop(singleOrder, limit),
    missing,
  }
}

/** Caixas necessárias para cobrir `days` dias, descontando o estoque atual. */
export function suggestPackages(params: {
  current: number
  dailyConsumption: number
  unitsPerPackage: number
  days: number
}): number {
  const { current, dailyConsumption, unitsPerPackage, days } = params
  if (dailyConsumption <= 0 || unitsPerPackage <= 0) return 0
  const needed = days * dailyConsumption - current
  return needed > 0 ? Math.ceil(needed / unitsPerPackage) : 0
}

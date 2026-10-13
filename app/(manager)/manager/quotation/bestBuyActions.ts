"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma/client"
import { auth } from "@/auth"
import { calcCurrentStock } from "@/lib/stockCalc"
import type { OptOffer } from "@/lib/purchaseOptimizer"
import { estimateDays, mapLimit, vtexSearch, vtexSimulate, type VtexCandidate } from "@/lib/vtex"
import { defaultSearchTerm, scoreCandidate } from "@/lib/productMatch"

const POSTAL_CODE_KEY = "postalCode"
const LOCAL_DELIVERY_MAX_DAYS = 2

async function requireManager() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "MANAGER") throw new Error("Unauthorized")
  return session.user.id
}

async function getPostalCode() {
  const row = await prisma.appSetting.findUnique({ where: { key: POSTAL_CODE_KEY } })
  return row?.value ?? ""
}

function activePresentations() {
  return prisma.medicationPresentation.findMany({
    where: { isPreferred: true, medication: { isActive: true, supplySource: "PURCHASE" } },
    include: {
      medication: { select: { name: true, category: true } },
      stock: true,
      consumptionRules: { where: { validUntil: null }, orderBy: { validFrom: "desc" }, take: 1 },
    },
    orderBy: { medication: { name: "asc" } },
  })
}

const presentationLabel = (p: { dosage: string | null; medication: { name: string } }) => {
  const dosage = p.dosage?.trim() ?? ""
  // Evita "Viofta 0,15% 0,15%" quando o nome já traz a dose
  return dosage && !p.medication.name.toLowerCase().includes(dosage.toLowerCase()) ? `${p.medication.name} ${dosage}` : p.medication.name
}

// ─────────────────────────────────────────────
// Melhor compra
// ─────────────────────────────────────────────

export async function getBestBuyData(days = 14) {
  await requireManager()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const [pharmacies, presentations, items] = await Promise.all([
    prisma.pharmacy.findMany({ where: { isActive: true }, orderBy: { priority: "asc" } }),
    activePresentations(),
    prisma.quotationItem.findMany({
      where: { quotation: { createdAt: { gte: since } }, pricePerPackage: { not: null } },
      include: { quotation: { select: { createdAt: true } } },
      orderBy: { quotation: { createdAt: "desc" } },
    }),
  ])

  // Fica com o preço mais recente de cada remédio em cada farmácia
  const seen = new Set<string>()
  const offers: OptOffer[] = []
  for (const i of items) {
    const key = `${i.presentationId}:${i.pharmacyId}`
    if (seen.has(key)) continue
    seen.add(key)
    offers.push({
      pharmacyId: i.pharmacyId,
      presentationId: i.presentationId,
      unitPrice: Number(i.pricePerPackage),
      quantityTotals: (i.quantityTotals as Record<string, number> | null) ?? null,
      kitPrice: i.kitPrice === null ? null : Number(i.kitPrice),
      kitQuantity: i.kitQuantity,
      shippingEstimate: i.shippingEstimate === null ? null : Number(i.shippingEstimate),
      inStock: i.inStock,
      notes: i.notes,
      quotedAt: i.quotation.createdAt.toISOString(),
    })
  }

  const needs = presentations.map((p) => {
    const calc = p.stock
      ? calcCurrentStock({
          referenceQuantity: p.stock.referenceQuantity,
          referenceDate: p.stock.referenceDate,
          rule: p.consumptionRules[0] ?? null,
          unitsPerPackage: p.unitsPerPackage,
          daysPerPackage: p.daysPerPackage ?? null,
        })
      : null
    return {
      presentationId: p.id,
      name: presentationLabel(p),
      category: p.medication.category,
      unitsPerPackage: p.unitsPerPackage,
      current: calc?.current ?? 0,
      dailyConsumption: calc?.dailyConsumption ?? 0,
      daysRemaining: calc?.daysRemaining ?? null,
      hasOffers: offers.some((o) => o.presentationId === p.id),
    }
  })

  return JSON.parse(
    JSON.stringify({
      pharmacies: pharmacies.map((p) => ({
        id: p.id,
        name: p.name,
        shippingCost: p.shippingCost === null ? null : Number(p.shippingCost),
        freeShippingMin: p.freeShippingMin === null ? null : Number(p.freeShippingMin),
        deliveryDays: p.deliveryDays,
        pickupAvailable: p.pickupAvailable,
        pickupNotes: p.pickupNotes,
        vtex: !!p.vtexHost,
      })),
      needs,
      offers,
      days,
    })
  ) as {
    pharmacies: {
      id: string
      name: string
      shippingCost: number | null
      freeShippingMin: number | null
      deliveryDays: number | null
      pickupAvailable: boolean
      pickupNotes: string | null
      vtex: boolean
    }[]
    needs: {
      presentationId: string
      name: string
      category: string
      unitsPerPackage: number
      current: number
      dailyConsumption: number
      daysRemaining: number | null
      hasOffers: boolean
    }[]
    offers: {
      pharmacyId: string
      presentationId: string
      unitPrice: number
      quantityTotals: Record<string, number> | null
      kitPrice: number | null
      kitQuantity: number | null
      shippingEstimate: number | null
      inStock: boolean | null
      notes: string | null
      quotedAt: string
    }[]
    days: number
  }
}

/** Confere no carrinho real da loja (VTEX) o subtotal e o frete de um pedido. */
export async function checkOrderInCart(pharmacyId: string, lines: { presentationId: string; quantity: number }[]) {
  await requireManager()
  const postalCode = await getPostalCode()
  if (!postalCode) throw new Error("Cadastre o CEP de entrega em Configurações → Farmácias.")
  const pharmacy = await prisma.pharmacy.findUniqueOrThrow({ where: { id: pharmacyId } })
  if (!pharmacy.vtexHost) throw new Error("Esta farmácia não tem cotação automática.")
  const products = await prisma.pharmacyProduct.findMany({
    where: { pharmacyId, presentationId: { in: lines.map((l) => l.presentationId) } },
  })
  const missing = lines.filter((l) => !products.some((p) => p.presentationId === l.presentationId))
  if (missing.length) throw new Error("Há itens sem produto vinculado nesta farmácia.")
  const items = lines.map((l) => {
    const p = products.find((x) => x.presentationId === l.presentationId)!
    return { sku: p.sku, seller: p.seller, quantity: l.quantity, name: p.productName }
  })
  const sim = await vtexSimulate(pharmacy.vtexHost, postalCode, items)
  const limited = items
    .filter((i) => (sim.quantities[i.sku] ?? 0) < i.quantity)
    .map((i) => ({ name: i.name, asked: i.quantity, accepted: sim.quantities[i.sku] ?? 0 }))
  return {
    limited,
    subtotal: sim.subtotal,
    available: sim.available,
    delivery: sim.delivery[0] ?? null,
    pickup: sim.pickup[0] ?? null,
  }
}

// ─────────────────────────────────────────────
// Cotação automática (VTEX)
// ─────────────────────────────────────────────

export async function getAutoQuoteData() {
  await requireManager()
  const [pharmacies, presentations, products, postalCode] = await Promise.all([
    prisma.pharmacy.findMany({ where: { isActive: true, vtexHost: { not: null } }, orderBy: { priority: "asc" } }),
    activePresentations(),
    prisma.pharmacyProduct.findMany(),
    getPostalCode(),
  ])
  return JSON.parse(
    JSON.stringify({
      postalCode,
      pharmacies: pharmacies.map((p) => ({ id: p.id, name: p.name })),
      presentations: presentations.map((p) => ({ id: p.id, name: presentationLabel(p), searchTerm: defaultSearchTerm(p.medication.name) })),
      products: products.map((p) => ({ presentationId: p.presentationId, pharmacyId: p.pharmacyId, productName: p.productName, url: p.url, sku: p.sku })),
    })
  ) as {
    postalCode: string
    pharmacies: { id: string; name: string }[]
    presentations: { id: string; name: string; searchTerm: string }[]
    products: { presentationId: string; pharmacyId: string; productName: string; url: string; sku: string }[]
  }
}

interface ScoredCandidate extends VtexCandidate {
  score: number
  deliveryDays: number | null
  deliveryPrice: number | null
}

/** Busca produtos de uma apresentação numa loja e indica os que entregam rápido no CEP. */
export async function searchPharmacyProducts(presentationId: string, pharmacyId: string, term?: string) {
  await requireManager()
  const [pres, pharmacy, postalCode] = await Promise.all([
    prisma.medicationPresentation.findUniqueOrThrow({ where: { id: presentationId }, include: { medication: { select: { name: true } } } }),
    prisma.pharmacy.findUniqueOrThrow({ where: { id: pharmacyId } }),
    getPostalCode(),
  ])
  if (!pharmacy.vtexHost) throw new Error("Farmácia sem cotação automática.")
  const host = pharmacy.vtexHost

  const terms = [term?.trim() || defaultSearchTerm(pres.medication.name)]
  const first = terms[0].split(/\s+/)[0]
  if (!term && first !== terms[0]) terms.push(first)

  const raw: VtexCandidate[] = []
  for (const t of terms) {
    raw.push(...(await vtexSearch(host, t)))
    if (raw.some((c) => scoreCandidate(c, pres) > 0)) break
  }
  const unique = [...new Map(raw.filter((c) => c.available && c.seller === "1").map((c) => [c.sku, c])).values()]
  const scored = unique
    .map((c) => ({ ...c, score: scoreCandidate(c, pres) }))
    .sort((a, b) => b.score - a.score || a.price - b.price)

  // Simula entrega dos melhores para separar estoque local de envio de outro estado
  const top = scored.filter((c) => c.score > 0).slice(0, 6)
  const result: ScoredCandidate[] = await mapLimit(top, 3, async (c) => {
    if (!postalCode) return { ...c, deliveryDays: null, deliveryPrice: null }
    try {
      const sim = await vtexSimulate(host, postalCode, [{ sku: c.sku, seller: c.seller, quantity: 1 }])
      const d = sim.delivery[0]
      return { ...c, deliveryDays: d ? estimateDays(d.estimate) : null, deliveryPrice: d?.price ?? null }
    } catch {
      return { ...c, deliveryDays: null, deliveryPrice: null }
    }
  })
  const isLocal = (c: ScoredCandidate) => c.deliveryDays !== null && c.deliveryDays <= LOCAL_DELIVERY_MAX_DAYS
  result.sort((a, b) => b.score - a.score || Number(isLocal(b)) - Number(isLocal(a)) || a.price - b.price)

  const others = scored.filter((c) => c.score <= 0).slice(0, 10).map((c) => ({ ...c, deliveryDays: null, deliveryPrice: null }))
  return { term: terms[0], candidates: [...result, ...others] }
}

export async function savePharmacyProduct(
  presentationId: string,
  pharmacyId: string,
  product: { sku: string; seller: string; productName: string; url: string }
) {
  await requireManager()
  await prisma.pharmacyProduct.upsert({
    where: { presentationId_pharmacyId: { presentationId, pharmacyId } },
    update: product,
    create: { presentationId, pharmacyId, ...product },
  })
  revalidatePath("/manager/quotation")
}

export async function removePharmacyProduct(presentationId: string, pharmacyId: string) {
  await requireManager()
  await prisma.pharmacyProduct.deleteMany({ where: { presentationId, pharmacyId } })
  revalidatePath("/manager/quotation")
}

/** Vincula automaticamente, para cada remédio sem vínculo, o melhor candidato de cada loja. */
export async function autoLinkMissing() {
  await requireManager()
  const data = await getAutoQuoteData()
  const missing = data.presentations.flatMap((p) =>
    data.pharmacies
      .filter((ph) => !data.products.some((x) => x.presentationId === p.id && x.pharmacyId === ph.id))
      .map((ph) => ({ presentationId: p.id, pharmacyId: ph.id }))
  )
  let linked = 0
  await mapLimit(missing, 3, async (m) => {
    try {
      const { candidates } = await searchPharmacyProducts(m.presentationId, m.pharmacyId)
      const best = candidates.find((c) => c.score > 0)
      if (!best) return
      await savePharmacyProduct(m.presentationId, m.pharmacyId, { sku: best.sku, seller: best.seller, productName: best.productName, url: best.url })
      linked++
    } catch {
      // segue com os outros; o usuário vincula este manualmente
    }
  })
  return { linked, total: missing.length }
}

/** Consulta preço (1, 2 e 3 caixas), estoque e frete de todos os produtos vinculados e salva como cotação. */
export async function runAutoQuotation() {
  const userId = await requireManager()
  const postalCode = await getPostalCode()
  if (!postalCode) throw new Error("Cadastre o CEP de entrega em Configurações → Farmácias.")

  const products = await prisma.pharmacyProduct.findMany({
    where: {
      pharmacy: { isActive: true, vtexHost: { not: null } },
      presentation: { isPreferred: true, medication: { isActive: true, supplySource: "PURCHASE" } },
    },
    include: { pharmacy: true },
  })
  if (!products.length) throw new Error("Nenhum produto vinculado. Vincule os remédios às farmácias primeiro.")

  const results = await mapLimit(products, 4, async (p) => {
    const host = p.pharmacy.vtexHost!
    try {
      const sims = []
      for (const quantity of [1, 2, 3]) sims.push(await vtexSimulate(host, postalCode, [{ sku: p.sku, seller: p.seller, quantity }]))
      const [one, two, three] = sims
      const unit = one.subtotal
      const totals: Record<string, number> = {}
      if (Math.abs(two.subtotal - 2 * unit) > 0.05) totals["2"] = two.subtotal
      if (Math.abs(three.subtotal - 3 * unit) > 0.05) totals["3"] = three.subtotal
      const delivery = one.delivery[0]
      const notes = [p.productName]
      if (totals["2"]) notes.push(`Levando 2: ${(totals["2"] / 2).toFixed(2).replace(".", ",")} cada`)
      if (delivery) notes.push(`Entrega ${delivery.estimate.replace("bd", " dia(s) útil(eis)")}`)
      if (one.pickup[0]) notes.push("Retirada em loja")
      notes.push(p.url)
      return {
        ok: true as const,
        presentationId: p.presentationId,
        pharmacyId: p.pharmacyId,
        price: unit > 0 ? unit : null,
        inStock: one.available && unit > 0,
        shipping: delivery?.price ?? null,
        totals: Object.keys(totals).length ? totals : null,
        notes: notes.join(" · "),
      }
    } catch (e) {
      return { ok: false as const, name: `${p.pharmacy.name}: ${p.productName}`, error: e instanceof Error ? e.message : String(e) }
    }
  })

  const ok = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)
  if (!ok.length) throw new Error("Nenhuma loja respondeu. Tente de novo em alguns minutos.")

  const quotation = await prisma.$transaction(async (tx) => {
    const q = await tx.quotation.create({ data: { createdById: userId, status: "COMPLETED", completedAt: new Date() } })
    for (const r of ok) {
      const qi = await tx.quotationItem.create({
        data: {
          quotationId: q.id,
          presentationId: r.presentationId,
          pharmacyId: r.pharmacyId,
          pricePerPackage: r.price,
          inStock: r.inStock,
          shippingEstimate: r.shipping,
          quantityTotals: r.totals ?? Prisma.DbNull,
          notes: r.notes,
        },
      })
      if (r.price && r.inStock) {
        await tx.priceHistory.create({
          data: { presentationId: r.presentationId, pharmacyId: r.pharmacyId, pricePerPackage: r.price, source: "QUOTATION", quotationItemId: qi.id },
        })
      }
    }
    return q
  })

  revalidatePath("/manager/quotation")
  return { quotationId: quotation.id, saved: ok.length, failed: failed.map((f) => ("name" in f ? `${f.name} (${f.error})` : "")) }
}

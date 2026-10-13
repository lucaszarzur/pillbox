"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma/client"
import { auth } from "@/auth"
import { calcCurrentStock } from "@/lib/stockCalc"

export async function getPurchasePageData() {
  const [pharmacies, medications, purchases] = await Promise.all([
    prisma.pharmacy.findMany({ where: { isActive: true }, orderBy: { priority: "asc" }, distinct: ["name"] }),
    prisma.medication.findMany({
      // Também traz remédios que já aparecem em compras (do posto ou desativados),
      // senão o item some do formulário ao editar uma compra antiga.
      where: {
        OR: [
          { isActive: true, supplySource: "PURCHASE" },
          { presentations: { some: { isPreferred: true, purchaseItems: { some: {} } } } },
        ],
      },
      orderBy: { name: "asc" },
      include: {
        presentations: {
          where: { isPreferred: true },
          select: { id: true, dosage: true, brand: true, unitsPerPackage: true, daysPerPackage: true },
        },
      },
    }),
    prisma.purchase.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        items: {
          include: {
            presentation: { include: { medication: { select: { name: true } } } },
            pharmacy: { select: { name: true } },
          },
        },
      },
    }),
  ])
  return JSON.parse(JSON.stringify({ pharmacies, medications, purchases }))
}

type PurchaseItemUnits = {
  presentationId: string
  quantityPackages: number
  presentation: { unitsPerPackage: number }
}

function unitsByPresentation(items: PurchaseItemUnits[], sign = 1) {
  const deltas = new Map<string, number>()
  for (const item of items) {
    const units = item.quantityPackages * item.presentation.unitsPerPackage * sign
    deltas.set(item.presentationId, (deltas.get(item.presentationId) ?? 0) + units)
  }
  return deltas
}

// Soma (delta > 0) ou estorna (delta < 0) unidades de uma compra no estoque.
// A data efetiva é a mais recente entre o recebimento e a referência atual, então
// uma compra retroativa nunca puxa a referenceDate para trás. Se houve contagem
// manual/confirmação depois do recebimento, ela já reflete a compra e nada muda.
async function applyStockDeltas(deltas: Map<string, number>, eventDate: Date, userId: string) {
  for (const [presentationId, delta] of deltas) {
    if (delta === 0) continue

    const pres = await prisma.medicationPresentation.findUnique({ where: { id: presentationId } })
    if (!pres) continue

    const existingStock = await prisma.stock.findUnique({ where: { presentationId } })

    if (!existingStock) {
      if (delta > 0) {
        await prisma.stock.create({
          data: {
            presentationId,
            referenceQuantity: delta,
            referenceDate: eventDate,
            referenceType: "PURCHASE",
            confidence: "HIGH",
            adjustedById: userId,
          },
        })
      }
      continue
    }

    const referenceDate = new Date(existingStock.referenceDate)
    if (eventDate < referenceDate && existingStock.referenceType !== "PURCHASE") continue

    const effectiveDate = eventDate > referenceDate ? eventDate : referenceDate
    const rule = await prisma.consumptionRule.findFirst({
      where: { presentationId, validUntil: null },
    })
    const { current } = calcCurrentStock({
      referenceQuantity: existingStock.referenceQuantity,
      referenceDate: existingStock.referenceDate,
      rule,
      unitsPerPackage: pres.unitsPerPackage,
      daysPerPackage: pres.daysPerPackage ?? null,
      now: effectiveDate,
    })

    await prisma.stock.update({
      where: { presentationId },
      data: {
        referenceQuantity: Math.max(0, current + delta),
        referenceDate: effectiveDate,
        referenceType: "PURCHASE",
        ...(delta > 0 ? { confidence: "HIGH" as const } : {}),
        adjustedById: userId,
      },
    })
  }
}

async function applyPurchaseToStock(purchaseId: string, receivedDate: Date, userId: string) {
  const items = await prisma.purchaseItem.findMany({
    where: { purchaseId },
    include: { presentation: { select: { unitsPerPackage: true } } },
  })
  await applyStockDeltas(unitsByPresentation(items), receivedDate, userId)
}

export async function createPurchase(
  pharmacyId: string,
  purchaseDate: string,
  items: { presentationId: string; quantityPackages: number; unitPrice: number }[],
  notes: string,
  receivedDate: string | null
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const received = receivedDate ? new Date(receivedDate) : null

  const purchase = await prisma.purchase.create({
    data: {
      createdById: session.user.id,
      status: received ? "COMPLETED" : "PLANNED",
      purchaseDate: new Date(purchaseDate),
      receivedDate: received,
      notes: notes || null,
      items: {
        create: items.map((i) => ({
          presentationId: i.presentationId,
          pharmacyId,
          quantityPackages: i.quantityPackages,
          unitPrice: i.unitPrice,
        })),
      },
    },
    include: { items: true },
  })

  for (const item of purchase.items) {
    await prisma.priceHistory.create({
      data: {
        presentationId: item.presentationId,
        pharmacyId,
        pricePerPackage: item.unitPrice,
        source: "PURCHASE",
        purchaseItemId: item.id,
      },
    })
  }

  if (received) {
    await applyPurchaseToStock(purchase.id, received, session.user.id)
  }

  revalidatePath("/manager/purchases")
  revalidatePath("/manager/stock")
  revalidatePath("/manager/dashboard")
  return purchase.id
}

export async function updatePurchase(
  purchaseId: string,
  pharmacyId: string,
  purchaseDate: string,
  items: { presentationId: string; quantityPackages: number; unitPrice: number }[],
  notes: string,
  receivedDate: string | null
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const existing = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: { include: { presentation: { select: { unitsPerPackage: true } } } } },
  })
  if (!existing) throw new Error("Compra não encontrada.")

  // Só o que já entrou no estoque conta como "antes": compra PLANNED não somou nada.
  const oldApplied = existing.status === "COMPLETED" ? unitsByPresentation(existing.items) : new Map<string, number>()

  const oldItemIds = existing.items.map((i) => i.id)
  if (oldItemIds.length) {
    await prisma.priceHistory.deleteMany({ where: { purchaseItemId: { in: oldItemIds } } })
    await prisma.purchaseItem.deleteMany({ where: { id: { in: oldItemIds } } })
  }

  const received = receivedDate ? new Date(receivedDate) : null

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: {
      status: received ? "COMPLETED" : "PLANNED",
      purchaseDate: new Date(purchaseDate),
      receivedDate: received,
      notes: notes.trim() || null,
      items: {
        create: items.map((i) => ({
          presentationId: i.presentationId,
          pharmacyId,
          quantityPackages: i.quantityPackages,
          unitPrice: i.unitPrice,
        })),
      },
    },
  })

  const newItems = await prisma.purchaseItem.findMany({
    where: { purchaseId },
    include: { presentation: { select: { unitsPerPackage: true } } },
  })
  for (const item of newItems) {
    await prisma.priceHistory.create({
      data: {
        presentationId: item.presentationId,
        pharmacyId,
        pricePerPackage: item.unitPrice,
        source: "PURCHASE",
        purchaseItemId: item.id,
      },
    })
  }

  // Aplica só a diferença entre o que estava no estoque e o novo lançamento:
  // editar preço não mexe no estoque, e tirar o recebimento estorna as unidades.
  const deltas = received ? unitsByPresentation(newItems) : new Map<string, number>()
  for (const [presentationId, units] of oldApplied) {
    deltas.set(presentationId, (deltas.get(presentationId) ?? 0) - units)
  }
  const eventDate = received ?? existing.receivedDate
  if (eventDate) {
    await applyStockDeltas(deltas, eventDate, session.user.id)
  }

  revalidatePath("/manager/purchases")
  revalidatePath("/manager/stock")
  revalidatePath("/manager/dashboard")
}

export async function markPurchaseReceived(purchaseId: string, receivedDate: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const received = new Date(receivedDate)

  // updateMany condicional para que dois cliques simultâneos não somem a compra duas vezes.
  const { count } = await prisma.purchase.updateMany({
    where: { id: purchaseId, status: { not: "COMPLETED" } },
    data: { status: "COMPLETED", receivedDate: received },
  })
  if (count === 0) {
    const exists = await prisma.purchase.findUnique({ where: { id: purchaseId }, select: { id: true } })
    throw new Error(exists ? "Compra já marcada como recebida." : "Compra não encontrada.")
  }

  await applyPurchaseToStock(purchaseId, received, session.user.id)

  revalidatePath("/manager/purchases")
  revalidatePath("/manager/stock")
  revalidatePath("/manager/dashboard")
}

export async function deletePurchase(id: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: { items: { include: { presentation: { select: { unitsPerPackage: true } } } } },
  })
  if (!purchase) throw new Error("Compra não encontrada.")

  const itemIds = purchase.items.map((i) => i.id)
  if (itemIds.length) {
    await prisma.priceHistory.deleteMany({ where: { purchaseItemId: { in: itemIds } } })
  }
  await prisma.purchase.delete({ where: { id } })

  // Compra recebida já somou no estoque: apagar precisa estornar as unidades.
  if (purchase.status === "COMPLETED" && purchase.receivedDate) {
    await applyStockDeltas(unitsByPresentation(purchase.items, -1), purchase.receivedDate, session.user.id)
  }
  revalidatePath("/manager/purchases")
  revalidatePath("/manager/stock")
  revalidatePath("/manager/dashboard")
}

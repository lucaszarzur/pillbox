"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma/client"
import { auth } from "@/auth"

export async function getPurchasePageData() {
  const [pharmacies, medications, purchases] = await Promise.all([
    prisma.pharmacy.findMany({ where: { isActive: true }, orderBy: { priority: "asc" }, distinct: ["name"] }),
    prisma.medication.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        presentations: {
          where: { isPreferred: true },
          select: { id: true, dosage: true, brand: true, unitsPerPackage: true },
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

async function applyPurchaseToStock(purchaseId: string, receivedDate: Date, userId: string) {
  const items = await prisma.purchaseItem.findMany({
    where: { purchaseId },
    include: { presentation: true },
  })

  for (const item of items) {
    const pres = item.presentation
    const unitsAdded = item.quantityPackages * pres.unitsPerPackage

    const existingStock = await prisma.stock.findUnique({ where: { presentationId: pres.id } })
    if (existingStock) {
      const currentQty = Number(existingStock.referenceQuantity)
      const daysElapsed = Math.max(
        0,
        (receivedDate.getTime() - new Date(existingStock.referenceDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      const rule = await prisma.consumptionRule.findFirst({
        where: { presentationId: pres.id, validUntil: null },
      })
      const dailyConsumption = rule ? Number(rule.unitsPerDose) * Number(rule.dosesPerDay) : 0
      const theoretical = Math.max(0, currentQty - dailyConsumption * daysElapsed)

      await prisma.stock.update({
        where: { presentationId: pres.id },
        data: {
          referenceQuantity: theoretical + unitsAdded,
          referenceDate: receivedDate,
          referenceType: "PURCHASE",
          confidence: "HIGH",
          adjustedById: userId,
        },
      })
    }
  }
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

export async function markPurchaseReceived(purchaseId: string, receivedDate: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const purchase = await prisma.purchase.findUnique({ where: { id: purchaseId } })
  if (!purchase) throw new Error("Compra não encontrada.")
  if (purchase.status === "COMPLETED") throw new Error("Compra já marcada como recebida.")

  const received = new Date(receivedDate)

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { status: "COMPLETED", receivedDate: received },
  })

  await applyPurchaseToStock(purchaseId, received, session.user.id)

  revalidatePath("/manager/purchases")
  revalidatePath("/manager/stock")
  revalidatePath("/manager/dashboard")
}

export async function deletePurchase(id: string) {
  const items = await prisma.purchaseItem.findMany({ where: { purchaseId: id }, select: { id: true } })
  const itemIds = items.map((i) => i.id)
  if (itemIds.length) {
    await prisma.priceHistory.deleteMany({ where: { purchaseItemId: { in: itemIds } } })
  }
  await prisma.purchase.delete({ where: { id } })
  revalidatePath("/manager/purchases")
  revalidatePath("/manager/stock")
  revalidatePath("/manager/dashboard")
}

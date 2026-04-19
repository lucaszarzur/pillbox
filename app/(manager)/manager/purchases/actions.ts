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

export async function createPurchase(
  pharmacyId: string,
  purchaseDate: string,
  items: { presentationId: string; quantityPackages: number; unitPrice: number }[],
  notes: string
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const purchase = await prisma.purchase.create({
    data: {
      createdById: session.user.id,
      status: "COMPLETED",
      purchaseDate: new Date(purchaseDate),
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
    include: { items: { include: { presentation: true } } },
  })

  // Atualiza estoque de cada item comprado
  for (const item of purchase.items) {
    const pres = item.presentation
    const unitsAdded = item.quantityPackages * pres.unitsPerPackage

    const existingStock = await prisma.stock.findUnique({ where: { presentationId: pres.id } })
    if (existingStock) {
      const currentQty = Number(existingStock.referenceQuantity)
      const daysElapsed = (Date.now() - new Date(existingStock.referenceDate).getTime()) / (1000 * 60 * 60 * 24)
      // Busca regra de consumo para calcular o consumo até agora
      const rule = await prisma.consumptionRule.findFirst({
        where: { presentationId: pres.id, validUntil: null },
      })
      const dailyConsumption = rule ? Number(rule.unitsPerDose) * Number(rule.dosesPerDay) : 0
      const theoretical = Math.max(0, currentQty - dailyConsumption * daysElapsed)

      await prisma.stock.update({
        where: { presentationId: pres.id },
        data: {
          referenceQuantity: theoretical + unitsAdded,
          referenceDate: new Date(),
          referenceType: "PURCHASE",
          confidence: "HIGH",
          adjustedById: session.user.id,
        },
      })
    }

    // Salva histórico de preço
    await prisma.priceHistory.create({
      data: {
        presentationId: pres.id,
        pharmacyId,
        pricePerPackage: item.unitPrice,
        source: "PURCHASE",
        purchaseItemId: item.id,
      },
    })
  }

  revalidatePath("/manager/purchases")
  revalidatePath("/manager/stock")
  revalidatePath("/manager/dashboard")
  return purchase.id
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

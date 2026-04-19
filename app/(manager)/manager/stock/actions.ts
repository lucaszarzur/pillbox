"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma/client"
import { auth } from "@/auth"

export async function getStockOverview() {
  const data = await prisma.medication.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      presentations: {
        where: { isPreferred: true },
        include: {
          consumptionRules: {
            where: { validUntil: null },
            orderBy: { validFrom: "desc" },
            take: 1,
          },
          stock: {
            include: {
              confirmations: {
                orderBy: { confirmedAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  })
  return JSON.parse(JSON.stringify(data))
}

export async function getStockHistory(stockId: string) {
  const confirmations = await prisma.stockConfirmation.findMany({
    where: { stockId },
    orderBy: { confirmedAt: "desc" },
    take: 50,
    include: { confirmedBy: { select: { name: true } } },
  })

  const purchases = await prisma.purchaseItem.findMany({
    where: {
      presentation: { stock: { id: stockId } },
    },
    orderBy: { purchase: { purchaseDate: "desc" } },
    take: 20,
    include: {
      pharmacy: { select: { name: true } },
      purchase: { select: { purchaseDate: true, createdAt: true } },
    },
  })

  return JSON.parse(JSON.stringify({ confirmations, purchases }))
}

export async function adjustStock(presentationId: string, quantity: number) {
  const session = await auth()
  if (!session?.user) throw new Error("Unauthorized")

  const userId = session.user.id ?? null

  await prisma.stock.upsert({
    where: { presentationId },
    update: {
      referenceQuantity: quantity,
      referenceDate: new Date(),
      referenceType: "MANUAL_ADJUSTMENT",
      confidence: "HIGH",
      adjustedById: userId,
    },
    create: {
      presentationId,
      referenceQuantity: quantity,
      referenceDate: new Date(),
      referenceType: "MANUAL_ADJUSTMENT",
      confidence: "HIGH",
      adjustedById: userId,
    },
  })

  revalidatePath("/manager/stock")
  revalidatePath("/manager/dashboard")
}

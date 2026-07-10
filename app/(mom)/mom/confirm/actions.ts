"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma/client"
import { auth } from "@/auth"
import { calcCurrentStock } from "@/lib/stockCalc"

export async function getMedsForConfirmation() {
  const data = await prisma.medication.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      presentations: {
        where: { isPreferred: true },
        select: { id: true, dosage: true, unitsPerPackage: true, daysPerPackage: true, stock: { select: { id: true } } },
      },
    },
  })
  return JSON.parse(JSON.stringify(data))
}

export async function submitConfirmation(
  entries: { stockId: string; qualitativeStatus: "OK" | "LOW" | "CRITICAL"; quantityInformed?: number }[],
  notes: string
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const now = new Date()

  for (const e of entries) {
    const stock = await prisma.stock.findUnique({
      where: { id: e.stockId },
      include: {
        presentation: {
          include: {
            consumptionRules: {
              where: { validUntil: null },
              orderBy: { validFrom: "desc" },
              take: 1,
            },
          },
        },
      },
    })

    const rule = stock?.presentation.consumptionRules[0] ?? null
    const theoretical = stock
      ? calcCurrentStock({
          referenceQuantity: stock.referenceQuantity,
          referenceDate: stock.referenceDate,
          rule: rule,
          unitsPerPackage: stock.presentation.unitsPerPackage,
          daysPerPackage: stock.presentation.daysPerPackage ?? null,
        }).current
      : null

    // Divergência: quantidade informada difere do teórico em mais de 1 unidade
    const divergenceDetected =
      e.quantityInformed != null && theoretical != null
        ? Math.abs(e.quantityInformed - theoretical) > 1
        : false

    await prisma.stockConfirmation.create({
      data: {
        stockId: e.stockId,
        confirmedById: session.user.id,
        qualitativeStatus: e.qualitativeStatus,
        quantityInformed: e.quantityInformed ?? null,
        divergenceDetected,
        notes: notes.trim() || null,
        confirmedAt: now,
      },
    })

    if (e.qualitativeStatus === "OK") {
      await prisma.stock.update({
        where: { id: e.stockId },
        data: { confidence: "MEDIUM" },
      })
    } else if (e.quantityInformed != null) {
      await prisma.stock.update({
        where: { id: e.stockId },
        data: {
          referenceQuantity: e.quantityInformed,
          referenceDate: now,
          referenceType: "CONFIRMATION",
          confidence: "HIGH",
          adjustedById: session.user.id,
        },
      })
    } else {
      await prisma.stock.update({
        where: { id: e.stockId },
        data: { confidence: "LOW" },
      })
    }
  }

  revalidatePath("/manager/dashboard")
  revalidatePath("/manager/stock")
  revalidatePath("/manager/confirmations")
}

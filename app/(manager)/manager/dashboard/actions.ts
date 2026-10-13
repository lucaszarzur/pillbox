"use server"

import { prisma } from "@/lib/prisma/client"
import { calcCurrentStock } from "@/lib/stockCalc"

export async function getDashboardData() {
  const medications = await prisma.medication.findMany({
    where: { isActive: true },
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

  const now = Date.now()
  let critical = 0, attention = 0, ok = 0
  const stockList: { name: string; days: number | null; status: "critical" | "attention" | "ok"; occasional: boolean }[] = []

  for (const med of medications) {
    const pres = med.presentations[0]
    const stock = pres?.stock
    const rule = pres?.consumptionRules[0]

    if (!stock) continue

    const { daysRemaining } = calcCurrentStock({
      referenceQuantity: stock.referenceQuantity,
      referenceDate: stock.referenceDate,
      rule: rule ?? null,
      unitsPerPackage: pres.unitsPerPackage,
      daysPerPackage: pres.daysPerPackage ?? null,
      now,
    })

    let status: "critical" | "attention" | "ok" = "ok"
    if (daysRemaining !== null && daysRemaining <= 15) { critical++; status = "critical" }
    else if (daysRemaining !== null && daysRemaining <= 30) { attention++; status = "attention" }
    else ok++

    // 0 dias é um valor válido (zerado); só null significa "sem cálculo".
    stockList.push({
      name: med.name,
      days: daysRemaining !== null ? Math.floor(daysRemaining) : null,
      status,
      occasional: med.category === "OCCASIONAL",
    })
  }

  const lastConfirmation = await prisma.stockConfirmation.findFirst({
    orderBy: { confirmedAt: "desc" },
    include: { confirmedBy: { select: { name: true } } },
  })

  return JSON.parse(JSON.stringify({
    counts: { critical, attention, ok },
    stockList: stockList.sort((a, b) => (a.days ?? 999) - (b.days ?? 999)),
    lastConfirmation,
  }))
}

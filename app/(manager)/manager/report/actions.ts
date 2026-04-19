"use server"

import { prisma } from "@/lib/prisma/client"

export async function getReportData(year: number, month: number | null) {
  const dateFrom = month !== null
    ? new Date(year, month, 1)
    : new Date(year, 0, 1)
  const dateTo = month !== null
    ? new Date(year, month + 1, 1)
    : new Date(year + 1, 0, 1)

  const [purchases, medications] = await Promise.all([
    prisma.purchase.findMany({
      where: {
        status: "COMPLETED",
        purchaseDate: { gte: dateFrom, lt: dateTo },
      },
      include: {
        items: {
          include: {
            presentation: { include: { medication: { select: { name: true } } } },
            pharmacy: { select: { name: true } },
          },
        },
      },
      orderBy: { purchaseDate: "asc" },
    }),
    prisma.medication.findMany({
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
            stock: true,
          },
        },
      },
    }),
  ])

  // Aggregate spending by medication
  const byMedication: Record<string, { name: string; totalSpent: number; totalPackages: number }> = {}
  const byPharmacy: Record<string, { name: string; totalSpent: number; totalPackages: number }> = {}
  let grandTotal = 0

  for (const purchase of purchases) {
    for (const item of purchase.items) {
      const spent = Number(item.unitPrice) * item.quantityPackages
      grandTotal += spent

      const medName = item.presentation.medication.name
      if (!byMedication[medName]) byMedication[medName] = { name: medName, totalSpent: 0, totalPackages: 0 }
      byMedication[medName].totalSpent += spent
      byMedication[medName].totalPackages += item.quantityPackages

      const phName = item.pharmacy.name
      if (!byPharmacy[phName]) byPharmacy[phName] = { name: phName, totalSpent: 0, totalPackages: 0 }
      byPharmacy[phName].totalSpent += spent
      byPharmacy[phName].totalPackages += item.quantityPackages
    }
  }

  return JSON.parse(JSON.stringify({
    grandTotal,
    purchaseCount: purchases.length,
    byMedication: Object.values(byMedication).sort((a, b) => b.totalSpent - a.totalSpent),
    byPharmacy: Object.values(byPharmacy).sort((a, b) => b.totalSpent - a.totalSpent),
    medications,
  }))
}

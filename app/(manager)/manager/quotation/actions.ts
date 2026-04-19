"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma/client"
import { auth } from "@/auth"

export async function getQuotationPageData() {
  const [pharmacies, medications, quotations, priceHistory] = await Promise.all([
    prisma.pharmacy.findMany({ where: { isActive: true }, orderBy: { priority: "asc" }, distinct: ["name"] }),
    prisma.medication.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        presentations: {
          where: { isPreferred: true },
          select: { id: true, dosage: true, brand: true, form: true },
        },
      },
    }),
    prisma.quotation.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        items: { include: { pharmacy: { select: { name: true } } } },
        _count: { select: { items: true } },
      },
    }),
    prisma.priceHistory.findMany({
      orderBy: { recordedAt: "desc" },
      select: { presentationId: true, pricePerPackage: true, pharmacy: { select: { name: true } } },
    }),
  ])

  // Aggregate: last 5 prices per presentation+pharmacyName → average (min 2 entries)
  const histMap: Record<string, { sum: number; count: number }> = {}
  for (const h of priceHistory) {
    const key = `${h.presentationId}:${h.pharmacy.name}`
    if (!histMap[key]) histMap[key] = { sum: 0, count: 0 }
    if (histMap[key].count < 5) {
      histMap[key].sum += Number(h.pricePerPackage)
      histMap[key].count += 1
    }
  }
  // Use median per key to be resilient to outliers (e.g. test purchases, promotions)
  const priceMedian: Record<string, number> = {}
  const histValues: Record<string, number[]> = {}
  for (const h of priceHistory) {
    const key = `${h.presentationId}:${h.pharmacy.name}`
    if (!histValues[key]) histValues[key] = []
    if (histValues[key].length < 10) histValues[key].push(Number(h.pricePerPackage))
  }
  for (const [key, vals] of Object.entries(histValues)) {
    if (vals.length < 2) continue
    const sorted = [...vals].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    priceMedian[key] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }
  const priceAvg = priceMedian

  return JSON.parse(JSON.stringify({ pharmacies, medications, quotations, priceAvg }))
}

export async function createQuotation(
  items: { presentationId: string; pharmacyId: string; pricePerPackage: number | null; inStock: boolean | null; notes: string }[]
) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const quotation = await prisma.quotation.create({
    data: {
      createdById: session.user.id,
      status: "COMPLETED",
      completedAt: new Date(),
      items: {
        create: items.map((i) => ({
          presentationId: i.presentationId,
          pharmacyId: i.pharmacyId,
          pricePerPackage: i.pricePerPackage,
          inStock: i.inStock,
          notes: i.notes || null,
        })),
      },
    },
  })

  // Save to price history
  for (const item of items) {
    if (item.pricePerPackage) {
      await prisma.priceHistory.create({
        data: {
          presentationId: item.presentationId,
          pharmacyId: item.pharmacyId,
          pricePerPackage: item.pricePerPackage,
          source: "QUOTATION",
        },
      })
    }
  }

  revalidatePath("/manager/quotation")
  return quotation.id
}

export async function deleteQuotation(id: string) {
  const items = await prisma.quotationItem.findMany({ where: { quotationId: id }, select: { id: true } })
  const itemIds = items.map((i) => i.id)
  if (itemIds.length) {
    await prisma.priceHistory.deleteMany({ where: { quotationItemId: { in: itemIds } } })
  }
  await prisma.quotation.delete({ where: { id } })
  revalidatePath("/manager/quotation")
}

export async function getQuotationHistory() {
  const data = await prisma.quotation.findMany({
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
  })
  return JSON.parse(JSON.stringify(data))
}

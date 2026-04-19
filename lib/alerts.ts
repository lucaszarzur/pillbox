"use server"

import { prisma } from "@/lib/prisma/client"

export async function generateAlerts() {
  const medications = await prisma.medication.findMany({
    where: { isActive: true },
    include: {
      presentations: {
        where: { isPreferred: true },
        include: {
          consumptionRules: { where: { validUntil: null }, orderBy: { validFrom: "desc" }, take: 1 },
          stock: {
            include: {
              confirmations: { orderBy: { confirmedAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  })

  const now = Date.now()

  for (const med of medications) {
    const pres = med.presentations[0]
    const stock = pres?.stock
    const rule = pres?.consumptionRules[0]
    if (!stock) continue

    const referenceQty = Number(stock.referenceQuantity)
    const daysElapsed = (now - new Date(stock.referenceDate).getTime()) / (1000 * 60 * 60 * 24)
    const dailyConsumption = rule ? Number(rule.unitsPerDose) * Number(rule.dosesPerDay) : 0
    const theoretical = Math.max(0, referenceQty - dailyConsumption * daysElapsed)
    const daysRemaining = dailyConsumption > 0 ? theoretical / dailyConsumption : null

    // Alerta de estoque crítico (≤10 dias)
    if (daysRemaining !== null && daysRemaining <= 10) {
      const exists = await prisma.alert.findFirst({
        where: { stockId: stock.id, type: "CRITICAL", isRead: false, isDismissed: false },
      })
      if (!exists) {
        await prisma.alert.create({
          data: {
            type: "CRITICAL",
            stockId: stock.id,
            presentationId: pres.id,
            message: `${med.name}: estoque acaba em ~${Math.floor(daysRemaining)} dia(s).`,
          },
        })
      }
    }

    // Alerta de estoque baixo (11–30 dias)
    if (daysRemaining !== null && daysRemaining > 10 && daysRemaining <= 30) {
      const exists = await prisma.alert.findFirst({
        where: { stockId: stock.id, type: "LOW_STOCK", isRead: false, isDismissed: false },
      })
      if (!exists) {
        await prisma.alert.create({
          data: {
            type: "LOW_STOCK",
            stockId: stock.id,
            presentationId: pres.id,
            message: `${med.name}: estoque para ~${Math.floor(daysRemaining)} dias.`,
          },
        })
      }
    }

    // Divergência detectada recentemente (últimos 7 dias)
    const lastConfirmation = stock.confirmations[0]
    if (lastConfirmation?.divergenceDetected) {
      const confirmedAt = new Date(lastConfirmation.confirmedAt).getTime()
      const isRecent = (now - confirmedAt) / (1000 * 60 * 60 * 24) <= 7
      if (isRecent) {
        const exists = await prisma.alert.findFirst({
          where: { stockId: stock.id, type: "DIVERGENCE", isRead: false, isDismissed: false },
        })
        if (!exists) {
          await prisma.alert.create({
            data: {
              type: "DIVERGENCE",
              stockId: stock.id,
              presentationId: pres.id,
              message: `${med.name}: quantidade informada pela mãe diverge do estoque teórico.`,
            },
          })
        }
      }
    }
  }

  // Alerta de confirmação em atraso (sem confirmação há 7+ dias)
  const lastConfirmationGlobal = await prisma.stockConfirmation.findFirst({
    orderBy: { confirmedAt: "desc" },
    select: { confirmedAt: true },
  })
  const daysSinceConfirmation = lastConfirmationGlobal
    ? (now - new Date(lastConfirmationGlobal.confirmedAt).getTime()) / (1000 * 60 * 60 * 24)
    : 999

  if (daysSinceConfirmation >= 7) {
    const exists = await prisma.alert.findFirst({
      where: { type: "NO_CONFIRMATION", isRead: false, isDismissed: false },
    })
    if (!exists) {
      await prisma.alert.create({
        data: {
          type: "NO_CONFIRMATION",
          message: `Mãe não confirma os remédios há ${Math.floor(daysSinceConfirmation)} dias.`,
        },
      })
    }
  }
}

export async function getUnreadAlerts() {
  return prisma.alert.findMany({
    where: { isRead: false, isDismissed: false },
    orderBy: { generatedAt: "desc" },
    take: 20,
  })
}

export async function markAlertRead(id: string) {
  await prisma.alert.update({ where: { id }, data: { isRead: true } })
}

export async function dismissAlert(id: string) {
  await prisma.alert.update({ where: { id }, data: { isDismissed: true } })
}

export async function markAllRead() {
  await prisma.alert.updateMany({ where: { isRead: false, isDismissed: false }, data: { isRead: true } })
}

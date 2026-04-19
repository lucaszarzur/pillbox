import { prisma } from "@/lib/prisma/client"
import Link from "next/link"

export default async function MomStockPage() {
  const medications = await prisma.medication.findMany({
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

  const now = Date.now()

  const items = medications.map((med) => {
    const pres = med.presentations[0]
    const rule = pres?.consumptionRules[0]
    const stock = pres?.stock

    if (!stock) return { name: med.name, dosage: pres?.dosage ?? "", days: null, status: "unknown" as const }

    const referenceQty = Number(stock.referenceQuantity)
    const daysElapsed = (now - new Date(stock.referenceDate).getTime()) / (1000 * 60 * 60 * 24)
    const dailyConsumption = rule ? Number(rule.unitsPerDose) * Number(rule.dosesPerDay) : 0
    const theoretical = Math.max(0, referenceQty - dailyConsumption * daysElapsed)
    const days = dailyConsumption > 0 ? Math.floor(theoretical / dailyConsumption) : null

    const status = days === null ? "unknown" : days <= 15 ? "critical" : days <= 30 ? "attention" : "ok"
    return { name: med.name, dosage: pres?.dosage ?? "", days, status } as const
  })

  const statusLabel = { ok: "Tá bem", attention: "Ficando pouco", critical: "Acabando!", unknown: "Sem info" }
  const statusColor = {
    ok: "bg-green-50 border-green-200 text-green-800",
    attention: "bg-yellow-50 border-yellow-200 text-yellow-800",
    critical: "bg-red-50 border-red-200 text-red-800",
    unknown: "bg-gray-50 border-gray-200 text-gray-500",
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-10 max-w-sm mx-auto">
      <div className="mb-8">
        <Link href="/mom/home" className="text-sm text-gray-400 mb-4 block">← Início</Link>
        <h1 className="text-2xl font-semibold">Meus remédios</h1>
        <p className="text-gray-500 text-sm">Previsão de duração do estoque</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.name}
            className={`border rounded-xl px-4 py-4 ${statusColor[item.status]}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm opacity-70">{item.dosage}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{statusLabel[item.status]}</p>
                {item.days !== null && (
                  <p className="text-xs opacity-70">~{item.days} dias</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link
          href="/mom/confirm"
          className="block w-full bg-gray-900 text-white text-center rounded-xl py-4 text-base font-medium"
        >
          Confirmar situação agora
        </Link>
      </div>
    </div>
  )
}

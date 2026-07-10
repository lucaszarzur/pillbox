export const DURATION_SAFETY_FACTOR = 0.9

export interface StockCalcRule {
  unitsPerDose: unknown
  dosesPerDay: unknown
}

export interface StockCalcInput {
  referenceQuantity: unknown
  referenceDate: Date | string
  rule: StockCalcRule | null
  unitsPerPackage: number
  daysPerPackage: number | null
  now?: Date | number
}

export interface StockCalcResult {
  current: number
  daysRemaining: number | null
  dailyConsumption: number
  mode: "DOSE" | "DURATION"
}

export function calcCurrentStock(input: StockCalcInput): StockCalcResult {
  const now = input.now ? new Date(input.now).getTime() : Date.now()
  const referenceQty = Number(input.referenceQuantity)
  const daysElapsed = Math.max(
    0,
    (now - new Date(input.referenceDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  let dailyConsumption = 0
  let mode: "DOSE" | "DURATION" = "DOSE"

  if (input.daysPerPackage && input.daysPerPackage > 0 && input.unitsPerPackage > 0) {
    dailyConsumption = input.unitsPerPackage / (input.daysPerPackage * DURATION_SAFETY_FACTOR)
    mode = "DURATION"
  } else if (input.rule) {
    dailyConsumption = Number(input.rule.unitsPerDose) * Number(input.rule.dosesPerDay)
  }

  const current = Math.max(0, referenceQty - dailyConsumption * daysElapsed)
  const daysRemaining = dailyConsumption > 0 ? current / dailyConsumption : null
  return { current, daysRemaining, dailyConsumption, mode }
}

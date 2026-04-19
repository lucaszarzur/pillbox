"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma/client"
import { MedicationCategory, MedicationForm } from "@prisma/client"

export type MedicineFormData = {
  name: string
  activeIngredient: string
  category: MedicationCategory
  requiresPrescription: boolean
  notes: string
  brand: string
  dosage: string
  form: MedicationForm
  unitsPerPackage: number
  unitsPerDose: number
  dosesPerDay: number
}

export async function createMedicine(data: MedicineFormData) {
  const medication = await prisma.medication.create({
    data: {
      name: data.name.trim(),
      activeIngredient: data.activeIngredient.trim() || null,
      category: data.category,
      requiresPrescription: data.requiresPrescription,
      notes: data.notes.trim() || null,
      presentations: {
        create: {
          brand: data.brand.trim() || null,
          dosage: data.dosage.trim() || null,
          form: data.form,
          unitsPerPackage: data.unitsPerPackage,
          isPreferred: true,
          ...(data.category !== "OCCASIONAL" && {
            consumptionRules: {
              create: {
                unitsPerDose: data.unitsPerDose,
                dosesPerDay: data.dosesPerDay,
                daysOfWeek: [],
                validFrom: new Date(),
              },
            },
          }),
          stock: {
            create: {
              referenceQuantity: 0,
              referenceDate: new Date(),
              referenceType: "MANUAL_ADJUSTMENT",
              confidence: "UNKNOWN",
            },
          },
        },
      },
    },
  })

  revalidatePath("/manager/medicines")
  return medication
}

export async function toggleMedicineActive(id: string, isActive: boolean) {
  await prisma.medication.update({ where: { id }, data: { isActive } })
  revalidatePath("/manager/medicines")
}

export async function updateMedicine(id: string, data: MedicineFormData) {
  await prisma.medication.update({
    where: { id },
    data: {
      name: data.name.trim(),
      activeIngredient: data.activeIngredient.trim() || null,
      category: data.category,
      requiresPrescription: data.requiresPrescription,
      notes: data.notes.trim() || null,
    },
  })

  const pres = await prisma.medicationPresentation.findFirst({
    where: { medicationId: id, isPreferred: true },
  })

  if (pres) {
    await prisma.medicationPresentation.update({
      where: { id: pres.id },
      data: {
        brand: data.brand.trim() || null,
        dosage: data.dosage.trim(),
        form: data.form,
        unitsPerPackage: data.unitsPerPackage,
      },
    })

    if (data.category !== "OCCASIONAL") {
      const rule = await prisma.consumptionRule.findFirst({
        where: { presentationId: pres.id, validUntil: null },
      })
      if (rule) {
        await prisma.consumptionRule.update({
          where: { id: rule.id },
          data: { unitsPerDose: data.unitsPerDose, dosesPerDay: data.dosesPerDay },
        })
      }
    }
  }

  revalidatePath("/manager/medicines")
}

export async function deleteMedicine(id: string) {
  const presentations = await prisma.medicationPresentation.findMany({
    where: { medicationId: id },
    select: { id: true },
  })
  const presIds = presentations.map((p) => p.id)

  if (presIds.length) {
    await prisma.priceHistory.deleteMany({ where: { presentationId: { in: presIds } } })
    await prisma.alert.deleteMany({ where: { presentationId: { in: presIds } } })
    await prisma.quotationItem.deleteMany({ where: { presentationId: { in: presIds } } })
    await prisma.purchaseItem.deleteMany({ where: { presentationId: { in: presIds } } })
  }

  await prisma.medication.delete({ where: { id } })
  revalidatePath("/manager/medicines")
  revalidatePath("/manager/stock")
  revalidatePath("/manager/dashboard")
}

export async function getMedicines() {
  const data = await prisma.medication.findMany({
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
  })
  return JSON.parse(JSON.stringify(data))
}

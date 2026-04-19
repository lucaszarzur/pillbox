"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma/client"
import { auth } from "@/auth"
import bcrypt from "bcryptjs"

export async function getSettingsData() {
  const pharmacies = await prisma.pharmacy.findMany({ orderBy: { priority: "asc" } })
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true } })
  return JSON.parse(JSON.stringify({ pharmacies, users }))
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) throw new Error("Usuário não encontrado")

  const valid = await bcrypt.compare(currentPassword, user.password)
  if (!valid) throw new Error("Senha atual incorreta")

  if (newPassword.length < 6) throw new Error("Nova senha deve ter ao menos 6 caracteres")

  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: await bcrypt.hash(newPassword, 12) },
  })
}

export async function changeMomPassword(newPassword: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")

  if (newPassword.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres")

  const mom = await prisma.user.findFirst({ where: { role: "DEPENDENT" } })
  if (!mom) throw new Error("Usuário dependente não encontrado")

  await prisma.user.update({
    where: { id: mom.id },
    data: { password: await bcrypt.hash(newPassword, 12) },
  })
}

export async function updateMomName(name: string) {
  const mom = await prisma.user.findFirst({ where: { role: "DEPENDENT" } })
  if (!mom) throw new Error("Usuário dependente não encontrado")
  await prisma.user.update({ where: { id: mom.id }, data: { name: name.trim() } })
  revalidatePath("/manager/settings")
}

export async function updatePharmacy(id: string, data: { name: string; searchUrlTemplate: string; priority: number; isActive: boolean }) {
  await prisma.pharmacy.update({ where: { id }, data })
  revalidatePath("/manager/settings")
  revalidatePath("/manager/quotation")
  revalidatePath("/manager/purchases")
}

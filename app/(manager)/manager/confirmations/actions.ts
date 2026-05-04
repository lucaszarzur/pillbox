"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma/client"
import { auth } from "@/auth"

export async function getConfirmations() {
  const data = await prisma.stockConfirmation.findMany({
    orderBy: { confirmedAt: "desc" },
    take: 100,
    include: {
      confirmedBy: { select: { name: true } },
      stock: {
        include: {
          presentation: {
            include: { medication: { select: { name: true } } },
          },
        },
      },
    },
  })
  return JSON.parse(JSON.stringify(data))
}

export async function deleteConfirmations(ids: string[]) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  if (!ids.length) return
  await prisma.stockConfirmation.deleteMany({ where: { id: { in: ids } } })
  revalidatePath("/manager/confirmations")
  revalidatePath("/manager/dashboard")
}

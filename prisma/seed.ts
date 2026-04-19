import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const pharmacies = [
  { name: "Pague Menos",    baseUrl: "https://www.paguemenos.com.br",   searchUrlTemplate: "https://www.paguemenos.com.br/busca?termo={query}",                              priority: 1 },
  { name: "Preço Popular",  baseUrl: "https://www.precopopular.com.br",  searchUrlTemplate: "https://www.precopopular.com.br/{query}/search?_q={query}&map=ft",              priority: 2 },
  { name: "CallFarma",      baseUrl: "https://www.callfarma.com.br",     searchUrlTemplate: "https://www.callfarma.com.br/busca/{slug}",                                     priority: 3 },
  { name: "Ultrafarma",     baseUrl: "https://www.ultrafarma.com.br",    searchUrlTemplate: "https://www.ultrafarma.com.br/busca?q={query}",                                 priority: 4 },
]

async function main() {
  const managerPassword = await bcrypt.hash("admin123", 12)
  await prisma.user.upsert({
    where: { email: "lucas12zarzur@gmail.com" },
    update: {},
    create: {
      email: "lucas12zarzur@gmail.com",
      name: "Lucas",
      role: "MANAGER",
      password: managerPassword,
      profile: { create: { simplifiedMode: false } },
    },
  })

  const momPassword = await bcrypt.hash("mae123", 12)
  await prisma.user.upsert({
    where: { email: "mae@remedio.app" },
    update: {},
    create: {
      email: "mae@remedio.app",
      name: "Nome da Mãe",
      role: "DEPENDENT",
      password: momPassword,
      profile: { create: { simplifiedMode: true } },
    },
  })

  for (const ph of pharmacies) {
    await prisma.pharmacy.upsert({
      where: { name: ph.name },
      update: { baseUrl: ph.baseUrl, searchUrlTemplate: ph.searchUrlTemplate, priority: ph.priority },
      create: ph,
    })
  }

  console.log("✅ Seed concluído")
  console.log("   Manager: lucas12zarzur@gmail.com / admin123")
  console.log("   Mãe:     mae@remedio.app / mae123")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

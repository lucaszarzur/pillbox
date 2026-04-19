import { auth } from "@/auth"
import { prisma } from "@/lib/prisma/client"
import Link from "next/link"
import InstallPwaButton from "@/components/InstallPwaButton"

export default async function MomHomePage() {
  const session = await auth()
  const name = session?.user?.name?.split(" ")[0] ?? "Olá"

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  })

  const lastConfirmation = await prisma.stockConfirmation.findFirst({
    where: { confirmedById: session?.user?.id },
    orderBy: { confirmedAt: "desc" },
    select: { confirmedAt: true },
  })

  const lastAgo = lastConfirmation
    ? Math.floor((Date.now() - new Date(lastConfirmation.confirmedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="min-h-screen flex flex-col px-6 py-10 max-w-sm mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Olá, {name}!</h1>
        <p className="text-gray-500 text-sm capitalize">{today}</p>
      </div>

      <div className="flex-1 space-y-4">
        <p className="text-base">Como estão seus remédios hoje?</p>

        <Link
          href="/mom/confirm"
          className="block w-full bg-gray-900 text-white text-center rounded-xl py-4 text-base font-medium"
        >
          Confirmar situação agora
        </Link>

        {lastAgo !== null && (
          <p className="text-sm text-gray-400 text-center">
            {lastAgo === 0 ? "Você confirmou hoje 👍" : `Última confirmação: há ${lastAgo} dia(s)`}
          </p>
        )}
      </div>

      <div className="mt-8">
        <Link
          href="/mom/stock"
          className="block w-full bg-blue-50 border border-blue-100 text-blue-600 text-center rounded-xl py-3 text-sm font-medium"
        >
          Ver situação dos remédios
        </Link>
      </div>

      <div className="mt-4">
        <InstallPwaButton />
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        Suas respostas chegam direto para o Lucas.
      </p>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"

export default function InstallPwaButton() {
  const [prompt, setPrompt] = useState<Event & { prompt: () => void } | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as Event & { prompt: () => void })
    }
    window.addEventListener("beforeinstallprompt", handler)
    window.addEventListener("appinstalled", () => setInstalled(true))
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (installed || !prompt) return null

  return (
    <button
      onClick={() => prompt.prompt()}
      className="block w-full border border-gray-200 text-gray-500 text-center rounded-xl py-3 text-sm"
    >
      📲 Adicionar à tela inicial
    </button>
  )
}

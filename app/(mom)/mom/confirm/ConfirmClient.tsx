"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { submitConfirmation } from "./actions"
import { getMedsForConfirmation } from "./actions"

type Medication = Awaited<ReturnType<typeof getMedsForConfirmation>>[number]
type QStatus = "OK" | "LOW" | "CRITICAL"

interface MedState {
  id: string
  name: string
  dosage: string
  stockId: string | null
  unitsPerPackage: number
  status: QStatus | null
  quantity: string
  quantityMode: "units" | "boxes"
}

const STATUS_OPTIONS = [
  { value: "OK" as QStatus, label: "Ainda tá bem", color: "bg-green-50 border-green-400 text-green-800 active:bg-green-100" },
  { value: "LOW" as QStatus, label: "Tá ficando pouco", color: "bg-yellow-50 border-yellow-400 text-yellow-800 active:bg-yellow-100" },
  { value: "CRITICAL" as QStatus, label: "Acabou / quase acabou", color: "bg-red-50 border-red-400 text-red-800 active:bg-red-100" },
]

export default function ConfirmClient({ medications }: { medications: Medication[] }) {
  const router = useRouter()
  const [step, setStep] = useState<"filling" | "review" | "done">("filling")
  const [current, setCurrent] = useState(0)
  const [meds, setMeds] = useState<MedState[]>(
    medications.map((m) => ({
      id: m.id,
      name: m.name,
      dosage: m.presentations[0]?.dosage ?? "",
      stockId: m.presentations[0]?.stock?.id ?? null,
      unitsPerPackage: m.presentations[0]?.unitsPerPackage ?? 1,
      status: null,
      quantity: "",
      quantityMode: "units",
    }))
  )
  const [generalNote, setGeneralNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const med = meds[current]
  const total = meds.length
  const allAnswered = meds.every((m) => m.status !== null)

  if (total === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-gray-500">Nenhum remédio cadastrado ainda.</p>
      </div>
    )
  }

  function setStatus(status: QStatus) {
    setMeds((prev) => prev.map((m, i) => i === current ? { ...m, status } : m))
    // Só avança automaticamente se OK — LOW/CRITICAL ficam na tela para preencher quantidade
    if (status === "OK" && current < total - 1) setCurrent((c) => c + 1)
  }

  function setQuantity(qty: string) {
    setMeds((prev) => prev.map((m, i) => i === current ? { ...m, quantity: qty } : m))
  }

  function setQuantityMode(mode: "units" | "boxes") {
    setMeds((prev) => prev.map((m, i) => i === current ? { ...m, quantityMode: mode, quantity: "" } : m))
  }

  function advance() {
    if (current < total - 1) setCurrent((c) => c + 1)
  }

  function quantityInUnits(m: MedState): number | undefined {
    if (!m.quantity) return undefined
    const n = Number(m.quantity)
    return m.quantityMode === "boxes" ? n * m.unitsPerPackage : n
  }

  async function handleSubmit() {
    setSubmitting(true)
    const entries = meds
      .filter((m) => m.status && m.stockId)
      .map((m) => ({
        stockId: m.stockId!,
        qualitativeStatus: m.status!,
        quantityInformed: quantityInUnits(m),
      }))
    await submitConfirmation(entries, generalNote)
    setStep("done")
    setSubmitting(false)
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-semibold mb-2">Obrigada!</h2>
        <p className="text-gray-500 text-sm mb-8">Lucas já recebeu as informações dos remédios.</p>
        <button
          onClick={() => router.push("/mom/home")}
          className="border border-gray-300 rounded-lg px-6 py-3 text-sm font-medium"
        >
          Voltar para o início
        </button>
      </div>
    )
  }

  if (step === "review") {
    return (
      <div className="min-h-screen flex flex-col px-6 py-10 max-w-sm mx-auto">
        <h2 className="text-xl font-semibold mb-1">Confirme suas respostas</h2>
        <p className="text-sm text-gray-500 mb-6">Toque em um item para corrigir.</p>

        <div className="flex-1 space-y-3 mb-6">
          {meds.map((m, i) => {
            const opt = STATUS_OPTIONS.find((o) => o.value === m.status)
            const qty = quantityInUnits(m)
            return (
              <button
                key={m.id}
                onClick={() => { setCurrent(i); setStep("filling") }}
                className="w-full text-left border rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium text-sm">{m.name} {m.dosage}</p>
                <p className="text-sm mt-0.5 text-gray-500">
                  {opt?.label ?? "Não respondido"}
                  {qty != null ? ` · ${qty} un.` : ""}
                </p>
              </button>
            )
          })}
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Alguma observação? (opcional)</label>
            <textarea
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-base resize-none focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="Ex: o médico trocou a dose, preciso de mais xarope..."
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
              rows={3}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-gray-900 text-white rounded-xl py-4 text-base font-medium disabled:opacity-50"
          >
            {submitting ? "Enviando..." : "Confirmar e enviar"}
          </button>
          <button
            onClick={() => { setCurrent(0); setStep("filling") }}
            className="w-full border border-gray-300 rounded-xl py-3 text-sm"
          >
            Corrigir respostas
          </button>
        </div>
      </div>
    )
  }

  const showQuantity = med.status === "LOW" || med.status === "CRITICAL"
  const previewQty = med.quantity
    ? med.quantityMode === "boxes"
      ? Number(med.quantity) * med.unitsPerPackage
      : Number(med.quantity)
    : null

  return (
    <div className="min-h-screen flex flex-col px-6 py-10 max-w-sm mx-auto">
      <div className="mb-8">
        <span className="text-sm text-gray-500 block mb-2">{current + 1} de {total}</span>
        <div className="flex gap-1">
          {meds.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                i < current ? "bg-gray-900" : i === current ? "bg-gray-400" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex-1">
        <p className="text-gray-500 text-sm mb-1">Como está o</p>
        <h2 className="text-2xl font-semibold mb-1">{med.name}</h2>
        <p className="text-gray-500 mb-8">{med.dosage}</p>

        <div className="space-y-3">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`w-full border-2 rounded-xl px-5 py-4 text-left font-medium text-base transition-all ${opt.color} ${
                med.status === opt.value ? "ring-2 ring-offset-2 ring-current" : ""
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {showQuantity && (
          <div className="mt-6">
            <p className="text-sm text-gray-500 mb-2">Quantas ainda tem? (opcional)</p>

            {/* Toggle unidades / caixas */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-2">
              <button
                type="button"
                onClick={() => setQuantityMode("units")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  med.quantityMode === "units" ? "bg-gray-900 text-white" : "bg-white text-gray-600"
                }`}
              >
                Unidades
              </button>
              <button
                type="button"
                onClick={() => setQuantityMode("boxes")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  med.quantityMode === "boxes" ? "bg-gray-900 text-white" : "bg-white text-gray-600"
                }`}
              >
                Caixas
              </button>
            </div>

            <input
              type="number"
              min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder={med.quantityMode === "boxes" ? "Ex: 2 caixas" : "Ex: 30 unidades"}
              value={med.quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {med.quantityMode === "boxes" && previewQty != null && (
              <p className="text-xs text-gray-400 mt-1">
                = {previewQty} unidades
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 space-y-2">
        {current > 0 && (
          <button
            onClick={() => setCurrent((c) => c - 1)}
            className="w-full border border-gray-300 rounded-xl py-3 text-sm"
          >
            Voltar
          </button>
        )}
        {showQuantity && current < total - 1 && (
          <button
            onClick={advance}
            className="w-full bg-gray-900 text-white rounded-xl py-4 text-base font-medium"
          >
            Próximo →
          </button>
        )}
        {allAnswered && current === total - 1 && (
          <button
            onClick={() => setStep("review")}
            className="w-full bg-gray-900 text-white rounded-xl py-4 text-base font-medium"
          >
            Revisar respostas →
          </button>
        )}
        {!allAnswered && !showQuantity && (
          <button
            onClick={() => setCurrent((c) => Math.min(c + 1, total - 1))}
            className="w-full text-gray-400 py-3 text-sm"
          >
            Pular este
          </button>
        )}
      </div>
    </div>
  )
}

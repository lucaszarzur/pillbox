"use client"

import { useState } from "react"
import { Modal, NumberInput, Button, Group, Text, SegmentedControl } from "@mantine/core"
import { adjustStock } from "@/app/(manager)/manager/stock/actions"
import { DURATION_SAFETY_FACTOR } from "@/lib/stockCalc"

type Target = {
  presentationId: string
  medicationName: string
  currentQty: number
  unitsPerPackage: number
  daysPerPackage: number | null
  form: string
}

const CONTAINER_LABEL: Record<string, string> = {
  COLIRIO: "frasco",
  POMADA: "tubo",
  LIQUIDO: "frasco",
}

function pluralize(n: number, word: string) {
  return n === 1 ? word : `${word}s`
}

export default function StockAdjustForm({
  open,
  target,
  onClose,
}: {
  open: boolean
  target: Target
  onClose: () => void
}) {
  const isDurationMode = !!target.daysPerPackage && target.daysPerPackage > 0

  const [mode, setMode] = useState<"units" | "boxes">("units")
  const [quantity, setQuantity] = useState(Math.max(0, Math.round(target.currentQty)))
  const [boxes, setBoxes] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const finalQty = isDurationMode
    ? quantity
    : mode === "units"
    ? quantity
    : boxes * target.unitsPerPackage

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (finalQty < 0) { setError("Quantidade não pode ser negativa."); return }
    setLoading(true)
    setError("")
    try {
      await adjustStock(target.presentationId, finalQty)
      onClose()
    } catch {
      setError("Erro ao ajustar. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const containerLabel = CONTAINER_LABEL[target.form] ?? "unidade"
  const currentDaysRemaining = isDurationMode
    ? Math.round(target.currentQty * (target.daysPerPackage as number) * DURATION_SAFETY_FACTOR)
    : null
  const previewDays = isDurationMode
    ? Math.round(quantity * (target.daysPerPackage as number) * DURATION_SAFETY_FACTOR)
    : null

  return (
    <Modal opened={open} onClose={onClose} title="Ajustar estoque" size="sm" centered>
      <form onSubmit={handleSubmit}>
        <Text size="sm" c="dimmed" mb="md">{target.medicationName}</Text>

        {isDurationMode ? (
          <NumberInput
            label={`Quantos ${pluralize(2, containerLabel)} você tem agora?`}
            min={0}
            step={1}
            value={quantity}
            onChange={(v) => setQuantity(Number(v))}
            description={
              currentDaysRemaining !== null
                ? `Estimativa atual: ~${currentDaysRemaining} dia(s) restantes · Após ajuste: ~${previewDays} dia(s)`
                : undefined
            }
            autoFocus
          />
        ) : (
          <>
            <SegmentedControl
              fullWidth
              mb="md"
              value={mode}
              onChange={(v) => setMode(v as "units" | "boxes")}
              data={[
                { value: "units", label: "Por unidades" },
                { value: "boxes", label: "Por caixas" },
              ]}
            />

            {mode === "units" ? (
              <NumberInput
                label="Quantidade (unidades)"
                min={0}
                step={1}
                value={quantity}
                onChange={(v) => setQuantity(Number(v))}
                description={`Estoque teórico atual: ${Math.round(target.currentQty)} un`}
                autoFocus
              />
            ) : (
              <NumberInput
                label="Quantidade de caixas"
                min={1}
                step={1}
                value={boxes}
                onChange={(v) => setBoxes(Number(v))}
                description={`${boxes} cx × ${target.unitsPerPackage} un = ${finalQty} unidades`}
                autoFocus
              />
            )}
          </>
        )}

        {error && <Text c="red" size="sm" mt="sm">{error}</Text>}
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Confirmar</Button>
        </Group>
      </form>
    </Modal>
  )
}

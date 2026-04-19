"use client"

import { useState } from "react"
import { Modal, NumberInput, Button, Group, Text, SegmentedControl } from "@mantine/core"
import { adjustStock } from "@/app/(manager)/manager/stock/actions"

type Target = { presentationId: string; medicationName: string; currentQty: number; unitsPerPackage: number }

export default function StockAdjustForm({
  open,
  target,
  onClose,
}: {
  open: boolean
  target: Target
  onClose: () => void
}) {
  const [mode, setMode] = useState<"units" | "boxes">("units")
  const [quantity, setQuantity] = useState(Math.round(target.currentQty))
  const [boxes, setBoxes] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const finalQty = mode === "units" ? quantity : boxes * target.unitsPerPackage

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

  return (
    <Modal opened={open} onClose={onClose} title="Ajustar estoque" size="sm" centered>
      <form onSubmit={handleSubmit}>
        <Text size="sm" c="dimmed" mb="md">{target.medicationName}</Text>

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

        {error && <Text c="red" size="sm" mt="sm">{error}</Text>}
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Confirmar</Button>
        </Group>
      </form>
    </Modal>
  )
}

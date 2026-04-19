"use client"

import { useState } from "react"
import { Modal, NumberInput, Button, Group, Text } from "@mantine/core"
import { adjustStock } from "@/app/(manager)/manager/stock/actions"

type Target = { presentationId: string; medicationName: string; currentQty: number }

export default function StockAdjustForm({
  open,
  target,
  onClose,
}: {
  open: boolean
  target: Target
  onClose: () => void
}) {
  const [quantity, setQuantity] = useState(Math.round(target.currentQty))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (quantity < 0) { setError("Quantidade não pode ser negativa."); return }
    setLoading(true)
    setError("")
    try {
      await adjustStock(target.presentationId, quantity)
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
        <NumberInput
          label="Quantidade atual (unidades)"
          min={0}
          step={1}
          value={quantity}
          onChange={(v) => setQuantity(Number(v))}
          description={`Estoque teórico atual: ${Math.round(target.currentQty)} un`}
          autoFocus
        />
        {error && <Text c="red" size="sm" mt="sm">{error}</Text>}
        <Group justify="flex-end" mt="lg">
          <Button variant="subtle" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Confirmar</Button>
        </Group>
      </form>
    </Modal>
  )
}

"use client"

import { useState } from "react"
import {
  Stack, Title, Text, Button, Group, Table, Badge, NumberInput,
  Paper, Tabs, Select, Modal, TextInput, Textarea,
} from "@mantine/core"
import { createPurchase, deletePurchase, getPurchasePageData } from "./actions"

type Data = Awaited<ReturnType<typeof getPurchasePageData>>
type Purchase = Data["purchases"][number]

interface PurchaseItem {
  presentationId: string
  quantityPackages: number | ""
  unitPrice: number | ""
}

function NewPurchaseForm({ data, onSaved }: { data: Data; onSaved: () => void }) {
  const [pharmacyId, setPharmacyId] = useState<string | null>(null)
  const [date, setDate] = useState(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${dd}`
  })
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<PurchaseItem[]>(
    data.medications
      .filter((m: Data["medications"][number]) => m.presentations[0])
      .map((m: Data["medications"][number]) => ({ presentationId: m.presentations[0].id, quantityPackages: "", unitPrice: "" }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function updateItem(presentationId: string, field: keyof PurchaseItem, value: unknown) {
    setItems((prev) => prev.map((i) => i.presentationId === presentationId ? { ...i, [field]: value } : i))
  }

  const filledItems = items.filter((i) => i.quantityPackages !== "" && i.unitPrice !== "")

  async function handleSave() {
    if (!pharmacyId) { setError("Selecione a farmácia."); return }
    if (!filledItems.length) { setError("Preencha ao menos um item."); return }
    setSaving(true)
    setError("")
    try {
      // Combina a data selecionada com o horário atual local
      const [y, m, d] = date.split("-")
      const now = new Date()
      const purchaseDateTime = `${y}-${m}-${d}T${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`

      await createPurchase(
        pharmacyId,
        purchaseDateTime,
        filledItems.map((i) => ({
          presentationId: i.presentationId,
          quantityPackages: Number(i.quantityPackages),
          unitPrice: Number(i.unitPrice),
        })),
        notes
      )
      onSaved()
    } catch {
      setError("Erro ao salvar compra.")
    } finally {
      setSaving(false)
    }
  }

  const total = filledItems.reduce((sum, i) => sum + Number(i.quantityPackages) * Number(i.unitPrice), 0)

  return (
    <Stack gap="md">
      <Group gap="md" align="flex-end">
        <Select
          label="Farmácia"
          placeholder="Selecione"
          data={data.pharmacies.map((p: Data["pharmacies"][number]) => ({ value: p.id, label: p.name }))}
          value={pharmacyId}
          onChange={setPharmacyId}
          style={{ width: 220 }}
          required
        />
        <div>
          <Text size="sm" fw={500} mb={4}>Data da compra</Text>
          <Group gap="xs">
            <Select
              placeholder="Dia"
              data={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1).padStart(2, "0"), label: String(i + 1) }))}
              value={date.split("-")[2] ?? null}
              onChange={(v) => setDate((d) => { const [y, m] = d.split("-"); return `${y}-${m}-${v ?? "01"}` })}
              style={{ width: 80 }}
            />
            <Select
              placeholder="Mês"
              data={["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((l, i) => ({
                value: String(i + 1).padStart(2, "0"), label: l,
              }))}
              value={date.split("-")[1] ?? null}
              onChange={(v) => setDate((d) => { const [y, , dd] = d.split("-"); return `${y}-${v ?? "01"}-${dd}` })}
              style={{ width: 90 }}
            />
            <Select
              placeholder="Ano"
              data={Array.from({ length: 5 }, (_, i) => { const y = new Date().getFullYear() - i; return { value: String(y), label: String(y) } })}
              value={date.split("-")[0] ?? null}
              onChange={(v) => setDate((d) => { const [, m, dd] = d.split("-"); return `${v ?? "2025"}-${m}-${dd}` })}
              style={{ width: 100 }}
            />
          </Group>
        </div>
      </Group>

      <Table withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Medicamento</Table.Th>
            <Table.Th>Caixas</Table.Th>
            <Table.Th>Preço por caixa</Table.Th>
            <Table.Th>Subtotal</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.medications.map((med: Data["medications"][number]) => {
            const pres = med.presentations[0]
            if (!pres) return null
            const item = items.find((i) => i.presentationId === pres.id)
            if (!item) return null
            const subtotal = item.quantityPackages !== "" && item.unitPrice !== ""
              ? Number(item.quantityPackages) * Number(item.unitPrice)
              : null

            return (
              <Table.Tr key={med.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>{med.name}</Text>
                  <Text size="xs" c="dimmed">{pres.dosage} · {pres.unitsPerPackage} un/cx</Text>
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={1}
                    placeholder="0"
                    value={item.quantityPackages}
                    onChange={(v) => updateItem(pres.id, "quantityPackages", v)}
                    style={{ width: 80 }}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={0}
                    step={0.01}
                    decimalScale={2}
                    prefix="R$ "
                    placeholder="0,00"
                    value={item.unitPrice}
                    onChange={(v) => updateItem(pres.id, "unitPrice", v)}
                    style={{ width: 130 }}
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c={subtotal ? "dark" : "dimmed"}>
                    {subtotal ? `R$ ${subtotal.toFixed(2)}` : "—"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>

      <Group justify="space-between" align="flex-start">
        <Textarea
          label="Observações"
          placeholder="Ex: promoção leve 3 pague 2..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{ flex: 1 }}
        />
        <Paper withBorder p="sm" radius="md" style={{ minWidth: 180 }}>
          <Text size="xs" c="dimmed">Total da compra</Text>
          <Text size="xl" fw={700}>R$ {total.toFixed(2)}</Text>
          <Text size="xs" c="dimmed">{filledItems.length} item(s)</Text>
        </Paper>
      </Group>

      {error && <Text c="red" size="sm">{error}</Text>}

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={saving}>Registrar compra</Button>
      </Group>
    </Stack>
  )
}

function PurchaseHistory({ purchases }: { purchases: Purchase[] }) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deletePurchase(deleteId)
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  if (!purchases.length) {
    return <Text c="dimmed">Nenhuma compra registrada ainda.</Text>
  }

  return (
    <>
      <Stack gap="md">
        {purchases.map((p) => {
          const date = p.purchaseDate
            ? new Date(p.purchaseDate).toLocaleDateString("pt-BR")
            : new Date(p.createdAt).toLocaleDateString("pt-BR")
          const total = p.items.reduce(
            (sum: number, i: { quantityPackages: number; unitPrice: number }) => sum + Number(i.quantityPackages) * Number(i.unitPrice), 0
          )
          const pharmacyName = p.items[0]?.pharmacy?.name ?? "—"

          return (
            <Paper key={p.id} withBorder p="md" radius="md">
              <Group justify="space-between" mb="xs">
                <div>
                  <Text fw={600} size="sm">{date} · {pharmacyName}</Text>
                  <Text size="xs" c="dimmed">{p.items.length} item(s)</Text>
                </div>
                <Group gap="xs">
                  <Text fw={700}>R$ {total.toFixed(2)}</Text>
                  <Button size="xs" variant="subtle" color="red" onClick={() => setDeleteId(p.id)}>
                    Excluir
                  </Button>
                </Group>
              </Group>
              <Stack gap={4}>
                {p.items.map((item: {
                  id: string
                  presentation: { medication: { name: string }; dosage?: string }
                  quantityPackages: number
                  unitPrice: number
                }) => (
                  <Group key={item.id} justify="space-between">
                    <Text size="xs">{item.presentation.medication.name}</Text>
                    <Text size="xs" c="dimmed">
                      {item.quantityPackages}cx × R$ {Number(item.unitPrice).toFixed(2)}
                    </Text>
                  </Group>
                ))}
              </Stack>
              {p.notes && <Text size="xs" c="dimmed" mt="xs">"{p.notes}"</Text>}
            </Paper>
          )
        })}
      </Stack>

      <Modal opened={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir compra" size="sm" centered>
        <Text size="sm" mb="md">
          Tem certeza? O estoque não será revertido automaticamente — ajuste manualmente se necessário.
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button color="red" loading={deleting} onClick={handleDelete}>Excluir</Button>
        </Group>
      </Modal>
    </>
  )
}

export default function PurchasesClient({ data }: { data: Data }) {
  const [tab, setTab] = useState<string | null>("new")
  const [key, setKey] = useState(0)

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Compras</Title>
        <Text c="dimmed" size="sm">Registre compras e atualize o estoque automaticamente</Text>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="new">Nova compra</Tabs.Tab>
          <Tabs.Tab value="history">Histórico</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="new" pt="md">
          <NewPurchaseForm
            key={key}
            data={data}
            onSaved={() => { setKey((k) => k + 1); setTab("history") }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <PurchaseHistory purchases={data.purchases} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

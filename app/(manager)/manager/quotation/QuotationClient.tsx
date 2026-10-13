"use client"

import { useState } from "react"
import { useMediaQuery } from "@mantine/hooks"
import {
  Stack, Title, Text, Button, Group, Table, Badge,
  NumberInput, Paper, Tabs, Select, Anchor, Modal, Alert,
} from "@mantine/core"
import { createQuotation, deleteQuotation, getQuotationPageData } from "./actions"

type Data = Awaited<ReturnType<typeof getQuotationPageData>>
type Pharmacy = Data["pharmacies"][number]
type Medication = Data["medications"][number]
type Quotation = Data["quotations"][number]

interface QuotationItemView {
  id: string
  pricePerPackage: string | null
  kitPrice: string | null
  kitQuantity: number | null
  shippingEstimate: string | null
  inStock: boolean | null
  notes: string | null
  pharmacy: { name: string }
  presentation: { id: string; dosage: string; medication: { name: string } }
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

function PriceBadge({ current, avg }: { current: number; avg: number | undefined }) {
  if (avg === undefined) return <span style={{ color: "var(--mantine-color-gray-5)", fontSize: 11 }}>sem histórico</span>
  const diff = ((current - avg) / avg) * 100
  const color = diff <= -5 ? "green" : diff >= 5 ? "red" : "gray"
  const label = diff <= -5 ? `↓${Math.abs(diff).toFixed(0)}%` : diff >= 5 ? `↑${diff.toFixed(0)}%` : "≈ médio"
  return (
    <Badge color={color} variant="light" size="xs" title={`Histórico: R$ ${avg.toFixed(2)}`}>
      {label}
    </Badge>
  )
}

interface PriceEntry {
  presentationId: string
  pharmacyId: string
  price: number | ""
  inStock: boolean | null
  notes: string
}

function buildSearchUrl(template: string, query: string) {
  const encoded = encodeURIComponent(query)
  const slug = query.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  return template.replaceAll("{query}", encoded).replaceAll("{slug}", slug)
}


function QuotationForm({ medications, pharmacies, priceAvg, onSaved }: {
  medications: Medication[]
  pharmacies: Pharmacy[]
  priceAvg: Record<string, number>
  onSaved: () => void
}) {
  const [entries, setEntries] = useState<PriceEntry[]>(() =>
    medications.flatMap((med) =>
      pharmacies.map((ph) => ({
        presentationId: med.presentations[0]?.id ?? "",
        pharmacyId: ph.id,
        price: "",
        inStock: null,
        notes: "",
      }))
    )
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function updateEntry(presentationId: string, pharmacyId: string, field: keyof PriceEntry, value: unknown) {
    setEntries((prev) =>
      prev.map((e) =>
        e.presentationId === presentationId && e.pharmacyId === pharmacyId
          ? { ...e, [field]: value }
          : e
      )
    )
  }

  function getEntry(presentationId: string, pharmacyId: string) {
    return entries.find((e) => e.presentationId === presentationId && e.pharmacyId === pharmacyId)
  }

  function bestPharmacy(presentationId: string): string | null {
    const withPrice = entries
      .filter((e) => e.presentationId === presentationId && e.price !== "")
      .sort((a, b) => Number(a.price) - Number(b.price))
    if (!withPrice.length) return null
    return pharmacies.find((p) => p.id === withPrice[0].pharmacyId)?.name ?? null
  }

  async function handleSave() {
    const filled = entries.filter((e) => e.price !== "" || e.inStock !== null)
    if (!filled.length) { setError("Preencha ao menos um preço."); return }
    setSaving(true)
    setError("")
    try {
      await createQuotation(
        filled.map((e) => ({
          presentationId: e.presentationId,
          pharmacyId: e.pharmacyId,
          pricePerPackage: e.price !== "" ? Number(e.price) : null,
          inStock: e.inStock,
          notes: e.notes,
        }))
      )
      onSaved()
    } catch {
      setError("Erro ao salvar cotação.")
    } finally {
      setSaving(false)
    }
  }

  if (!medications.length) {
    return <Text c="dimmed">Cadastre remédios antes de fazer uma cotação.</Text>
  }

  return (
    <Stack gap="lg">
      <Alert variant="light" color="blue">
        A coluna <strong>vs. histórico</strong> compara o preço digitado com a mediana dos últimos registros de cotações e compras. Aparece somente após 2 ou mais registros por farmácia.
      </Alert>
      {medications.map((med) => {
        const pres = med.presentations[0]
        if (!pres) return null
        const best = bestPharmacy(pres.id)
        const searchQuery = `${med.name} ${pres.dosage}`

        return (
          <Paper key={med.id} withBorder p="md" radius="md">
            <Group justify="space-between" mb="sm">
              <div>
                <Text fw={600}>{med.name} {pres.dosage}</Text>
                {pres.brand && <Text size="xs" c="dimmed">{pres.brand}</Text>}
              </div>
              {best && (
                <Badge color="green" variant="light" size="sm">Menor: {best}</Badge>
              )}
            </Group>

            <Table withColumnBorders withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Farmácia</Table.Th>
                  <Table.Th>Preço (R$)</Table.Th>
                  <Table.Th>vs. histórico</Table.Th>
                  <Table.Th>Tem estoque?</Table.Th>
                  <Table.Th>Buscar</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pharmacies.map((ph) => {
                  const entry = getEntry(pres.id, ph.id)
                  if (!entry) return null
                  const avg = priceAvg[`${pres.id}:${ph.name}`]
                  return (
                    <Table.Tr key={ph.id}>
                      <Table.Td fw={500} style={{ whiteSpace: "nowrap" }}>{ph.name}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          placeholder="0,00"
                          min={0}
                          step={0.01}
                          decimalScale={2}
                          prefix="R$ "
                          value={entry.price}
                          onChange={(v) => updateEntry(pres.id, ph.id, "price", v)}
                          style={{ width: 120 }}
                        />
                      </Table.Td>
                      <Table.Td>
                        {entry.price !== ""
                          ? <PriceBadge current={Number(entry.price)} avg={avg} />
                          : <Text size="xs" c="dimmed">—</Text>
                        }
                      </Table.Td>
                      <Table.Td>
                        <Select
                          size="xs"
                          placeholder="—"
                          data={[
                            { value: "true", label: "Sim" },
                            { value: "false", label: "Não" },
                          ]}
                          value={entry.inStock === null ? null : String(entry.inStock)}
                          onChange={(v) => updateEntry(pres.id, ph.id, "inStock", v === null ? null : v === "true")}
                          style={{ width: 90 }}
                          clearable
                        />
                      </Table.Td>
                      <Table.Td>
                        <Anchor
                          href={buildSearchUrl(ph.searchUrlTemplate, searchQuery)}
                          target="_blank"
                          size="xs"
                        >
                          Buscar →
                        </Anchor>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Paper>
        )
      })}

      {error && <Text c="red" size="sm">{error}</Text>}

      <Group justify="flex-end">
        <Button onClick={handleSave} loading={saving}>Salvar cotação</Button>
      </Group>

    </Stack>
  )
}

function QuotationNotes({ notes }: { notes: string | null }) {
  if (!notes) return <Text size="xs" c="dimmed">—</Text>
  const parts = notes.split(" · ")
  const links = parts.filter((p) => /^https?:\/\//.test(p))
  const text = parts.filter((p) => !/^https?:\/\//.test(p))
  return (
    <Stack gap={2}>
      {text.map((t, i) => (
        <Text key={i} size="xs" c={i === 0 ? undefined : "dimmed"}>{t}</Text>
      ))}
      {links.map((l) => (
        <Anchor key={l} href={l} target="_blank" rel="noopener noreferrer" size="xs">Abrir na loja ↗</Anchor>
      ))}
    </Stack>
  )
}

function QuotationDetail({ quotation, onClose }: { quotation: Quotation; onClose: () => void }) {
  const isMobile = useMediaQuery("(max-width: 48em)")
  const items = quotation.items as QuotationItemView[]

  const groups = new Map<string, { name: string; items: QuotationItemView[] }>()
  for (const item of items) {
    const name = `${item.presentation.medication.name} ${item.presentation.dosage}`.trim()
    const g = groups.get(item.presentation.id) ?? { name, items: [] }
    g.items.push(item)
    groups.set(item.presentation.id, g)
  }
  const sorted = [...groups.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((g) => ({
      ...g,
      // Sem estoque e sem preço vão para o fim
      items: [...g.items].sort((a, b) => {
        const rank = (i: QuotationItemView) => (i.inStock === false || !i.pricePerPackage ? 1 : 0)
        return rank(a) - rank(b) || Number(a.pricePerPackage ?? Infinity) - Number(b.pricePerPackage ?? Infinity)
      }),
    }))

  const date = new Date(quotation.createdAt).toLocaleDateString("pt-BR")

  return (
    <Modal opened onClose={onClose} title={`Cotação de ${date}`} size="xl" fullScreen={isMobile} centered>
      <Stack gap="lg">
        {sorted.map((g) => {
          const best = g.items.find((i) => i.inStock !== false && i.pricePerPackage)
          return (
            <Paper key={g.name} withBorder p="md" radius="md">
              <Group justify="space-between" mb="sm">
                <Text fw={600}>{g.name}</Text>
                {best && (
                  <Badge color="green" variant="light" size="sm">
                    Menor: {best.pharmacy.name} · {brl(Number(best.pricePerPackage))}
                  </Badge>
                )}
              </Group>
              <Table.ScrollContainer minWidth={560}>
                <Table withTableBorder verticalSpacing="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Farmácia</Table.Th>
                      <Table.Th>Preço</Table.Th>
                      <Table.Th>Frete (1 un.)</Table.Th>
                      <Table.Th>Observações</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {g.items.map((i) => {
                      const isBest = i.id === best?.id
                      const ship = i.shippingEstimate === null ? null : Number(i.shippingEstimate)
                      return (
                        <Table.Tr key={i.id} bg={isBest ? "var(--mantine-color-green-light)" : undefined}>
                          <Table.Td fw={500} style={{ whiteSpace: "nowrap" }}>{i.pharmacy.name}</Table.Td>
                          <Table.Td style={{ whiteSpace: "nowrap" }}>
                            <Text size="sm" fw={isBest ? 700 : 400} td={i.inStock === false ? "line-through" : undefined}>
                              {i.pricePerPackage ? brl(Number(i.pricePerPackage)) : "—"}
                            </Text>
                            {i.kitPrice && i.kitQuantity && (
                              <Text size="xs" c="dimmed">kit {i.kitQuantity} un. por {brl(Number(i.kitPrice))}</Text>
                            )}
                            {i.inStock === false && <Badge color="red" variant="light" size="xs">sem estoque</Badge>}
                          </Table.Td>
                          <Table.Td style={{ whiteSpace: "nowrap" }}>
                            {ship === null ? <Text size="xs" c="dimmed">—</Text> : ship === 0 ? "grátis" : brl(ship)}
                          </Table.Td>
                          <Table.Td><QuotationNotes notes={i.notes} /></Table.Td>
                        </Table.Tr>
                      )
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          )
        })}
      </Stack>
    </Modal>
  )
}

function QuotationHistory({ quotations }: { quotations: Quotation[] }) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewId, setViewId] = useState<string | null>(null)
  const viewing = quotations.find((q) => q.id === viewId)

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteQuotation(deleteId)
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  if (!quotations.length) {
    return <Text c="dimmed">Nenhuma cotação registrada ainda.</Text>
  }

  return (
    <>
      <Stack gap="md">
        {quotations.map((q) => {
          const date = new Date(q.createdAt).toLocaleDateString("pt-BR")
          const prices = q.items.filter((i: { pricePerPackage: number | null }) => i.pricePerPackage)
          const minPrice = prices.length ? Math.min(...prices.map((i: { pricePerPackage: number | null }) => Number(i.pricePerPackage))) : null
          const maxPrice = prices.length ? Math.max(...prices.map((i: { pricePerPackage: number | null }) => Number(i.pricePerPackage))) : null
          const items = q.items as QuotationItemView[]
          const medNames = [...new Set(items.map((i) => i.presentation.medication.name))]
          const pharmacyCount = new Set(items.map((i) => i.pharmacy.name)).size

          return (
            <Paper key={q.id} withBorder p="md" radius="md">
              <Group justify="space-between" mb="xs">
                <div>
                  <Text fw={600} size="sm">{date}</Text>
                  <Group gap={6}>
                    <Badge variant="light" size="sm">{q._count.items} preço(s)</Badge>
                    <Badge variant="light" color="gray" size="sm">{medNames.length} remédio(s) · {pharmacyCount} farmácia(s)</Badge>
                  </Group>
                </div>
                <Group gap="xs">
                  <Button size="xs" variant="light" onClick={() => setViewId(q.id)}>
                    Ver cotação
                  </Button>
                  <Button size="xs" variant="subtle" color="red" onClick={() => setDeleteId(q.id)}>
                    Excluir
                  </Button>
                </Group>
              </Group>
              <Text size="xs" mb={4}>{medNames.join(", ")}</Text>
              {minPrice !== null && (
                <Text size="xs" c="dimmed">
                  Faixa de preço: R$ {minPrice.toFixed(2)} – R$ {maxPrice?.toFixed(2)}
                </Text>
              )}
            </Paper>
          )
        })}
      </Stack>

      {viewing && <QuotationDetail quotation={viewing} onClose={() => setViewId(null)} />}

      <Modal opened={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir cotação" size="sm" centered>
        <Text size="sm" mb="md">Tem certeza que deseja excluir esta cotação?</Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button color="red" loading={deleting} onClick={handleDelete}>Excluir</Button>
        </Group>
      </Modal>
    </>
  )
}

export default function QuotationClient({ data }: { data: Data }) {
  const [tab, setTab] = useState<string | null>("new")
  const [key, setKey] = useState(0)

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Cotação</Title>
          <Text c="dimmed" size="sm">Compare preços entre farmácias</Text>
        </div>
      </Group>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="new">Nova cotação</Tabs.Tab>
          <Tabs.Tab value="history">Histórico</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="new" pt="md">
          <QuotationForm
            key={key}
            medications={data.medications}
            pharmacies={data.pharmacies}
            priceAvg={data.priceAvg}
            onSaved={() => { setKey((k) => k + 1); setTab("history") }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <QuotationHistory quotations={data.quotations} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

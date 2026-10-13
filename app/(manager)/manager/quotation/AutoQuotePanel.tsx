"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMediaQuery } from "@mantine/hooks"
import {
  Stack, Text, Group, Table, Badge, Paper, Button, Alert, Anchor, Modal, TextInput, ActionIcon, Loader,
} from "@mantine/core"
import {
  autoLinkMissing, getAutoQuoteData, removePharmacyProduct, runAutoQuotation, savePharmacyProduct, searchPharmacyProducts,
} from "./bestBuyActions"

type AutoData = Awaited<ReturnType<typeof getAutoQuoteData>>
type SearchResult = Awaited<ReturnType<typeof searchPharmacyProducts>>
type Candidate = SearchResult["candidates"][number]

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

function DeliveryBadge({ c }: { c: Candidate }) {
  if (c.deliveryDays === null) return null
  if (c.deliveryDays <= 2) {
    return <Badge size="xs" color="teal" variant="light">entrega em {c.deliveryDays || "<1"} dia(s)</Badge>
  }
  return (
    <Badge size="xs" color="orange" variant="light">
      vem de longe: {c.deliveryDays} dias{c.deliveryPrice !== null ? `, frete ${brl(c.deliveryPrice)}` : ""}
    </Badge>
  )
}

function LinkPicker({ target, onClose, onSaved }: {
  target: { presentation: AutoData["presentations"][number]; pharmacy: AutoData["pharmacies"][number] }
  onClose: () => void
  onSaved: () => void
}) {
  const isMobile = useMediaQuery("(max-width: 48em)")
  const [term, setTerm] = useState(target.presentation.searchTerm)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function search() {
    setLoading(true)
    setError("")
    try {
      setResult(await searchPharmacyProducts(target.presentation.id, target.pharmacy.id, term))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar na loja.")
    } finally {
      setLoading(false)
    }
  }

  async function choose(c: Candidate) {
    setSaving(c.sku)
    try {
      await savePharmacyProduct(target.presentation.id, target.pharmacy.id, { sku: c.sku, seller: c.seller, productName: c.productName, url: c.url })
      onSaved()
    } finally {
      setSaving(null)
    }
  }

  const good = result?.candidates.filter((c) => c.score > 0) ?? []
  const others = result?.candidates.filter((c) => c.score <= 0) ?? []

  const row = (c: Candidate) => (
    <Paper key={c.sku} withBorder p="xs" radius="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Anchor href={c.url} target="_blank" rel="noopener noreferrer" size="sm">{c.productName}</Anchor>
          <Group gap={6}>
            <Text size="sm" fw={600}>{brl(c.price)}</Text>
            {c.listPrice > c.price && <Text size="xs" c="dimmed" td="line-through">{brl(c.listPrice)}</Text>}
            <DeliveryBadge c={c} />
          </Group>
        </Stack>
        <Button size="xs" variant="light" onClick={() => choose(c)} loading={saving === c.sku}>Escolher</Button>
      </Group>
    </Paper>
  )

  return (
    <Modal opened onClose={onClose} size="lg" fullScreen={isMobile}
      title={`${target.presentation.name} — ${target.pharmacy.name}`}>
      <Stack gap="sm">
        <Group align="flex-end" wrap="nowrap">
          <TextInput label="Buscar na loja" value={term} onChange={(e) => setTerm(e.target.value)} style={{ flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") search() }} />
          <Button onClick={search} loading={loading}>Buscar</Button>
        </Group>
        {error && <Text c="red" size="sm">{error}</Text>}
        {result && !result.candidates.length && <Text size="sm" c="dimmed">Nada encontrado. Tente outro termo.</Text>}
        {good.length > 0 && <Text size="xs" c="dimmed">Combinam com a apresentação cadastrada (dose e quantidade):</Text>}
        {good.map(row)}
        {others.length > 0 && <Text size="xs" c="dimmed" mt="sm">Outros resultados:</Text>}
        {others.map(row)}
      </Stack>
    </Modal>
  )
}

export default function AutoQuotePanel({ data, onQuoted }: { data: AutoData; onQuoted: () => void }) {
  const router = useRouter()
  const [picker, setPicker] = useState<{ presentationId: string; pharmacyId: string } | null>(null)
  const [linking, setLinking] = useState(false)
  const [quoting, setQuoting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ color: string; text: string } | null>(null)

  const product = (presentationId: string, pharmacyId: string) =>
    data.products.find((p) => p.presentationId === presentationId && p.pharmacyId === pharmacyId)
  const missingCount = data.presentations.reduce(
    (n, p) => n + data.pharmacies.filter((ph) => !product(p.id, ph.id)).length, 0
  )
  const linkedCount = data.presentations.length * data.pharmacies.length - missingCount

  async function linkMissing() {
    setLinking(true)
    setMsg(null)
    try {
      const r = await autoLinkMissing()
      setMsg({ color: "blue", text: `${r.linked} de ${r.total} vínculo(s) feitos. Confira os nomes abaixo e troque o que não for o produto certo.` })
      router.refresh()
    } catch (e) {
      setMsg({ color: "red", text: e instanceof Error ? e.message : "Erro ao vincular." })
    } finally {
      setLinking(false)
    }
  }

  async function quote() {
    setQuoting(true)
    setMsg(null)
    try {
      const r = await runAutoQuotation()
      router.refresh()
      setMsg({
        color: r.failed.length ? "yellow" : "teal",
        text: `Cotação salva com ${r.saved} preço(s).${r.failed.length ? ` Falharam: ${r.failed.join("; ")}.` : ""}`,
      })
      onQuoted()
    } catch (e) {
      setMsg({ color: "red", text: e instanceof Error ? e.message : "Erro ao cotar." })
    } finally {
      setQuoting(false)
    }
  }

  async function remove(presentationId: string, pharmacyId: string) {
    setRemoving(`${presentationId}:${pharmacyId}`)
    try {
      await removePharmacyProduct(presentationId, pharmacyId)
      router.refresh()
    } finally {
      setRemoving(null)
    }
  }

  if (!data.pharmacies.length) {
    return <Alert variant="light">Nenhuma farmácia com cotação automática. Preencha o &quot;Host VTEX&quot; em Configurações → Farmácias.</Alert>
  }

  const pickerTarget = picker && {
    presentation: data.presentations.find((p) => p.id === picker.presentationId)!,
    pharmacy: data.pharmacies.find((p) => p.id === picker.pharmacyId)!,
  }

  return (
    <Stack gap="md">
      {!data.postalCode && (
        <Alert color="orange" variant="light">Cadastre o CEP de entrega em Configurações → Farmácias para simular frete e prazo.</Alert>
      )}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <div>
            <Text fw={600}>Preços de hoje direto das lojas</Text>
            <Text size="sm" c="dimmed">
              Consulta {data.pharmacies.map((p) => p.name).join(", ")} com o CEP {data.postalCode || "—"}: preço de 1, 2 e 3 caixas
              (pega promoções), estoque e frete. Salva como uma cotação e alimenta a aba Melhor compra.
            </Text>
          </div>
          <Group gap="xs">
            {missingCount > 0 && (
              <Button variant="light" onClick={linkMissing} loading={linking}>Vincular os {missingCount} que faltam</Button>
            )}
            <Button onClick={quote} loading={quoting} disabled={!linkedCount || !data.postalCode}>Cotar agora</Button>
          </Group>
        </Group>
        {(linking || quoting) && (
          <Group gap="xs" mt="sm"><Loader size="xs" /><Text size="xs" c="dimmed">Consultando as lojas, pode levar até 1 minuto…</Text></Group>
        )}
        {msg && <Alert color={msg.color} variant="light" mt="sm">{msg.text}</Alert>}
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb={4}>Produto de cada remédio em cada loja</Text>
        <Text size="xs" c="dimmed" mb="sm">
          A cotação usa sempre o produto vinculado. Prefira o que entrega em 1–2 dias: o mais barato às vezes vem de outro estado.
        </Text>
        <Table.ScrollContainer minWidth={220 + data.pharmacies.length * 200}>
          <Table withColumnBorders withTableBorder verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Remédio</Table.Th>
                {data.pharmacies.map((ph) => <Table.Th key={ph.id}>{ph.name}</Table.Th>)}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.presentations.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td fw={500}><Text size="sm">{p.name}</Text></Table.Td>
                  {data.pharmacies.map((ph) => {
                    const prod = product(p.id, ph.id)
                    const key = `${p.id}:${ph.id}`
                    return (
                      <Table.Td key={ph.id} style={{ verticalAlign: "top" }}>
                        {prod ? (
                          <Stack gap={2}>
                            <Anchor href={prod.url} target="_blank" rel="noopener noreferrer" size="xs" lineClamp={2}>{prod.productName}</Anchor>
                            <Group gap={4}>
                              <Button size="compact-xs" variant="subtle" onClick={() => setPicker({ presentationId: p.id, pharmacyId: ph.id })}>Trocar</Button>
                              <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Remover vínculo"
                                loading={removing === key} onClick={() => remove(p.id, ph.id)}>×</ActionIcon>
                            </Group>
                          </Stack>
                        ) : (
                          <Button size="compact-xs" variant="light" onClick={() => setPicker({ presentationId: p.id, pharmacyId: ph.id })}>Vincular</Button>
                        )}
                      </Table.Td>
                    )
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      {pickerTarget && (
        <LinkPicker target={pickerTarget} onClose={() => setPicker(null)}
          onSaved={() => { setPicker(null); router.refresh() }} />
      )}
    </Stack>
  )
}

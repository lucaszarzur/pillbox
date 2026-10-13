"use client"

import { useMemo, useState } from "react"
import {
  Stack, Text, Group, Table, Badge, NumberInput, Paper, Select, Button, Alert, SimpleGrid, Anchor, Accordion,
} from "@mantine/core"
import { optimizePurchase, suggestPackages, type Plan, type Order } from "@/lib/purchaseOptimizer"
import { checkOrderInCart, getBestBuyData } from "./bestBuyActions"

type BestBuyData = Awaited<ReturnType<typeof getBestBuyData>>

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const DEFAULT_COVERAGE_DAYS = 60

function initialQuantities(needs: BestBuyData["needs"], days: number) {
  return Object.fromEntries(
    needs.map((n) => [n.presentationId, suggestPackages({ current: n.current, dailyConsumption: n.dailyConsumption, unitsPerPackage: n.unitsPerPackage, days })])
  ) as Record<string, number>
}

function linkFromNotes(notes: string | null) {
  return notes?.split(" · ").find((p) => /^https?:\/\//.test(p)) ?? null
}

function CartCheck({ order }: { order: Order }) {
  const [state, setState] = useState<{ loading: boolean; text?: string; error?: string }>({ loading: false })

  async function check() {
    setState({ loading: true })
    try {
      const r = await checkOrderInCart(order.pharmacy.id, order.lines.map((l) => ({ presentationId: l.presentationId, quantity: l.unitsBought })))
      const ship = order.mode === "pickup"
        ? r.pickup ? "retirada grátis" : "sem retirada"
        : r.delivery ? (r.delivery.price === 0 ? "frete grátis" : `frete ${brl(r.delivery.price)}`) + ` · ${r.delivery.estimate.replace("bd", " dia(s) útil(eis)")}` : "não entrega no CEP"
      const total = r.subtotal + (order.mode === "delivery" && r.delivery ? r.delivery.price : 0)
      const limited = r.limited.map((l) => `a loja só aceita ${l.accepted} de ${l.asked} (${l.name})`).join("; ")
      setState({
        loading: false,
        text: `Carrinho: ${brl(r.subtotal)} · ${ship} = ${brl(total)}${r.available ? "" : " · item indisponível"}`,
        error: limited ? `Atenção: ${limited}. Divida a compra ou reduza a quantidade.` : undefined,
      })
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : "Erro ao consultar a loja." })
    }
  }

  return (
    <Stack gap={2}>
      <Button size="compact-xs" variant="subtle" onClick={check} loading={state.loading} w="fit-content" px={0}>
        Conferir no carrinho da loja
      </Button>
      {state.text && <Text size="xs" c="teal">{state.text}</Text>}
      {state.error && <Text size="xs" c="red">{state.error}</Text>}
    </Stack>
  )
}

function OrderBlock({ order }: { order: Order }) {
  const ph = order.pharmacy
  const shipLabel = order.mode === "pickup"
    ? `retirada grátis${ph.pickupNotes ? ` · ${ph.pickupNotes}` : ""}`
    : `${order.shipping === 0 ? "frete grátis" : `frete ${brl(order.shipping)}`}${ph.deliveryDays ? ` · ${ph.deliveryDays} dia(s) útil(eis)` : ""}`
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Text fw={600} size="sm">{ph.name}</Text>
        <Text size="sm" fw={600} style={{ whiteSpace: "nowrap" }}>{brl(order.subtotal + order.shipping)}</Text>
      </Group>
      {order.lines.map((l) => {
        const link = linkFromNotes(l.offer.notes ?? null)
        return (
          <Group key={l.presentationId} justify="space-between" wrap="nowrap" gap="xs">
            <Text size="xs">
              {l.unitsBought}× {link ? <Anchor href={link} target="_blank" rel="noopener noreferrer" size="xs">{l.name}</Anchor> : l.name}
              {l.unitsBought > l.quantity && <Text span size="xs" c="dimmed"> (kit, pediu {l.quantity})</Text>}
            </Text>
            <Text size="xs" style={{ whiteSpace: "nowrap" }}>{brl(l.total)}</Text>
          </Group>
        )
      })}
      <Text size="xs" c="dimmed">{shipLabel}</Text>
      {ph.vtex && <CartCheck order={order} />}
    </Stack>
  )
}

function PlanCard({ title, plan, badge, subtitle }: { title: string; plan: Plan | undefined; badge?: string; subtitle?: string }) {
  if (!plan) {
    return (
      <Paper withBorder p="md" radius="md">
        <Text fw={600}>{title}</Text>
        <Text size="sm" c="dimmed" mt="xs">Nenhuma opção com os preços atuais.</Text>
      </Paper>
    )
  }
  return (
    <Paper withBorder p="md" radius="md" style={badge ? { borderColor: "var(--mantine-color-teal-6)", borderWidth: 2 } : undefined}>
      <Group justify="space-between" mb={4}>
        <Text fw={600}>{title}</Text>
        {badge && <Badge color="teal" variant="light" size="sm">{badge}</Badge>}
      </Group>
      <Text fz={26} fw={700}>{brl(plan.total)}</Text>
      <Text size="xs" c="dimmed" mb="sm">
        {plan.orders.length} pedido(s){subtitle ? ` · ${subtitle}` : ""}
      </Text>
      <Stack gap="sm">
        {plan.orders.map((o) => <OrderBlock key={`${o.pharmacy.id}:${o.mode}`} order={o} />)}
      </Stack>
    </Paper>
  )
}

function Alternatives({ title, plans, best }: { title: string; plans: Plan[]; best: number }) {
  if (plans.length < 2) return null
  return (
    <Accordion.Item value={title}>
      <Accordion.Control><Text size="sm" fw={500}>{title}</Text></Accordion.Control>
      <Accordion.Panel>
        <Stack gap="xs">
          {plans.map((p, i) => (
            <Paper key={i} withBorder p="xs" radius="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600}>{brl(p.total)}</Text>
                <Group gap={4}>
                  <Text size="xs" c="dimmed">{p.orders.length} pedido(s)</Text>
                  {p.total > best && <Badge size="xs" variant="light" color="gray">+{brl(p.total - best)}</Badge>}
                </Group>
              </Group>
              {p.orders.map((o) => (
                <Text key={`${o.pharmacy.id}:${o.mode}`} size="xs">
                  <b>{o.pharmacy.name}</b> {o.lines.map((l) => `${l.unitsBought}× ${l.name}`).join(", ")} — {brl(o.subtotal)} ·{" "}
                  {o.mode === "pickup" ? "retirada" : o.shipping === 0 ? "frete grátis" : `frete ${brl(o.shipping)}`}
                </Text>
              ))}
            </Paper>
          ))}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  )
}

export default function BestBuyPanel({ initial }: { initial: BestBuyData }) {
  const [data, setData] = useState(initial)
  const [coverage, setCoverage] = useState(DEFAULT_COVERAGE_DAYS)
  const [quantities, setQuantities] = useState(() => initialQuantities(initial.needs, DEFAULT_COVERAGE_DAYS))
  const [loadingDays, setLoadingDays] = useState(false)

  async function changeDays(v: string | null) {
    if (!v) return
    setLoadingDays(true)
    try {
      setData(await getBestBuyData(Number(v)))
    } finally {
      setLoadingDays(false)
    }
  }

  const result = useMemo(() => {
    const needs = data.needs.map((n) => ({ presentationId: n.presentationId, name: n.name, quantity: quantities[n.presentationId] ?? 0 }))
    return optimizePurchase(needs, data.offers, data.pharmacies)
  }, [data, quantities])

  const offersByPharmacy = new Set(data.offers.map((o) => o.pharmacyId))
  const noRule = data.pharmacies.filter(
    (p) =>
      offersByPharmacy.has(p.id) &&
      p.shippingCost === null &&
      !p.pickupAvailable &&
      !data.offers.some((o) => o.pharmacyId === p.id && o.shippingEstimate !== null)
  )
  const anyQuantity = Object.values(quantities).some((q) => q > 0)
  const bestDelivery = result.delivery[0]
  const bestPickup = result.withPickup[0]
  const pickupWorth = bestPickup && bestDelivery && bestPickup.total < bestDelivery.total - 0.009
  const lastQuote = data.offers.reduce<string | null>((max, o) => (!max || o.quotedAt > max ? o.quotedAt : max), null)

  return (
    <Stack gap="lg">
      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" gap="md" wrap="wrap">
          <NumberInput label="Cobrir quantos dias" value={coverage} min={7} max={365} step={15} w={150}
            onChange={(v) => setCoverage(Number(v) || DEFAULT_COVERAGE_DAYS)} />
          <Button variant="light" onClick={() => setQuantities(initialQuantities(data.needs, coverage))}>Sugerir quantidades</Button>
          <Select label="Usar preços dos últimos" value={String(data.days)} onChange={changeDays} w={170} disabled={loadingDays}
            data={[{ value: "7", label: "7 dias" }, { value: "14", label: "14 dias" }, { value: "30", label: "30 dias" }, { value: "90", label: "90 dias" }]} />
        </Group>
        <Text size="xs" c="dimmed" mt="xs">
          {lastQuote
            ? `${data.offers.length} preço(s) de cotações recentes · última em ${new Date(lastQuote).toLocaleDateString("pt-BR")}. Para preços de hoje, use "Cotar automaticamente".`
            : "Nenhuma cotação no período. Use \"Cotar automaticamente\" ou lance uma cotação manual."}
        </Text>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="sm">O que comprar</Text>
        <Table verticalSpacing={6}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Remédio</Table.Th>
              <Table.Th>Estoque</Table.Th>
              <Table.Th w={90}>Caixas</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.needs.map((n) => (
              <Table.Tr key={n.presentationId}>
                <Table.Td>
                  <Text size="sm">{n.name}</Text>
                  {!n.hasOffers && <Badge size="xs" color="gray" variant="light">sem preço no período</Badge>}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {n.daysRemaining === null ? "uso eventual" : `${Math.floor(n.daysRemaining)} dia(s)`}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <NumberInput size="xs" min={0} max={50} w={72} value={quantities[n.presentationId] ?? 0}
                    onChange={(v) => setQuantities((q) => ({ ...q, [n.presentationId]: Number(v) || 0 }))} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {noRule.length > 0 && (
        <Alert color="yellow" variant="light">
          Sem regra de frete, ficaram de fora: {noRule.map((p) => p.name).join(", ")}. Configure o frete ou a retirada em Configurações → Farmácias.
        </Alert>
      )}
      {result.missing.length > 0 && (
        <Alert color="orange" variant="light">
          Sem preço no período: {result.missing.map((m) => m.name).join(", ")}.
        </Alert>
      )}

      {!anyQuantity ? (
        <Text c="dimmed" size="sm">Informe a quantidade de caixas de pelo menos um remédio.</Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            <PlanCard title="Mais barato entregue" plan={bestDelivery} badge="recomendado" />
            <PlanCard title="Um pedido só" plan={result.singleOrder[0]}
              subtitle={result.singleOrder[0] && bestDelivery ? `+${brl(result.singleOrder[0].total - bestDelivery.total)}` : undefined} />
            {pickupWorth ? (
              <PlanCard title="Com retirada perto de casa" plan={bestPickup} subtitle={`economiza ${brl(bestDelivery.total - bestPickup.total)}`} />
            ) : (
              <Paper withBorder p="md" radius="md">
                <Text fw={600}>Com retirada perto de casa</Text>
                <Text size="sm" c="dimmed" mt="xs">Retirar não sai mais barato que a entrega desta vez.</Text>
              </Paper>
            )}
          </SimpleGrid>
          <Accordion variant="separated">
            <Alternatives title="Outras combinações com entrega" plans={result.delivery} best={bestDelivery?.total ?? 0} />
            <Alternatives title="Outras combinações com retirada" plans={result.withPickup} best={bestPickup?.total ?? 0} />
          </Accordion>
          <Text size="xs" c="dimmed">
            Testa todas as divisões entre farmácias com o frete e o mínimo para frete grátis de cada uma (Configurações → Farmácias),
            promoções por quantidade e kits. Preços de sites mudam: confira no carrinho antes de comprar.
          </Text>
        </>
      )}
    </Stack>
  )
}

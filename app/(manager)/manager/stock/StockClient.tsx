"use client"

import { useState, useEffect } from "react"
import { Table, Badge, Button, Text, Stack, Group, Modal, Timeline, Loader } from "@mantine/core"
import StockAdjustForm from "@/components/manager/StockAdjustForm"
import { getStockOverview, getStockHistory } from "./actions"

type Medication = Awaited<ReturnType<typeof getStockOverview>>[number]
type History = Awaited<ReturnType<typeof getStockHistory>>

function calcTheoreticalStock(medication: Medication) {
  const pres = medication.presentations[0]
  if (!pres?.stock) return null
  const rule = pres.consumptionRules[0]
  const stock = pres.stock
  const referenceQty = Number(stock.referenceQuantity)
  const daysElapsed = (Date.now() - new Date(stock.referenceDate).getTime()) / (1000 * 60 * 60 * 24)
  if (!rule) return { theoretical: referenceQty, daysRemaining: null, dailyConsumption: null }
  const dailyConsumption = Number(rule.unitsPerDose) * Number(rule.dosesPerDay)
  const theoretical = Math.max(0, referenceQty - dailyConsumption * daysElapsed)
  const daysRemaining = dailyConsumption > 0 ? theoretical / dailyConsumption : null
  return { theoretical, daysRemaining, dailyConsumption }
}

const statusLabel: Record<string, string> = { OK: "Tá bem", LOW: "Ficando pouco", CRITICAL: "Acabando" }
const statusColor: Record<string, string> = { OK: "green", LOW: "yellow", CRITICAL: "red" }

function HistoryModal({ stockId, medName, onClose }: { stockId: string; medName: string; onClose: () => void }) {
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStockHistory(stockId).then((h) => { setHistory(h); setLoading(false) })
  }, [stockId])

  type Event =
    | { date: string; type: "confirmation"; data: History["confirmations"][number] }
    | { date: string; type: "purchase"; data: History["purchases"][number] }

  const events: Event[] = []
  if (history) {
    for (const c of history.confirmations)
      events.push({ date: c.confirmedAt, type: "confirmation", data: c })
    for (const p of history.purchases)
      events.push({ date: p.purchase.purchaseDate ?? p.purchase.createdAt, type: "purchase", data: p })
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  return (
    <Modal opened onClose={onClose} title={`Histórico — ${medName}`} size="md" centered>
      {loading && <Group justify="center" py="xl"><Loader size="sm" /></Group>}

      {!loading && events.length === 0 && (
        <Text c="dimmed" size="sm">Nenhum evento registrado ainda.</Text>
      )}

      {!loading && events.length > 0 && (
        <Timeline bulletSize={20} lineWidth={2} mt="sm">
          {events.map((ev, i) => {
            const date = new Date(ev.date).toLocaleString("pt-BR", {
              day: "numeric", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })

            if (ev.type === "confirmation") {
              const c = ev.data as History["confirmations"][number]
              return (
                <Timeline.Item
                  key={i}
                  color={c.divergenceDetected ? "orange" : statusColor[c.qualitativeStatus]}
                  title={
                    <Group gap="xs">
                      <Text size="sm" fw={500}>Confirmação da mãe</Text>
                      {c.divergenceDetected && (
                        <Badge color="orange" size="xs" variant="filled">⚠ Divergência</Badge>
                      )}
                    </Group>
                  }
                >
                  <Text size="xs" c="dimmed">{date}</Text>
                  <Text size="xs" mt={2}>
                    {statusLabel[c.qualitativeStatus]}
                    {c.quantityInformed != null ? ` · ${Number(c.quantityInformed)} un informadas` : ""}
                  </Text>
                  {c.notes && <Text size="xs" c="dimmed" fs="italic">"{c.notes}"</Text>}
                </Timeline.Item>
              )
            }

            const p = ev.data as History["purchases"][number]
            return (
              <Timeline.Item
                key={i}
                color="blue"
                title={<Text size="sm" fw={500}>Compra — {p.pharmacy.name}</Text>}
              >
                <Text size="xs" c="dimmed">{date}</Text>
                <Text size="xs" mt={2}>
                  {p.quantityPackages} cx × R$ {Number(p.unitPrice).toFixed(2)}
                </Text>
              </Timeline.Item>
            )
          })}
        </Timeline>
      )}
    </Modal>
  )
}

type AdjustTarget = { presentationId: string; medicationName: string; currentQty: number; unitsPerPackage: number }
type HistoryTarget = { stockId: string; medName: string }

export default function StockClient({ medications }: { medications: Medication[] }) {
  const [adjustTarget, setAdjustTarget] = useState<AdjustTarget | null>(null)
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null)

  const rows = medications.map((med) => {
    const pres = med.presentations[0]
    const stock = pres?.stock
    const calc = calcTheoreticalStock(med)
    const lastConfirmation = stock?.confirmations[0]

    const daysColor = calc?.daysRemaining == null ? "gray"
      : calc.daysRemaining <= 10 ? "red"
      : calc.daysRemaining <= 30 ? "yellow"
      : "green"

    const confirmColor = lastConfirmation?.qualitativeStatus === "OK" ? "green"
      : lastConfirmation?.qualitativeStatus === "LOW" ? "yellow"
      : lastConfirmation?.qualitativeStatus === "CRITICAL" ? "red" : "gray"

    const confirmLabel = lastConfirmation?.qualitativeStatus === "OK" ? "OK"
      : lastConfirmation?.qualitativeStatus === "LOW" ? "Pouco"
      : lastConfirmation?.qualitativeStatus === "CRITICAL" ? "Crítico" : null

    const confirmAgo = lastConfirmation
      ? Math.floor((Date.now() - new Date(lastConfirmation.confirmedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null

    return (
      <Table.Tr key={med.id}>
        <Table.Td>
          <Text fw={500} size="sm">{med.name}</Text>
          <Text size="xs" c="dimmed">{pres?.dosage ?? "—"}</Text>
        </Table.Td>
        <Table.Td>
          {calc ? (
            <>
              <Text size="sm">{calc.theoretical.toFixed(0)} un</Text>
              {pres && pres.unitsPerPackage > 1 && (
                <Text size="xs" c="dimmed">≈ {Math.floor(calc.theoretical / pres.unitsPerPackage)} cx</Text>
              )}
            </>
          ) : <Text size="sm" c="dimmed">—</Text>}
        </Table.Td>
        <Table.Td>
          {calc?.daysRemaining != null
            ? <Badge color={daysColor} variant="light" size="sm">{Math.floor(calc.daysRemaining)} dias</Badge>
            : <Text size="sm" c="dimmed">—</Text>}
        </Table.Td>
        <Table.Td>
          <Text size="sm">{calc?.dailyConsumption != null ? `${calc.dailyConsumption.toFixed(1)} un/dia` : "—"}</Text>
        </Table.Td>
        <Table.Td>
          {confirmLabel ? (
            <Stack gap={2}>
              <Badge
                color={confirmColor}
                variant="light"
                size="sm"
                style={lastConfirmation?.divergenceDetected ? { outline: "1px solid orange" } : undefined}
              >
                {confirmLabel}{lastConfirmation?.divergenceDetected ? " ⚠" : ""}
              </Badge>
              <Text size="xs" c="dimmed">há {confirmAgo}d</Text>
            </Stack>
          ) : (
            <Text size="xs" c="dimmed">Sem confirmação</Text>
          )}
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <Button
              size="xs"
              variant="outline"
              onClick={() => pres && setAdjustTarget({
                presentationId: pres.id,
                medicationName: med.name,
                currentQty: calc?.theoretical ?? Number(stock?.referenceQuantity ?? 0),
                unitsPerPackage: pres.unitsPerPackage,
              })}
              disabled={!pres}
            >
              Ajustar
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => stock && setHistoryTarget({ stockId: stock.id, medName: med.name })}
              disabled={!stock}
            >
              Histórico
            </Button>
          </Group>
        </Table.Td>
      </Table.Tr>
    )
  })

  return (
    <Stack gap="md">
      <div>
        <Text size="xl" fw={600}>Estoque</Text>
        <Text size="sm" c="dimmed">{medications.length} medicamento(s) ativo(s)</Text>
      </div>

      <Table.ScrollContainer minWidth={650}>
        <Table striped highlightOnHover withTableBorder verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Medicamento</Table.Th>
              <Table.Th>Estoque teórico</Table.Th>
              <Table.Th>Dias restantes</Table.Th>
              <Table.Th>Consumo/dia</Table.Th>
              <Table.Th>Confirmação (mãe)</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {medications.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed" py="xl">Nenhum medicamento ativo.</Text>
                </Table.Td>
              </Table.Tr>
            ) : rows}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {adjustTarget && (
        <StockAdjustForm open={true} target={adjustTarget} onClose={() => setAdjustTarget(null)} />
      )}
      {historyTarget && (
        <HistoryModal
          stockId={historyTarget.stockId}
          medName={historyTarget.medName}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </Stack>
  )
}

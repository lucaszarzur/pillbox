"use client"

import { useState, useTransition } from "react"
import {
  Stack, Title, Text, Group, Select, Paper, Table, Badge,
  SimpleGrid, Divider, Loader,
} from "@mantine/core"
import { getReportData } from "./actions"

type Data = Awaited<ReturnType<typeof getReportData>>
type SpendingRow = Data["byMedication"][number]
type MedRow = Data["medications"][number]

const MONTHS = [
  { value: "0", label: "Janeiro" }, { value: "1", label: "Fevereiro" },
  { value: "2", label: "Março" }, { value: "3", label: "Abril" },
  { value: "4", label: "Maio" }, { value: "5", label: "Junho" },
  { value: "6", label: "Julho" }, { value: "7", label: "Agosto" },
  { value: "8", label: "Setembro" }, { value: "9", label: "Outubro" },
  { value: "10", label: "Novembro" }, { value: "11", label: "Dezembro" },
]

function calcTheoreticalDays(med: Data["medications"][number]) {
  const pres = med.presentations[0]
  if (!pres?.stock) return null
  const rule = pres.consumptionRules[0]
  if (!rule) return null
  const referenceQty = Number(pres.stock.referenceQuantity)
  const daysElapsed = (Date.now() - new Date(pres.stock.referenceDate).getTime()) / (1000 * 60 * 60 * 24)
  const dailyConsumption = Number(rule.unitsPerDose) * Number(rule.dosesPerDay)
  if (dailyConsumption === 0) return null
  const theoretical = Math.max(0, referenceQty - dailyConsumption * daysElapsed)
  return { theoretical, daysRemaining: theoretical / dailyConsumption, dailyConsumption }
}

export default function ReportClient({ initialData, initialYear, initialMonth }: {
  initialData: Data
  initialYear: number
  initialMonth: number
}) {
  const [year, setYear] = useState(String(initialYear))
  const [month, setMonth] = useState<string | null>(String(initialMonth))
  const [data, setData] = useState<Data>(initialData)
  const [pending, startTransition] = useTransition()

  function load(y: string, m: string | null) {
    startTransition(async () => {
      const result = await getReportData(Number(y), m !== null ? Number(m) : null)
      setData(result)
    })
  }

  function handleYear(v: string | null) {
    const y = v ?? year
    setYear(y)
    load(y, month)
  }

  function handleMonth(v: string | null) {
    setMonth(v)
    load(year, v)
  }

  const years = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - i
    return { value: String(y), label: String(y) }
  })

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Relatório</Title>
          <Text c="dimmed" size="sm">Gastos e situação do estoque</Text>
        </div>
        <Group gap="xs">
          <Select
            placeholder="Mês"
            data={MONTHS}
            value={month}
            onChange={handleMonth}
            clearable
            style={{ width: 130 }}
          />
          <Select
            data={years}
            value={year}
            onChange={handleYear}
            style={{ width: 90 }}
          />
          {pending && <Loader size="xs" />}
        </Group>
      </Group>

      {/* Resumo de gastos */}
      <div>
        <Text fw={600} size="sm" tt="uppercase" c="dimmed" mb="sm">Gastos no período</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mb="md">
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed">Total gasto</Text>
            <Text size="xl" fw={700}>R$ {data.grandTotal.toFixed(2)}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed">Compras realizadas</Text>
            <Text size="xl" fw={700}>{data.purchaseCount}</Text>
          </Paper>
          <Paper withBorder p="md" radius="md">
            <Text size="xs" c="dimmed">Medicamentos comprados</Text>
            <Text size="xl" fw={700}>{data.byMedication.length}</Text>
          </Paper>
        </SimpleGrid>

        {data.byMedication.length === 0 ? (
          <Text c="dimmed" size="sm">Nenhuma compra no período.</Text>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <div>
              <Text size="sm" fw={600} mb="xs">Por medicamento</Text>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Medicamento</Table.Th>
                    <Table.Th>Caixas</Table.Th>
                    <Table.Th>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.byMedication.map((row: SpendingRow) => (
                    <Table.Tr key={row.name}>
                      <Table.Td><Text size="sm">{row.name}</Text></Table.Td>
                      <Table.Td><Text size="sm">{row.totalPackages}</Text></Table.Td>
                      <Table.Td><Text size="sm" fw={500}>R$ {row.totalSpent.toFixed(2)}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>

            <div>
              <Text size="sm" fw={600} mb="xs">Por farmácia</Text>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Farmácia</Table.Th>
                    <Table.Th>Caixas</Table.Th>
                    <Table.Th>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.byPharmacy.map((row: SpendingRow) => (
                    <Table.Tr key={row.name}>
                      <Table.Td><Text size="sm">{row.name}</Text></Table.Td>
                      <Table.Td><Text size="sm">{row.totalPackages}</Text></Table.Td>
                      <Table.Td><Text size="sm" fw={500}>R$ {row.totalSpent.toFixed(2)}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </SimpleGrid>
        )}
      </div>

      <Divider />

      {/* Situação do estoque */}
      <div>
        <Text fw={600} size="sm" tt="uppercase" c="dimmed" mb="sm">Situação atual do estoque</Text>
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Medicamento</Table.Th>
              <Table.Th>Estoque teórico</Table.Th>
              <Table.Th>Consumo/dia</Table.Th>
              <Table.Th>Dias restantes</Table.Th>
              <Table.Th>Previsão de compra</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.medications.map((med: MedRow) => {
              const calc = calcTheoreticalDays(med)
              const pres = med.presentations[0]

              const daysColor = !calc?.daysRemaining ? "gray"
                : calc.daysRemaining <= 10 ? "red"
                : calc.daysRemaining <= 30 ? "yellow"
                : "green"

              const purchaseDate = calc?.daysRemaining
                ? new Date(Date.now() + calc.daysRemaining * 86400000).toLocaleDateString("pt-BR")
                : null

              return (
                <Table.Tr key={med.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{med.name}</Text>
                    <Text size="xs" c="dimmed">{pres?.dosage ?? "—"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{calc ? `${calc.theoretical.toFixed(0)} un` : "—"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{calc ? `${calc.dailyConsumption.toFixed(1)} un/dia` : "—"}</Text>
                  </Table.Td>
                  <Table.Td>
                    {calc?.daysRemaining != null
                      ? <Badge color={daysColor} variant="light" size="sm">{Math.floor(calc.daysRemaining)} dias</Badge>
                      : <Text size="sm" c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={daysColor === "red" ? "red" : undefined}>
                      {purchaseDate ?? "—"}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </div>
    </Stack>
  )
}

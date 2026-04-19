import { SimpleGrid, Paper, Text, Group, Badge, Stack, Title } from "@mantine/core"
import { getDashboardData } from "./actions"
import { generateAlerts } from "@/lib/alerts"

export default async function DashboardPage() {
  await generateAlerts()
  const { counts, stockList, lastConfirmation } = await getDashboardData()

  const confirmationAgo = lastConfirmation
    ? Math.floor((Date.now() - new Date(lastConfirmation.confirmedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Stack gap="xl">
      <div>
        <Title order={2}>Dashboard</Title>
        <Text c="dimmed" size="sm">Visão geral do estoque</Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">Críticos</Text>
          <Text size="xl" fw={700} c="red" mt={4}>{counts.critical}</Text>
          <Text size="xs" c="dimmed">acabam em menos de 15 dias</Text>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">Atenção</Text>
          <Text size="xl" fw={700} c="yellow" mt={4}>{counts.attention}</Text>
          <Text size="xs" c="dimmed">acabam em 15–30 dias</Text>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Text size="xs" tt="uppercase" fw={600} c="dimmed">OK</Text>
          <Text size="xl" fw={700} c="green" mt={4}>{counts.ok}</Text>
          <Text size="xs" c="dimmed">estoque adequado</Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="md">Estoque por medicamento</Text>
        <Stack gap="xs">
          {stockList.length === 0 && <Text c="dimmed" size="sm">Nenhum medicamento com estoque configurado.</Text>}
          {stockList.map((item: { name: string; days: number | null; status: string }) => (
            <Group key={item.name} justify="space-between">
              <Text size="sm">{item.name}</Text>
              <Badge
                color={item.status === "critical" ? "red" : item.status === "attention" ? "yellow" : "green"}
                variant="light"
                size="sm"
              >
                {item.days !== null ? `${item.days} dias` : "sem regra"}
              </Badge>
            </Group>
          ))}
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Text fw={600} mb="xs">Última confirmação da mãe</Text>
        {lastConfirmation ? (
          <Text size="sm" c="dimmed">
            {lastConfirmation.confirmedBy?.name ?? "Mãe"} confirmou há {confirmationAgo}d
            {lastConfirmation.notes ? ` · "${lastConfirmation.notes}"` : ""}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">Nenhuma confirmação registrada ainda.</Text>
        )}
      </Paper>
    </Stack>
  )
}

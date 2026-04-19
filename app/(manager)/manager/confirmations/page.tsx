import { prisma } from "@/lib/prisma/client"
import { Stack, Title, Text, Paper, Group, Badge, SimpleGrid, Tooltip } from "@mantine/core"

export default async function ConfirmationsPage() {
  const confirmations = await prisma.stockConfirmation.findMany({
    orderBy: { confirmedAt: "desc" },
    take: 100,
    include: {
      confirmedBy: { select: { name: true } },
      stock: {
        include: {
          presentation: {
            include: { medication: { select: { name: true } } },
          },
        },
      },
    },
  })

  // Agrupa por sessão (mesmo minuto + mesmo usuário)
  const groups = new Map<string, typeof confirmations>()
  for (const c of confirmations) {
    const key = new Date(c.confirmedAt).toISOString().slice(0, 16) + c.confirmedById
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }

  const sessions = Array.from(groups.values())

  const statusColor: Record<string, string> = { OK: "green", LOW: "yellow", CRITICAL: "red" }
  const statusLabel: Record<string, string> = { OK: "Tá bem", LOW: "Ficando pouco", CRITICAL: "Acabando" }

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Histórico de confirmações</Title>
        <Text c="dimmed" size="sm">Registros de situação informados pela mãe</Text>
      </div>

      {sessions.length === 0 && (
        <Text c="dimmed">Nenhuma confirmação registrada ainda.</Text>
      )}

      {sessions.map((group, idx) => {
        const first = group[0]
        const date = new Date(first.confirmedAt).toLocaleDateString("pt-BR", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        })
        const time = new Date(first.confirmedAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit", minute: "2-digit",
        })
        const hasCritical = group.some((c) => c.qualitativeStatus === "CRITICAL")
        const hasLow = group.some((c) => c.qualitativeStatus === "LOW")
        const hasDivergence = group.some((c) => c.divergenceDetected)

        return (
          <Paper key={idx} withBorder p="md" radius="md"
            style={hasDivergence ? { borderColor: "var(--mantine-color-orange-4)" } : undefined}
          >
            <Group justify="space-between" mb="sm">
              <div>
                <Group gap="xs">
                  <Text fw={600} size="sm" tt="capitalize">{date} às {time}</Text>
                  {hasDivergence && (
                    <Tooltip label="Uma ou mais quantidades divergem do estoque teórico em mais de 1 unidade">
                      <Badge color="orange" variant="filled" size="sm">⚠ Divergência</Badge>
                    </Tooltip>
                  )}
                </Group>
                <Text size="xs" c="dimmed">{first.confirmedBy?.name ?? "Mãe"}</Text>
              </div>
              <Badge
                color={hasCritical ? "red" : hasLow ? "yellow" : "green"}
                variant="light"
              >
                {hasCritical ? "Tem críticos" : hasLow ? "Tem poucos" : "Tudo OK"}
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
              {group.map((c) => (
                <Group
                  key={c.id}
                  gap="xs"
                  p="xs"
                  style={{
                    borderRadius: 6,
                    background: c.divergenceDetected ? "#fff3e0" : "#f8f9fa",
                    border: c.divergenceDetected ? "1px solid #ffb74d" : "1px solid transparent",
                  }}
                >
                  <Badge color={statusColor[c.qualitativeStatus]} variant="light" size="sm">
                    {statusLabel[c.qualitativeStatus]}
                  </Badge>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text size="xs" fw={500} truncate>
                      {c.stock.presentation.medication.name}
                    </Text>
                    {c.quantityInformed != null && (
                      <Text size="xs" c={c.divergenceDetected ? "orange" : "dimmed"}>
                        {Number(c.quantityInformed)} un informadas
                        {c.divergenceDetected ? " · diverge do teórico" : ""}
                      </Text>
                    )}
                  </div>
                </Group>
              ))}
            </SimpleGrid>

            {first.notes && (
              <Text size="xs" c="dimmed" mt="sm" fs="italic">"{first.notes}"</Text>
            )}
          </Paper>
        )
      })}
    </Stack>
  )
}

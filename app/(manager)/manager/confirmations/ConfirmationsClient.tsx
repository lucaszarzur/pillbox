"use client"

import { useMemo, useState } from "react"
import {
  Stack, Title, Text, Paper, Group, Badge, SimpleGrid, Tooltip, Button, Modal, ActionIcon,
} from "@mantine/core"
import { IconTrash } from "@tabler/icons-react"
import { deleteConfirmations, getConfirmations } from "./actions"

type Confirmation = Awaited<ReturnType<typeof getConfirmations>>[number]

export default function ConfirmationsClient({ initial }: { initial: Confirmation[] }) {
  const [confirmations, setConfirmations] = useState<Confirmation[]>(initial)
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null)
  const [deleting, setDeleting] = useState(false)

  const sessions = useMemo(() => {
    const groups = new Map<string, Confirmation[]>()
    for (const c of confirmations) {
      const key = new Date(c.confirmedAt).toISOString().slice(0, 16) + c.confirmedById
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(c)
    }
    return Array.from(groups.values())
  }, [confirmations])

  async function handleDelete() {
    if (!deleteIds) return
    setDeleting(true)
    try {
      await deleteConfirmations(deleteIds)
      const idSet = new Set(deleteIds)
      setConfirmations((prev) => prev.filter((c) => !idSet.has(c.id)))
      setDeleteIds(null)
    } finally {
      setDeleting(false)
    }
  }

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
        const ids = group.map((c) => c.id)

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
              <Group gap="xs">
                <Badge
                  color={hasCritical ? "red" : hasLow ? "yellow" : "green"}
                  variant="light"
                >
                  {hasCritical ? "Tem críticos" : hasLow ? "Tem poucos" : "Tudo OK"}
                </Badge>
                <Tooltip label="Excluir esta confirmação">
                  <ActionIcon variant="subtle" color="red" onClick={() => setDeleteIds(ids)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
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

      <Modal opened={!!deleteIds} onClose={() => setDeleteIds(null)} title="Excluir confirmação" size="sm" centered>
        <Text size="sm" mb="md">
          Tem certeza? Os {deleteIds?.length ?? 0} registro(s) serão removidos. O estoque não será revertido — ajuste manualmente se necessário.
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={() => setDeleteIds(null)}>Cancelar</Button>
          <Button color="red" loading={deleting} onClick={handleDelete}>Excluir</Button>
        </Group>
      </Modal>
    </Stack>
  )
}

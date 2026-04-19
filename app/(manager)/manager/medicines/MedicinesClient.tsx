"use client"

import { useState } from "react"
import { Button, Badge, Table, Text, Group, Stack, Modal, ActionIcon, Tooltip } from "@mantine/core"
import { IconEdit, IconTrash, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react"
import MedicineForm from "@/components/manager/MedicineForm"
import { toggleMedicineActive, deleteMedicine } from "./actions"
import { getMedicines } from "./actions"
import type { MedicineFormData } from "./actions"

type Medicine = Awaited<ReturnType<typeof getMedicines>>[number]

const CATEGORY_LABELS = { CONTINUOUS: "Contínuo", OCCASIONAL: "Eventual", CONTROLLED: "Controlado" }
const CATEGORY_COLORS: Record<string, string> = { CONTINUOUS: "blue", OCCASIONAL: "gray", CONTROLLED: "red" }

function toFormData(med: Medicine): MedicineFormData {
  const pres = med.presentations[0]
  const rule = pres?.consumptionRules[0]
  return {
    name: med.name,
    activeIngredient: med.activeIngredient ?? "",
    category: med.category,
    requiresPrescription: med.requiresPrescription,
    notes: med.notes ?? "",
    brand: pres?.brand ?? "",
    dosage: pres?.dosage ?? "",
    form: (pres?.form ?? "COMPRIMIDO") as MedicineFormData["form"],
    unitsPerPackage: pres?.unitsPerPackage ?? 30,
    unitsPerDose: rule ? Number(rule.unitsPerDose) : 1,
    dosesPerDay: rule ? Number(rule.dosesPerDay) : 1,
  }
}

export default function MedicinesClient({ medicines }: { medicines: Medicine[] }) {
  const [newOpen, setNewOpen] = useState(false)
  const [editMed, setEditMed] = useState<Medicine | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleToggle(id: string, current: boolean) {
    await toggleMedicineActive(id, !current)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      await deleteMedicine(deleteId)
      setDeleteId(null)
    } finally {
      setDeleting(false)
    }
  }

  const rows = medicines.map((med) => {
    const pres = med.presentations[0]
    const rule = pres?.consumptionRules[0]
    const stock = pres?.stock
    const dailyConsumption = rule
      ? Number(rule.unitsPerDose) * Number(rule.dosesPerDay)
      : null

    return (
      <Table.Tr key={med.id} opacity={med.isActive ? 1 : 0.45}>
        <Table.Td>
          <Text fw={500} size="sm">{med.name}</Text>
          {med.activeIngredient && <Text size="xs" c="dimmed">{med.activeIngredient}</Text>}
        </Table.Td>
        <Table.Td><Text size="sm">{pres?.dosage ?? "—"}</Text></Table.Td>
        <Table.Td>
          <Badge color={CATEGORY_COLORS[med.category as keyof typeof CATEGORY_COLORS]} variant="light" size="sm">
            {CATEGORY_LABELS[med.category as keyof typeof CATEGORY_LABELS]}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm">{dailyConsumption != null ? `${dailyConsumption.toFixed(1)} un/dia` : "—"}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm">
            {stock != null ? `${Number(stock.referenceQuantity).toFixed(0)} un` : "—"}
          </Text>
        </Table.Td>
        <Table.Td>
          <Badge color={med.isActive ? "green" : "gray"} variant="light" size="sm">
            {med.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap={4} wrap="nowrap">
            <Tooltip label={med.isActive ? "Desativar" : "Reativar"} withArrow>
              <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => handleToggle(med.id, med.isActive)}>
                {med.isActive ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Editar" withArrow>
              <ActionIcon size="sm" variant="subtle" color="blue" onClick={() => setEditMed(med)}>
                <IconEdit size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Excluir" withArrow>
              <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setDeleteId(med.id)}>
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Table.Td>
      </Table.Tr>
    )
  })

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Text size="xl" fw={600}>Remédios</Text>
          <Text size="sm" c="dimmed">{medicines.length} cadastrado(s)</Text>
        </div>
        <Button onClick={() => setNewOpen(true)}>+ Novo remédio</Button>
      </Group>

      <Table.ScrollContainer minWidth={600}>
        <Table striped highlightOnHover withTableBorder withColumnBorders={false} verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Dosagem</Table.Th>
              <Table.Th>Categoria</Table.Th>
              <Table.Th>Consumo/dia</Table.Th>
              <Table.Th>Estoque</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {medicines.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text ta="center" c="dimmed" py="xl">Nenhum remédio cadastrado ainda.</Text>
                </Table.Td>
              </Table.Tr>
            ) : rows}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <MedicineForm open={newOpen} onClose={() => setNewOpen(false)} />

      <MedicineForm
        open={!!editMed}
        onClose={() => setEditMed(null)}
        editId={editMed?.id}
        initialData={editMed ? toFormData(editMed) : undefined}
      />

      <Modal
        opened={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Excluir remédio"
        size="sm"
        centered
      >
        <Text size="sm" mb="md">
          Tem certeza? Isso removerá o remédio e todo o histórico de estoque associado.
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button color="red" loading={deleting} onClick={handleDelete}>Excluir</Button>
        </Group>
      </Modal>
    </Stack>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Modal, TextInput, Textarea, Select, NumberInput, Button, Stack, Group, Grid, Text, Divider, Switch } from "@mantine/core"
import { createMedicine, updateMedicine, type MedicineFormData } from "@/app/(manager)/manager/medicines/actions"
import { MedicationCategory, MedicationForm } from "@prisma/client"

const CATEGORY_OPTIONS = [
  { value: "CONTINUOUS", label: "Uso contínuo" },
  { value: "OCCASIONAL", label: "Uso eventual" },
  { value: "CONTROLLED", label: "Controlado" },
]

const FORM_OPTIONS = [
  { value: "COMPRIMIDO", label: "Comprimido" },
  { value: "CAPSULA", label: "Cápsula" },
  { value: "LIQUIDO", label: "Líquido" },
  { value: "COTIRIO", label: "Colírio" },
  { value: "INJETAVEL", label: "Injetável" },
  { value: "POMADA", label: "Pomada" },
  { value: "OUTRO", label: "Outro" },
]

const EMPTY: MedicineFormData = {
  name: "",
  activeIngredient: "",
  category: "CONTINUOUS",
  requiresPrescription: false,
  notes: "",
  brand: "",
  dosage: "",
  form: "COMPRIMIDO",
  unitsPerPackage: 30,
  unitsPerDose: 1,
  dosesPerDay: 1,
}

export default function MedicineForm({
  open,
  onClose,
  editId,
  initialData,
}: {
  open: boolean
  onClose: () => void
  editId?: string
  initialData?: MedicineFormData
}) {
  const [data, setData] = useState<MedicineFormData>(initialData ?? EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setData(initialData ?? EMPTY)
      setError("")
    }
  }, [open, initialData])

  function set<K extends keyof MedicineFormData>(field: K, value: MedicineFormData[K]) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data.name || !data.dosage) { setError("Nome e dosagem são obrigatórios."); return }
    setLoading(true)
    setError("")
    try {
      if (editId) {
        await updateMedicine(editId, data)
      } else {
        await createMedicine(data)
      }
      onClose()
    } catch {
      setError("Erro ao salvar. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      opened={open}
      onClose={onClose}
      title={editId ? "Editar remédio" : "Novo remédio"}
      size="lg"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <div>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">Medicamento</Text>
            <Stack gap="sm">
              <TextInput
                label="Nome"
                required
                placeholder="Ex: Atorvastatina"
                value={data.name}
                onChange={(e) => set("name", e.target.value)}
                autoComplete="off"
              />
              <TextInput
                label="Princípio ativo"
                placeholder="Ex: Atorvastatina cálcica"
                value={data.activeIngredient}
                onChange={(e) => set("activeIngredient", e.target.value)}
                autoComplete="off"
              />
              <Grid>
                <Grid.Col span={6}>
                  <Select
                    label="Categoria"
                    data={CATEGORY_OPTIONS}
                    value={data.category}
                    onChange={(v) => set("category", (v ?? "CONTINUOUS") as MedicationCategory)}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Stack gap={4} mt={4}>
                    <Text size="sm" fw={500}>Exige receita</Text>
                    <Switch
                      label={data.requiresPrescription ? "Sim" : "Não"}
                      checked={data.requiresPrescription}
                      onChange={(e) => set("requiresPrescription", e.currentTarget.checked)}
                      mt={6}
                    />
                  </Stack>
                </Grid.Col>
              </Grid>
              <Textarea
                label="Observações"
                placeholder="Informações adicionais..."
                value={data.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
                autoComplete="off"
              />
            </Stack>
          </div>

          <Divider />

          <div>
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">Apresentação</Text>
            <Stack gap="sm">
              <Grid>
                <Grid.Col span={6}>
                  <TextInput
                    label="Dosagem"
                    required
                    placeholder="Ex: 20mg"
                    value={data.dosage}
                    onChange={(e) => set("dosage", e.target.value)}
                    autoComplete="off"
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <TextInput
                    label="Marca"
                    placeholder="Ex: Genérico"
                    value={data.brand}
                    onChange={(e) => set("brand", e.target.value)}
                    autoComplete="off"
                  />
                </Grid.Col>
              </Grid>
              <Grid>
                <Grid.Col span={6}>
                  <Select
                    label="Forma"
                    data={FORM_OPTIONS}
                    value={data.form}
                    onChange={(v) => set("form", (v ?? "COMPRIMIDO") as MedicationForm)}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <NumberInput
                    label={data.form === "COTIRIO" ? "Frascos por caixa" : "Unidades por caixa"}
                    min={1}
                    value={data.unitsPerPackage}
                    onChange={(v) => set("unitsPerPackage", Number(v))}
                  />
                </Grid.Col>
              </Grid>
            </Stack>
          </div>

          {data.category !== "OCCASIONAL" && (
            <>
              <Divider />
              <div>
                <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">Consumo</Text>
                <Grid>
                  <Grid.Col span={6}>
                    <NumberInput
                      label={data.form === "COTIRIO" ? "Aplicações por dia" : "Doses por dia"}
                      min={0.5}
                      step={0.5}
                      value={data.dosesPerDay}
                      onChange={(v) => set("dosesPerDay", Number(v))}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label={data.form === "COTIRIO" ? "Frascos por aplicação" : "Unidades por dose"}
                      min={0.001}
                      step={data.form === "COTIRIO" ? 0.01 : 0.5}
                      decimalScale={data.form === "COTIRIO" ? 3 : 1}
                      fixedDecimalScale={false}
                      value={data.unitsPerDose}
                      onChange={(v) => set("unitsPerDose", Number(v))}
                    />
                  </Grid.Col>
                </Grid>
                <Text size="xs" c="dimmed" mt="xs">
                  {data.form === "COTIRIO"
                    ? <>Consumo diário: <strong>{(data.dosesPerDay * data.unitsPerDose).toFixed(3)} frasco(s)/dia</strong></>
                    : <>Consumo diário: <strong>{(data.dosesPerDay * data.unitsPerDose).toFixed(1)} unidade(s)/dia</strong></>
                  }
                </Text>
              </div>
            </>
          )}

          {error && <Text c="red" size="sm">{error}</Text>}

          <Group justify="flex-end" mt="sm">
            <Button variant="subtle" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={loading}>Salvar</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

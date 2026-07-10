"use client"

import { useState, useEffect } from "react"
import { Modal, TextInput, Textarea, Select, NumberInput, Button, Stack, Group, Grid, Text, Divider, Switch, Tooltip } from "@mantine/core"
import { IconInfoCircle } from "@tabler/icons-react"
import { createMedicine, updateMedicine, type MedicineFormData } from "@/app/(manager)/manager/medicines/actions"
import { MedicationCategory, MedicationForm } from "@prisma/client"

function LabelWithHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Group gap={4} wrap="nowrap" style={{ display: "inline-flex" }}>
      <span>{label}</span>
      <Tooltip label={hint} multiline w={260} withArrow position="top" events={{ hover: true, focus: true, touch: true }}>
        <IconInfoCircle size={14} style={{ cursor: "help", opacity: 0.6 }} />
      </Tooltip>
    </Group>
  )
}

const CATEGORY_OPTIONS = [
  { value: "CONTINUOUS", label: "Uso contínuo" },
  { value: "OCCASIONAL", label: "Uso eventual" },
  { value: "CONTROLLED", label: "Controlado" },
]

const FORM_OPTIONS = [
  { value: "COMPRIMIDO", label: "Comprimido" },
  { value: "CAPSULA", label: "Cápsula" },
  { value: "LIQUIDO", label: "Líquido" },
  { value: "COLIRIO", label: "Colírio" },
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
  daysPerPackage: null,
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
    if (!data.name) { setError("Nome é obrigatório."); return }
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
                    label={
                      <LabelWithHint
                        label={data.form === "COLIRIO" ? "Frascos por caixa" : "Unidades por caixa"}
                        hint={
                          data.form === "COLIRIO"
                            ? "Quando você compra 1 embalagem na farmácia, quantos frascos vêm dentro? (geralmente 1)"
                            : data.form === "POMADA" || data.form === "LIQUIDO"
                            ? "Quando você compra 1 embalagem, quantos tubos/frascos vêm dentro? (geralmente 1)"
                            : "Quantos comprimidos/cápsulas vêm em cada caixa que você compra."
                        }
                      />
                    }
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

                <NumberInput
                  label={
                    <LabelWithHint
                      label="Duração estimada por embalagem (dias)"
                      hint="Quantos dias UM frasco/tubo costuma durar. Use pra colírio, creme, pomada — quando não dá pra contar gotas ou aplicações. Ex: 1 tubo de Corega dura ~30 dias. Deixe em branco pra usar o cálculo por doses/dia. Uma margem de 10% é aplicada."
                    />
                  }
                  placeholder="Ex: 30"
                  min={1}
                  value={data.daysPerPackage ?? ""}
                  onChange={(v) => set("daysPerPackage", v === "" ? null : Number(v))}
                  mb="sm"
                />

                {data.daysPerPackage ? (
                  <Text size="xs" c="dimmed">
                    Cada embalagem ({data.unitsPerPackage} un.) dura ~<strong>{data.daysPerPackage} dias</strong>.
                    O app calcula considerando ~<strong>{Math.round(data.daysPerPackage * 0.9)} dias</strong> (margem de segurança de 10%).
                  </Text>
                ) : (
                  <>
                    <Grid>
                      <Grid.Col span={6}>
                        <NumberInput
                          label={
                            <LabelWithHint
                              label={data.form === "COLIRIO" ? "Aplicações por dia" : "Doses por dia"}
                              hint={
                                data.form === "COLIRIO"
                                  ? "Quantas vezes por dia sua mãe pinga o colírio."
                                  : "Quantas vezes por dia sua mãe toma o remédio."
                              }
                            />
                          }
                          min={0.5}
                          step={0.5}
                          value={data.dosesPerDay}
                          onChange={(v) => set("dosesPerDay", Number(v))}
                        />
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <NumberInput
                          label={
                            <LabelWithHint
                              label={data.form === "COLIRIO" ? "Frascos por aplicação" : "Unidades por dose"}
                              hint={
                                data.form === "COLIRIO"
                                  ? "Quanto de frasco gasta em cada aplicação (quase sempre uma fração pequena)."
                                  : "Quantos comprimidos/cápsulas ela toma de cada vez (geralmente 1)."
                              }
                            />
                          }
                          min={0.001}
                          step={data.form === "COLIRIO" ? 0.01 : 0.5}
                          decimalScale={data.form === "COLIRIO" ? 3 : 1}
                          fixedDecimalScale={false}
                          value={data.unitsPerDose}
                          onChange={(v) => set("unitsPerDose", Number(v))}
                        />
                      </Grid.Col>
                    </Grid>
                    <Text size="xs" c="dimmed" mt="xs">
                      {data.form === "COLIRIO"
                        ? <>Consumo diário: <strong>{(data.dosesPerDay * data.unitsPerDose).toFixed(3)} frasco(s)/dia</strong></>
                        : <>Consumo diário: <strong>{(data.dosesPerDay * data.unitsPerDose).toFixed(1)} unidade(s)/dia</strong></>
                      }
                    </Text>
                  </>
                )}
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

"use client"

import { useState } from "react"
import {
  Stack, Title, Text, Button, Group, TextInput, PasswordInput,
  Paper, Tabs, Table, Switch, NumberInput, Divider,
} from "@mantine/core"
import {
  changePassword, changeMomPassword, updateMomName, updatePharmacy, updatePostalCode, getSettingsData,
} from "./actions"

type Data = Awaited<ReturnType<typeof getSettingsData>>
type Pharmacy = Data["pharmacies"][number]

function ChangePasswordForm() {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setMsg({ type: "err", text: "Senhas não coincidem." }); return }
    setLoading(true); setMsg(null)
    try {
      await changePassword(current, next)
      setMsg({ type: "ok", text: "Senha alterada com sucesso." })
      setCurrent(""); setNext(""); setConfirm("")
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Erro ao alterar senha." })
    } finally { setLoading(false) }
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Text fw={600} mb="md">Minha senha</Text>
      <form onSubmit={handle}>
        <Stack gap="sm" maw={360}>
          <PasswordInput label="Senha atual" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <PasswordInput label="Nova senha" value={next} onChange={(e) => setNext(e.target.value)} required />
          <PasswordInput label="Confirmar nova senha" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {msg && <Text c={msg.type === "ok" ? "green" : "red"} size="sm">{msg.text}</Text>}
          <Button type="submit" loading={loading} w="fit-content">Salvar</Button>
        </Stack>
      </form>
    </Paper>
  )
}

function MomSettingsForm({ users }: { users: Data["users"] }) {
  const mom = users.find((u: Data["users"][number]) => u.role === "DEPENDENT")
  const [name, setName] = useState(mom?.name ?? "")
  const [newPass, setNewPass] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  async function handleName(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMsg(null)
    try {
      await updateMomName(name)
      setMsg({ type: "ok", text: "Nome atualizado." })
    } catch { setMsg({ type: "err", text: "Erro ao salvar." }) }
    finally { setLoading(false) }
  }

  async function handlePass(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMsg(null)
    try {
      await changeMomPassword(newPass)
      setMsg({ type: "ok", text: "Senha da mãe alterada." })
      setNewPass("")
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Erro ao alterar senha." })
    } finally { setLoading(false) }
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Text fw={600} mb="md">Perfil da mãe</Text>
      <Stack gap="md" maw={360}>
        <form onSubmit={handleName}>
          <Stack gap="sm">
            <TextInput label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <Text size="xs" c="dimmed">Email: {mom?.email}</Text>
            <Button type="submit" loading={loading} w="fit-content" size="sm">Salvar nome</Button>
          </Stack>
        </form>
        <Divider />
        <form onSubmit={handlePass}>
          <Stack gap="sm">
            <PasswordInput label="Nova senha da mãe" value={newPass} onChange={(e) => setNewPass(e.target.value)} required />
            <Button type="submit" loading={loading} w="fit-content" size="sm" variant="outline">Alterar senha</Button>
          </Stack>
        </form>
        {msg && <Text c={msg.type === "ok" ? "green" : "red"} size="sm">{msg.text}</Text>}
      </Stack>
    </Paper>
  )
}

const toNumberOrNull = (v: string | number) => (v === "" || v === null ? null : Number(v))

function PharmacyRow({ ph }: { ph: Pharmacy }) {
  const [template, setTemplate] = useState(ph.searchUrlTemplate)
  const [priority, setPriority] = useState(ph.priority)
  const [active, setActive] = useState(ph.isActive)
  const [shippingCost, setShippingCost] = useState<string | number>(ph.shippingCost === null ? "" : Number(ph.shippingCost))
  const [freeShippingMin, setFreeShippingMin] = useState<string | number>(ph.freeShippingMin === null ? "" : Number(ph.freeShippingMin))
  const [deliveryDays, setDeliveryDays] = useState<string | number>(ph.deliveryDays ?? "")
  const [pickup, setPickup] = useState<boolean>(ph.pickupAvailable)
  const [pickupNotes, setPickupNotes] = useState(ph.pickupNotes ?? "")
  const [vtexHost, setVtexHost] = useState(ph.vtexHost ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await updatePharmacy(ph.id, {
      name: ph.name,
      searchUrlTemplate: template,
      priority,
      isActive: active,
      shippingCost: toNumberOrNull(shippingCost),
      freeShippingMin: toNumberOrNull(freeShippingMin),
      deliveryDays: toNumberOrNull(deliveryDays),
      pickupAvailable: pickup,
      pickupNotes,
      vtexHost,
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Table.Tr>
      <Table.Td><Text size="sm" fw={500}>{ph.name}</Text></Table.Td>
      <Table.Td>
        <NumberInput size="xs" min={0} decimalScale={2} fixedDecimalScale decimalSeparator="," thousandSeparator="." prefix="R$ " placeholder="sem entrega" value={shippingCost} onChange={setShippingCost} style={{ width: 110 }} />
      </Table.Td>
      <Table.Td>
        <NumberInput size="xs" min={0} decimalScale={2} fixedDecimalScale decimalSeparator="," thousandSeparator="." prefix="R$ " placeholder="—" value={freeShippingMin} onChange={setFreeShippingMin} style={{ width: 110 }} />
      </Table.Td>
      <Table.Td>
        <NumberInput size="xs" min={0} max={60} placeholder="—" value={deliveryDays} onChange={setDeliveryDays} style={{ width: 70 }} />
      </Table.Td>
      <Table.Td>
        <Group gap={6} wrap="nowrap">
          <Switch checked={pickup} onChange={(e) => setPickup(e.currentTarget.checked)} />
          <TextInput size="xs" placeholder="onde / tempo" value={pickupNotes} onChange={(e) => setPickupNotes(e.target.value)} disabled={!pickup} style={{ width: 150 }} />
        </Group>
      </Table.Td>
      <Table.Td>
        <TextInput size="xs" placeholder="www.loja.com.br" value={vtexHost} onChange={(e) => setVtexHost(e.target.value)} style={{ width: 200 }} />
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          style={{ minWidth: 260 }}
        />
      </Table.Td>
      <Table.Td>
        <NumberInput size="xs" min={1} max={99} value={priority} onChange={(v) => setPriority(Number(v))} style={{ width: 70 }} />
      </Table.Td>
      <Table.Td>
        <Switch checked={active} onChange={(e) => setActive(e.currentTarget.checked)} />
      </Table.Td>
      <Table.Td>
        <Button size="xs" variant="outline" loading={saving} onClick={save} color={saved ? "green" : undefined}>
          {saved ? "Salvo!" : "Salvar"}
        </Button>
      </Table.Td>
    </Table.Tr>
  )
}

function PostalCodeForm({ initial }: { initial: string }) {
  const [cep, setCep] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    try {
      await updatePostalCode(cep)
      setMsg({ type: "ok", text: "CEP salvo." })
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Erro ao salvar." })
    } finally { setSaving(false) }
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Text fw={600} mb={4}>Entrega</Text>
      <Text size="xs" c="dimmed" mb="sm">CEP usado para simular frete e prazo na cotação automática.</Text>
      <form onSubmit={save}>
        <Group align="flex-end" gap="sm">
          <TextInput label="CEP" value={cep} onChange={(e) => setCep(e.target.value)} placeholder="00000-000" w={140} />
          <Button type="submit" loading={saving} size="sm">Salvar</Button>
          {msg && <Text c={msg.type === "ok" ? "green" : "red"} size="sm">{msg.text}</Text>}
        </Group>
      </form>
    </Paper>
  )
}

function PharmaciesForm({ pharmacies }: { pharmacies: Pharmacy[] }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text fw={600} mb="md">Farmácias</Text>
      <Table.ScrollContainer minWidth={1350}>
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Frete</Table.Th>
              <Table.Th>Grátis a partir de</Table.Th>
              <Table.Th>Prazo (dias)</Table.Th>
              <Table.Th>Retirada perto de casa</Table.Th>
              <Table.Th>Host VTEX</Table.Th>
              <Table.Th>URL de busca</Table.Th>
              <Table.Th>Ordem</Table.Th>
              <Table.Th>Ativa</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pharmacies.map((ph) => <PharmacyRow key={ph.id} ph={ph} />)}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Stack gap={4} mt="sm">
        <Text size="xs" c="dimmed">
          <b>Frete</b> vazio = não entrega (ou não sabemos); a farmácia só entra na Melhor compra se tiver retirada ou frete informado na cotação.
          {" "}<b>Host VTEX</b> habilita a cotação automática (ex: www.drogariaspacheco.com.br).
        </Text>
        <Text size="xs" c="dimmed">URL de busca: use {"{query}"} para termo codificado e {"{slug}"} para formato com hífens (ex: CallFarma).</Text>
      </Stack>
    </Paper>
  )
}

export default function SettingsClient({ data }: { data: Data }) {
  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Configurações</Title>
        <Text c="dimmed" size="sm">Gerencie senhas, perfis e farmácias</Text>
      </div>

      <Tabs defaultValue="account">
        <Tabs.List>
          <Tabs.Tab value="account">Contas</Tabs.Tab>
          <Tabs.Tab value="pharmacies">Farmácias</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="account" pt="md">
          <Stack gap="md">
            <ChangePasswordForm />
            <MomSettingsForm users={data.users} />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="pharmacies" pt="md">
          <Stack gap="md">
            <PostalCodeForm initial={data.postalCode} />
            <PharmaciesForm pharmacies={data.pharmacies} />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

"use client"

import { useState } from "react"
import {
  Stack, Title, Text, Button, Group, TextInput, PasswordInput,
  Paper, Tabs, Table, Switch, NumberInput, Divider,
} from "@mantine/core"
import {
  changePassword, changeMomPassword, updateMomName, updatePharmacy, getSettingsData,
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

function PharmacyRow({ ph }: { ph: Pharmacy }) {
  const [template, setTemplate] = useState(ph.searchUrlTemplate)
  const [priority, setPriority] = useState(ph.priority)
  const [active, setActive] = useState(ph.isActive)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await updatePharmacy(ph.id, { name: ph.name, searchUrlTemplate: template, priority, isActive: active })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Table.Tr>
      <Table.Td><Text size="sm" fw={500}>{ph.name}</Text></Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          style={{ minWidth: 320 }}
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

function PharmaciesForm({ pharmacies }: { pharmacies: Pharmacy[] }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text fw={600} mb="md">Farmácias</Text>
      <Table.ScrollContainer minWidth={600}>
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
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
      <Text size="xs" c="dimmed" mt="sm">Use {"{query}"} para termo codificado e {"{slug}"} para formato com hífens (ex: CallFarma).</Text>
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
          <PharmaciesForm pharmacies={data.pharmacies} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

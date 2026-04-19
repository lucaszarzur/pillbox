"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { Group, Text, Button, Box, Burger, Drawer, Stack, Menu, Indicator, ActionIcon, Badge } from "@mantine/core"
import { useState } from "react"
import { dismissAlert, markAllRead, getUnreadAlerts } from "@/lib/alerts"

type Alert = Awaited<ReturnType<typeof getUnreadAlerts>>[number]

const links = [
  { href: "/manager/dashboard", label: "Dashboard" },
  { href: "/manager/medicines", label: "Remédios" },
  { href: "/manager/stock", label: "Estoque" },
  { href: "/manager/confirmations", label: "Confirmações" },
  { href: "/manager/quotation", label: "Cotação" },
  { href: "/manager/purchases", label: "Compras" },
  { href: "/manager/report", label: "Relatório" },
  { href: "/manager/settings", label: "Configurações" },
]

const alertColor: Record<string, string> = {
  CRITICAL: "red",
  LOW_STOCK: "yellow",
  NO_CONFIRMATION: "orange",
  DIVERGENCE: "orange",
  PLAN: "blue",
  PRICE_HIGH: "gray",
}

const alertIcon: Record<string, string> = {
  CRITICAL: "🔴",
  LOW_STOCK: "🟡",
  NO_CONFIRMATION: "📅",
  DIVERGENCE: "⚠️",
  PLAN: "📋",
  PRICE_HIGH: "💰",
}

export default function ManagerNav({
  userName,
  unreadAlerts,
}: {
  userName: string
  unreadAlerts: Alert[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>(unreadAlerts)

  async function handleDismiss(id: string) {
    await dismissAlert(id)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleMarkAllRead() {
    await markAllRead()
    setAlerts([])
    router.refresh()
  }

  const linkStyle = (active: boolean) => ({
    borderRadius: 6,
    textDecoration: "none",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--mantine-color-dark-9)" : "var(--mantine-color-gray-6)",
    backgroundColor: active ? "var(--mantine-color-gray-1)" : "transparent",
    padding: "6px 12px",
  })

  return (
    <>
      <Box component="nav" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }} bg="white" px="md">
        <Group h={56} justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Text fw={700} size="sm" mr="sm">Pillbox</Text>
            <Group gap={2} visibleFrom="md">
              {links.map((l) => (
                <Box key={l.href} component={Link} href={l.href} style={linkStyle(pathname.startsWith(l.href))}>
                  {l.label}
                </Box>
              ))}
            </Group>
          </Group>

          <Group gap="sm">
            {/* Sino de alertas */}
            <Menu shadow="md" width={320} position="bottom-end">
              <Menu.Target>
                <Indicator
                  label={alerts.length > 9 ? "9+" : alerts.length}
                  disabled={alerts.length === 0}
                  color="red"
                  size={16}
                >
                  <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Alertas">
                    🔔
                  </ActionIcon>
                </Indicator>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>
                  <Group justify="space-between">
                    <span>Alertas ({alerts.length})</span>
                    {alerts.length > 0 && (
                      <Text
                        size="xs"
                        c="blue"
                        style={{ cursor: "pointer" }}
                        onClick={handleMarkAllRead}
                      >
                        Marcar todos como lido
                      </Text>
                    )}
                  </Group>
                </Menu.Label>

                {alerts.length === 0 && (
                  <Menu.Item disabled>
                    <Text size="sm" c="dimmed" ta="center">Nenhum alerta</Text>
                  </Menu.Item>
                )}

                {alerts.map((alert) => (
                  <Menu.Item key={alert.id} closeMenuOnClick={false}>
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                        <span>{alertIcon[alert.type] ?? "•"}</span>
                        <Text size="xs" style={{ flex: 1 }} lineClamp={2}>{alert.message}</Text>
                      </Group>
                      <Text
                        size="xs"
                        c="dimmed"
                        style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                        onClick={() => handleDismiss(alert.id)}
                      >
                        ✕
                      </Text>
                    </Group>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>

            <Text size="sm" c="dimmed" visibleFrom="sm">{userName}</Text>
            <Button variant="subtle" color="gray" size="xs" visibleFrom="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
              Sair
            </Button>
            <Burger opened={drawerOpen} onClick={() => setDrawerOpen(true)} hiddenFrom="md" size="sm" />
          </Group>
        </Group>
      </Box>

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="left"
        size="xs"
        title={<Text fw={700}>Pillbox</Text>}
        padding="md"
      >
        <Stack gap="xs">
          {links.map((l) => (
            <Box
              key={l.href}
              component={Link}
              href={l.href}
              onClick={() => setDrawerOpen(false)}
              style={{
                display: "block",
                padding: "10px 12px",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 15,
                fontWeight: pathname.startsWith(l.href) ? 600 : 400,
                color: pathname.startsWith(l.href) ? "var(--mantine-color-dark-9)" : "var(--mantine-color-gray-7)",
                backgroundColor: pathname.startsWith(l.href) ? "var(--mantine-color-gray-1)" : "transparent",
              }}
            >
              {l.label}
            </Box>
          ))}
          <Box style={{ borderTop: "1px solid var(--mantine-color-gray-2)", paddingTop: 12, marginTop: 4 }}>
            <Text size="xs" c="dimmed" mb="xs">{userName}</Text>
            <Button variant="subtle" color="red" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
              Sair
            </Button>
          </Box>
        </Stack>
      </Drawer>
    </>
  )
}

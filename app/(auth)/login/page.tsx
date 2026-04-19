"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { TextInput, PasswordInput, Button, Paper, Title, Text, Stack, Center, Box } from "@mantine/core"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const result = await signIn("credentials", { email, password, redirect: false })

    if (result?.error) {
      setError("Email ou senha incorretos.")
      setLoading(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <Center mih="100vh" bg="gray.0">
      <Box w={380} px="md">
        <Title order={2} ta="center" mb={4}>Pillbox</Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">Entre com sua conta</Text>

        <Paper withBorder shadow="sm" p="xl" radius="md">
          <form onSubmit={handleLogin}>
            <Stack gap="md">
              <TextInput
                label="Email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PasswordInput
                label="Senha"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <Text c="red" size="sm">{error}</Text>}
              <Button type="submit" loading={loading} fullWidth mt="xs">
                Entrar
              </Button>
            </Stack>
          </form>
        </Paper>
      </Box>
    </Center>
  )
}

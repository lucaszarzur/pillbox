import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { SessionProvider } from "next-auth/react"
import { ColorSchemeScript } from "@mantine/core"
import MantineWrapper from "@/components/MantineWrapper"
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar"
import "@mantine/core/styles.css"
import "./globals.css"

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Pillbox",
  description: "Controle de remédios",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pillbox",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`}>
      <head>
        <ColorSchemeScript />
        <meta name="theme-color" content="#4a90d9" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <MantineWrapper>
          <ServiceWorkerRegistrar />
          <SessionProvider>{children}</SessionProvider>
        </MantineWrapper>
      </body>
    </html>
  )
}

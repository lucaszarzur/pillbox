import { redirect } from "next/navigation"
import { auth } from "@/auth"
import ManagerNav from "@/components/manager/ManagerNav"
import { getUnreadAlerts } from "@/lib/alerts"

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session || session.user.role !== "MANAGER") {
    redirect("/login")
  }

  const alerts = await getUnreadAlerts()

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa" }}>
      <ManagerNav
        userName={session.user.name ?? session.user.email ?? ""}
        unreadAlerts={alerts}
      />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>{children}</main>
    </div>
  )
}

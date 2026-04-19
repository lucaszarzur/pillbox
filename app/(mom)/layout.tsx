import { redirect } from "next/navigation"
import { auth } from "@/auth"

export default async function MomLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session || session.user.role !== "DEPENDENT") {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}

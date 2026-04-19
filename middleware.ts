import { auth } from "@/auth"
import { NextResponse } from "next/server"

export const middleware = auth(function (req) {
  const { pathname } = req.nextUrl

  if (!req.auth && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (req.auth && pathname === "/") {
    const dest = req.auth.user?.role === "DEPENDENT" ? "/mom/home" : "/manager/dashboard"
    return NextResponse.redirect(new URL(dest, req.url))
  }

  if (req.auth && pathname.startsWith("/manager") && req.auth.user?.role === "DEPENDENT") {
    return NextResponse.redirect(new URL("/mom/home", req.url))
  }

  if (req.auth && pathname.startsWith("/mom") && req.auth.user?.role === "MANAGER") {
    return NextResponse.redirect(new URL("/manager/dashboard", req.url))
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}

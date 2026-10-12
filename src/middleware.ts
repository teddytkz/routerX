import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  // API & proxy punya guard sendiri (needAdmin / share key) — jangan redirect ke halaman.
  if (p.startsWith("/api/") || p.startsWith("/v1/")) return NextResponse.next();
  const user = await sessionUser(req.cookies.get(SESSION_COOKIE)?.value);
  if (p === "/login") {
    return user ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

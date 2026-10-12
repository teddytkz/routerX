import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";

export const runtime = "nodejs";

function cookieSession(req: Request): string | undefined {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export async function GET(req: Request) {
  const user = await sessionUser(cookieSession(req));
  if (!user) return NextResponse.json({ error: "belum login" }, { status: 401 });
  return NextResponse.json({ user });
}

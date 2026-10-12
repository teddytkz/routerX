import { NextResponse } from "next/server";
import { adminUser, mintSession, sessionMaxAge, SESSION_COOKIE, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "body JSON tidak valid" }, { status: 400 });
  }
  const ok =
    typeof body.username === "string" &&
    typeof body.password === "string" &&
    body.username === adminUser() &&
    (await verifyPassword(body.password));
  if (!ok) {
    return NextResponse.json({ error: "username atau password salah" }, { status: 401 });
  }
  const sess = await mintSession(adminUser());
  const res = NextResponse.json({ user: adminUser() });
  res.cookies.set(SESSION_COOKIE, sess, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge(),
  });
  return res;
}

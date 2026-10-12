import { NextResponse } from "next/server";
import { upstream } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET() {
  let up: unknown = null;
  try {
    const r = await fetch(`${upstream()}/api/health`, { signal: AbortSignal.timeout(5000) });
    up = await r.json();
  } catch {
    up = { ok: false, error: "9router tidak terjangkau" };
  }
  return NextResponse.json({ ok: true, service: "routerx", upstreamUrl: upstream(), upstream: up });
}

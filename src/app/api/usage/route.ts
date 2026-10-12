import { NextResponse } from "next/server";
import { loadDb } from "@/lib/db";
import { peekRpm } from "@/lib/rate-limit";
import { needAdmin } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  const db = loadDb();
  const keys = db.keys.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    active: k.active,
    usedTokens: k.usedTokens,
    budgetTokens: k.budgetTokens,
    remaining: k.budgetTokens > 0 ? Math.max(0, k.budgetTokens - k.usedTokens) : null,
    rpmLimit: k.rpmLimit ?? 0,
    rpmUsed: peekRpm(k.id),
    lastUsedAt: k.lastUsedAt,
  }));
  const totalUsed = keys.reduce((s, k) => s + k.usedTokens, 0);
  return NextResponse.json({ totalUsed, count: keys.length, keys });
}

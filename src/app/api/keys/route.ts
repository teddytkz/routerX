import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { loadDb, saveDb, mintKey, hashKey, publicKey } from "@/lib/db";
import { needAdmin } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  const db = loadDb();
  return NextResponse.json({ keys: db.keys.map(publicKey) });
}

interface CreateBody {
  name?: string;
  allowedModels?: string[];
  maxTokensPerRequest?: number;
  budgetTokens?: number;
  rpmLimit?: number;
}

export async function POST(req: Request) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "body JSON tidak valid" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name wajib diisi" }, { status: 400 });

  const num = (v: unknown): number => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  };
  const allowedModels = Array.isArray(body.allowedModels)
    ? [...new Set(body.allowedModels.map((m) => String(m).trim()).filter(Boolean))]
    : [];

  const { raw, prefix } = mintKey();
  const now = new Date().toISOString();
  const db = loadDb();
  db.keys.push({
    id: randomUUID(),
    name,
    keyHash: hashKey(raw),
    prefix,
    allowedModels,
    maxTokensPerRequest: num(body.maxTokensPerRequest),
    budgetTokens: num(body.budgetTokens),
    usedTokens: 0,
    rpmLimit: num(body.rpmLimit),
    active: true,
    createdAt: now,
    lastUsedAt: null,
  });
  saveDb(db);
  const created = db.keys[db.keys.length - 1];
  // key asli hanya dikembalikan SEKALI di sini
  return NextResponse.json({ key: raw, info: publicKey(created) }, { status: 201 });
}

import { NextResponse } from "next/server";
import { loadDb, saveDb, publicKey } from "@/lib/db";
import { needAdmin } from "@/lib/guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

interface PatchBody {
  name?: string;
  allowedModels?: string[];
  maxTokensPerRequest?: number;
  budgetTokens?: number;
  rpmLimit?: number;
  active?: boolean;
  resetUsage?: boolean;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "body JSON tidak valid" }, { status: 400 });
  }
  const db = loadDb();
  const k = db.keys.find((x) => x.id === id);
  if (!k) return NextResponse.json({ error: "key tidak ditemukan" }, { status: 404 });

  if (typeof body.name === "string" && body.name.trim()) k.name = body.name.trim();
  if (Array.isArray(body.allowedModels)) {
    k.allowedModels = [
      ...new Set(body.allowedModels.map((m) => String(m).trim()).filter(Boolean)),
    ];
  }
  const num = (v: unknown): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };
  const m = num(body.maxTokensPerRequest);
  if (m !== null) k.maxTokensPerRequest = m;
  const b = num(body.budgetTokens);
  if (b !== null) k.budgetTokens = b;
  const r = num(body.rpmLimit);
  if (r !== null) k.rpmLimit = r;
  if (typeof body.active === "boolean") k.active = body.active;
  if (body.resetUsage === true) k.usedTokens = 0;

  saveDb(db);
  return NextResponse.json({ key: publicKey(k) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const db = loadDb();
  const i = db.keys.findIndex((x) => x.id === id);
  if (i < 0) return NextResponse.json({ error: "key tidak ditemukan" }, { status: 404 });
  const [gone] = db.keys.splice(i, 1);
  saveDb(db);
  return NextResponse.json({ deleted: gone.id });
}

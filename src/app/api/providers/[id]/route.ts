import { NextResponse } from "next/server";
import { loadDb, saveDb, normalizeBaseUrl, publicProvider, setDefaultModels } from "@/lib/db";
import { needAdmin } from "@/lib/guard";

export const runtime = "nodejs";

export const DEFAULT_PROVIDER_ID = "default-9router";

type Ctx = { params: Promise<{ id: string }> };

interface Body {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  models?: string[];
  enabled?: boolean;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "body JSON tidak valid" }, { status: 400 });
  }
  const db = loadDb();
  // Default 9router: hanya daftar model yg boleh diedit.
  if (id === DEFAULT_PROVIDER_ID) {
    if (!Array.isArray(body.models)) {
      return NextResponse.json({ error: "models harus array" }, { status: 400 });
    }
    const models = setDefaultModels(body.models.map((m) => String(m)));
    return NextResponse.json({
      provider: {
        id: DEFAULT_PROVIDER_ID,
        name: "9router",
        models,
        enabled: true,
        builtIn: true,
      },
    });
  }
  const p = db.providers.find((x) => x.id === id);
  if (!p) return NextResponse.json({ error: "provider tidak ditemukan" }, { status: 404 });
  if (typeof body.name === "string" && body.name.trim()) p.name = body.name.trim();
  if (typeof body.baseUrl === "string" && body.baseUrl.trim()) {
    const u = normalizeBaseUrl(body.baseUrl);
    if (!/^https?:\/\/.+/.test(u)) {
      return NextResponse.json({ error: "baseUrl harus http(s)://..." }, { status: 400 });
    }
    p.baseUrl = u;
  }
  // apiKey: string kosong = biarkan lama; kirim "___CLEAR___" utk hapus? sederhanakan: kosong = tidak diubah.
  if (typeof body.apiKey === "string" && body.apiKey.trim()) p.apiKey = body.apiKey.trim();
  if (Array.isArray(body.models)) {
    p.models = [...new Set(body.models.map((m) => String(m).trim()).filter(Boolean))].slice(0, 200);
  }
  if (typeof body.enabled === "boolean") p.enabled = body.enabled;
  saveDb(db);
  return NextResponse.json({ provider: publicProvider(p) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const db = loadDb();
  const i = db.providers.findIndex((x) => x.id === id);
  if (i < 0) return NextResponse.json({ error: "provider tidak ditemukan" }, { status: 404 });
  const [gone] = db.providers.splice(i, 1);
  saveDb(db);
  return NextResponse.json({ deleted: gone.id });
}

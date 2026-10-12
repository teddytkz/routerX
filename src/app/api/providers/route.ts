import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { loadDb, saveDb, normalizeBaseUrl, publicProvider, getDefaultModels } from "@/lib/db";
import { needAdmin, upstream } from "@/lib/guard";

export const runtime = "nodejs";

export const DEFAULT_PROVIDER_ID = "default-9router";

export async function GET(req: Request) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  const db = loadDb();
  const def = {
    id: DEFAULT_PROVIDER_ID,
    name: "9router",
    baseUrl: upstream(),
    models: getDefaultModels(),
    enabled: true,
    builtIn: true,
    createdAt: "",
    apiKeySet: false,
    apiKeyHint: "env/CLI",
  };
  return NextResponse.json({ providers: [def, ...db.providers.map(publicProvider)] });
}

interface Body {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  models?: string[];
  enabled?: boolean;
}

function cleanModels(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((m) => String(m).trim()).filter(Boolean))].slice(0, 200);
}

export async function POST(req: Request) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "body JSON tidak valid" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  const baseUrl = body.baseUrl ? normalizeBaseUrl(body.baseUrl) : "";
  if (!name) return NextResponse.json({ error: "name wajib diisi" }, { status: 400 });
  if (!baseUrl || !/^https?:\/\/.+/.test(baseUrl)) {
    return NextResponse.json({ error: "baseUrl harus http(s)://..." }, { status: 400 });
  }
  const now = new Date().toISOString();
  const db = loadDb();
  db.providers.push({
    id: randomUUID(),
    name,
    baseUrl,
    apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : "",
    models: cleanModels(body.models),
    enabled: body.enabled ?? true,
    createdAt: now,
  });
  saveDb(db);
  const created = db.providers[db.providers.length - 1];
  return NextResponse.json({ provider: publicProvider(created) }, { status: 201 });
}

import { NextResponse } from "next/server";
import { upstream, needAdmin } from "@/lib/guard";
import { loadDb, getModelRoutes } from "@/lib/db";
import { cliToken } from "@/lib/upstream-auth";

export const runtime = "nodejs";

// Cache daftar model live: /keys, /providers, /routes semuanya manggil endpoint
// ini tiap dibuka — tanpa cache tiap buka halaman = fetch ke upstream dulu.
const CACHE_TTL_MS = 60_000;
let cache: {
  at: number;
  models: string[];
  providers: { id: string; name: string; baseUrl: string; models: string[]; online: boolean }[];
} | null = null;

async function getModels(baseUrl: string, headers: Headers): Promise<string[]> {
  const r = await fetch(`${baseUrl}/v1/models`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  const data = (await r.json()) as { data?: { id: string }[] };
  return Array.isArray(data.data) ? data.data.map((m) => m.id) : [];
}

/** Gabung alias routing lokal (selalu segar dari db) ke hasil live. */
function withAliases(
  flat: string[],
  providers: { id: string; name: string; baseUrl: string; models: string[]; online: boolean }[],
  aliases: string[],
) {
  const out = [...providers];
  const models = [...flat];
  if (aliases.length > 0) {
    out.push({ id: "routing", name: "Alias Routing", baseUrl: "", models: aliases, online: true });
    for (const a of aliases) if (!models.includes(a)) models.push(a);
    models.sort();
  }
  return { models, providers: out };
}

export async function GET(req: Request) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  // alias routing selalu segar dari db (lokal, murah) — digabung ke hasil cache/live
  const aliases = getModelRoutes().map((r) => r.alias).sort();
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(withAliases(cache.models, cache.providers, aliases));
  }

  const db = loadDb();
  const customs = db.providers.filter((p) => p.enabled);

  // default 9router
  const defHeaders = new Headers();
  const upstreamKey = process.env.UPSTREAM_KEY?.trim();
  if (upstreamKey) defHeaders.set("authorization", `Bearer ${upstreamKey}`);
  const cli = cliToken();
  if (cli) defHeaders.set("x-9r-cli-token", cli);

  const settled = await Promise.allSettled([
    getModels(upstream(), defHeaders),
    ...customs.map((p) => {
      const h = new Headers();
      if (p.apiKey) h.set("authorization", `Bearer ${p.apiKey}`);
      return getModels(p.baseUrl, h);
    }),
  ]);

  const defModels = settled[0].status === "fulfilled" ? settled[0].value : [];
  const providers = [
    {
      id: "default",
      name: "9router",
      baseUrl: upstream(),
      models: defModels,
      online: settled[0].status === "fulfilled",
    },
    ...customs.map((p, i) => {
      const s = settled[i + 1];
      return {
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        models: s.status === "fulfilled" ? s.value : [],
        online: s.status === "fulfilled",
      };
    }),
  ];
  const flat = [...new Set(providers.flatMap((p) => p.models))].sort();
  cache = { at: Date.now(), models: flat, providers };
  return NextResponse.json(withAliases(flat, providers, aliases));
}

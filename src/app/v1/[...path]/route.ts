import { NextResponse } from "next/server";
import { findKeyByRaw, addTokens, touchKey, matchProvider, appendRequestLog, defaultModelAllowed, resolveModel } from "@/lib/db";
import { upstream, bearerToken, clampTokens, extractUsage } from "@/lib/guard";
import { cliToken } from "@/lib/upstream-auth";
import { checkRpm } from "@/lib/rate-limit";

export const runtime = "nodejs";

const BODY_LIMIT = Number(process.env.BODY_LIMIT_MB ?? 50) * 1024 * 1024;

type Ctx = { params: Promise<{ path: string[] }> };

function err(message: string, status: number): NextResponse {
  const code =
    status === 401 ? "invalid_api_key" : status === 402 ? "budget_exceeded" : "forbidden";
  return NextResponse.json({ error: { message, type: code } }, { status });
}

async function handler(req: Request, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  const segs = (path ?? []).map(encodeURIComponent).join("/");
  const targetPath = `/v1/${segs}`;

  const raw = bearerToken(req);
  if (!raw) return err("Wajib sertakan header Authorization: Bearer <key>", 401);
  const key = findKeyByRaw(raw);
  if (!key || !key.active) return err("API key tidak valid / dinonaktifkan", 401);

  const method = req.method.toUpperCase();
  const log = (status: number, model: string | null, tokens: number) =>
    appendRequestLog({
      keyId: key.id,
      keyName: key.name,
      prefix: key.prefix,
      method,
      path: targetPath,
      model,
      status,
      ok: status >= 200 && status < 300,
      tokens,
    });

  if (key.budgetTokens > 0 && key.usedTokens >= key.budgetTokens) {
    log(402, null, 0);
    return err("Budget token key ini sudah habis", 402);
  }

  // ---- rate limit RPM ----
  const rpm = checkRpm(key.id, key.rpmLimit);
  if (!rpm.ok) {
    log(429, null, 0);
    return NextResponse.json(
      { error: { message: `Rate limit: ${key.rpmLimit} RPM terlampaui`, type: "rate_limit_exceeded" } },
      { status: 429, headers: { "retry-after": "60" } }
    );
  }

  // ---- baca body (kalau ada) ----
  let bodyText: string | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > BODY_LIMIT) return err("Body terlalu besar", 413);
    bodyText = await req.text();
    if (bodyText.length > BODY_LIMIT) return err("Body terlalu besar", 413);
  }

  const ct = req.headers.get("content-type") ?? "";
  let parsed: unknown = null;
  let isJson = false;
  if (bodyText && ct.includes("json")) {
    try {
      parsed = JSON.parse(bodyText);
      isJson = true;
    } catch {
      return err("Body JSON tidak valid", 400);
    }
  }

  // ---- batas model + resolve alias routing ----
  // User kirim alias (cth "sonnet-5") → diteruskan sebagai id asli ke upstream.
  const model =
    isJson && typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>).model
      : undefined;
  const resolved = typeof model === "string" ? resolveModel(model) : undefined;
  if (typeof model === "string" && key.allowedModels.length > 0) {
    if (!key.allowedModels.includes(model) && (!resolved || !key.allowedModels.includes(resolved))) {
      log(403, model, 0);
      return err(`Model "${model}" tidak diizinkan untuk key ini`, 403);
    }
  }
  // tulis ulang body agar upstream menerima id asli
  if (isJson && typeof model === "string" && resolved && resolved !== model) {
    parsed = { ...(parsed as Record<string, unknown>), model: resolved };
    bodyText = JSON.stringify(parsed);
  }

  // ---- batas token per request ----
  // Batas efektif = sisa budget (bila ada budget) digabung Token/req (bila diset).
  // Cth: budget 10.000, terpakai 9.000 → request ini dibatasi max 1.000 token.
  if (isJson) {
    let effective = 0; // 0 = bebas
    if (key.budgetTokens > 0) effective = Math.max(0, key.budgetTokens - key.usedTokens);
    if (key.maxTokensPerRequest > 0)
      effective = effective > 0 ? Math.min(effective, key.maxTokensPerRequest) : key.maxTokensPerRequest;
    const { body } = clampTokens(parsed, effective);
    parsed = body;
    bodyText = JSON.stringify(body);
  }

  // ---- routing backend per-model (pakai id asli hasil resolve) ----
  // Cari provider custom yg polanya cocok dgn model; kalau tidak ada → default 9router.
  const routed = resolved ?? (typeof model === "string" ? model : undefined);
  const custom = typeof routed === "string" ? matchProvider(routed) : null;
  if (!custom && typeof routed === "string" && !defaultModelAllowed(routed)) {
    log(403, typeof model === "string" ? model : null, 0);
    return err(`Model "${model}" tidak diizinkan pada default 9router`, 403);
  }
  const targetBase = custom ? custom.baseUrl : upstream();
  const targetName = custom ? custom.name : "9router";

  // ---- teruskan ke backend ----
  const url = new URL(req.url);
  const fwdHeaders = new Headers();
  const pass = ["content-type", "accept", "anthropic-version", "x-api-key", "openai-beta"];
  for (const h of pass) {
    const v = req.headers.get(h);
    if (v) fwdHeaders.set(h, v);
  }
  // auth milik client TIDAK diteruskan; sebagai gantinya pakai auth backend tujuan:
  // - custom: Bearer apiKey provider itu (bila diset)
  // - default 9router: UPSTREAM_KEY, atau token CLI lokal (x-9r-cli-token).
  if (custom) {
    if (custom.apiKey) fwdHeaders.set("authorization", `Bearer ${custom.apiKey}`);
  } else {
    const upstreamKey = process.env.UPSTREAM_KEY?.trim();
    if (upstreamKey) fwdHeaders.set("authorization", `Bearer ${upstreamKey}`);
    const cli = cliToken();
    if (cli) fwdHeaders.set("x-9r-cli-token", cli);
  }

  let upRes: Response;
  try {
    upRes = await fetch(`${targetBase}${targetPath}${url.search}`, {
      method,
      headers: fwdHeaders,
      body: bodyText,
    });
  } catch {
    log(502, typeof model === "string" ? model : null, 0);
    return NextResponse.json(
      { error: { message: `${targetName} tidak terjangkau`, type: "upstream_down" } },
      { status: 502 },
    );
  }

  // ---- GET /v1/models: gabung semua backend + saring ----
  if (method === "GET" && targetPath === "/v1/models") {
    try {
      const data = (await upRes.json()) as { data?: { id: string }[] };
      if (Array.isArray(data.data)) {
        // model dari backend yg dirutekan; bila tanpa model (list), gabung backend lain juga
        const { loadDb } = await import("@/lib/db");
        const extra: { id: string }[] = [];
        if (!custom) {
          const db = loadDb();
          const others = db.providers.filter((p) => p.enabled && p.baseUrl !== targetBase);
          const lists = await Promise.allSettled(
            others.map(async (p) => {
              const h = new Headers();
              if (p.apiKey) h.set("authorization", `Bearer ${p.apiKey}`);
              const r = await fetch(`${p.baseUrl}/v1/models`, {
                headers: h,
                signal: AbortSignal.timeout(10000),
              });
              const j = (await r.json()) as { data?: { id: string }[] };
              return Array.isArray(j.data) ? j.data : [];
            }),
          );
          for (const l of lists) {
            if (l.status === "fulfilled") extra.push(...l.value);
          }
        }
        const seen = new Set<string>();
        const merged = [...data.data, ...extra].filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        // tambah alias routing lokal sebagai entri model tersendiri
        const { getModelRoutes } = await import("@/lib/db");
        for (const r of getModelRoutes()) {
          if (!seen.has(r.alias)) {
            seen.add(r.alias);
            merged.push({ id: r.alias });
          }
        }
        data.data =
          key.allowedModels.length > 0
            ? merged.filter((m) => key.allowedModels.includes(m.id))
            : merged;
      }
      touchKey(key.id);
      log(upRes.status, null, 0);
      return NextResponse.json(data, { status: upRes.status });
    } catch {
      // jatuh ke pass-through biasa
    }
  }

  const upCt = upRes.headers.get("content-type") ?? "";
  const headers = new Headers();
  if (upCt) headers.set("content-type", upCt);

  // ---- respons JSON biasa: catat usage ----
  if (upCt.includes("json") && upRes.body) {
    const text = await upRes.text();
    let tokens = 0;
    try {
      tokens = extractUsage(JSON.parse(text));
      touchKey(key.id);
      addTokens(key.id, tokens);
    } catch {
      /* abaikan */
    }
    log(upRes.status, typeof model === "string" ? model : null, tokens);
    return new Response(text, { status: upRes.status, headers });
  }

  // ---- SSE / stream: teruskan sambil intip usage ----
  if (upRes.body && (upCt.includes("event-stream") || targetPath.includes("/chat/completions"))) {
    let buf = "";
    const tap = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctrl) {
        ctrl.enqueue(chunk);
        buf += new TextDecoder().decode(chunk);
        if (buf.length > 512_000) buf = buf.slice(-256_000);
      },
      flush() {
        try {
          // ambil payload usage terakhir dari event SSE
          const matches = [
            ...buf.matchAll(/"total_tokens"\s*:\s*(\d+)/g),
          ].map((m) => Number(m[1]));
          let total = matches.length ? matches[matches.length - 1] : 0;
          if (!total) {
            const io = [...buf.matchAll(/"(?:input|prompt)_tokens"\s*:\s*(\d+)[^}]*?"(?:output|completion)_tokens"\s*:\s*(\d+)/g)];
            if (io.length) {
              const last = io[io.length - 1];
              total = Number(last[1]) + Number(last[2]);
            }
          }
          touchKey(key.id);
          addTokens(key.id, total);
        } catch {
          /* abaikan */
        }
      },
    });
    log(upRes.status, typeof model === "string" ? model : null, 0);
    return new Response(upRes.body.pipeThrough(tap), { status: upRes.status, headers });
  }

  touchKey(key.id);
  log(upRes.status, typeof model === "string" ? model : null, 0);
  return new Response(upRes.body, { status: upRes.status, headers });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;

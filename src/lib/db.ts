import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";

export interface ShareKey {
  id: string;
  name: string;
  /** sha256 dari key asli — key asli tidak disimpan */
  keyHash: string;
  prefix: string;
  /** kosong = semua model boleh */
  allowedModels: string[];
  /** 0 = tanpa batas per request */
  maxTokensPerRequest: number;
  /** 0 = tanpa budget total */
  budgetTokens: number;
  usedTokens: number;
  /** 0 = tanpa batas RPM */
  rpmLimit: number;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface Provider {
  id: string;
  name: string;
  /** https://host tanpa trailing slash, cth https://api.openai.com */
  baseUrl: string;
  /** Bearer key mentah ke upstream (disimpan lokal di db.json) */
  apiKey: string;
  /**
   * Pola model yg diarahkan ke provider ini.
   * - "gpt-4o" = cocok persis
   * - "gpt-*" / "claude-*" = awalan (prefix)
   * Kosong = tidak auto-match (hanya fallback bila jadi default).
   */
  models: string[];
  enabled: boolean;
  createdAt: string;
}

interface DbShape {
  keys: ShareKey[];
  providers: Provider[];
  /** Pola model yg diizinkan lewat default 9router. Kosong = semua. */
  defaultModels: string[];
  /** Alias routing: nama yg dilihat user → id model asli di upstream. */
  modelRoutes: ModelRoute[];
}

/** Satu alias routing. Contoh: { alias:"sonnet-5", target:"<id asli>", displayName:"Sonnet 5" } */
export interface ModelRoute {
  alias: string;
  target: string;
  displayName: string;
}

function dbPath(): string {
  return process.env.DB_PATH ?? join(process.cwd(), "data", "db.json");
}

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function loadDb(): DbShape {
  const p = dbPath();
  try {
    if (!existsSync(p)) return { keys: [], providers: [], defaultModels: [], modelRoutes: [] };
    const parsed = JSON.parse(readFileSync(p, "utf8")) as Partial<DbShape>;
    const keys = Array.isArray(parsed.keys) ? parsed.keys : [];
    // backfill: key lama yg belum punya rpmLimit
    for (const k of keys) {
      if (typeof (k as ShareKey).rpmLimit !== "number") (k as ShareKey).rpmLimit = 0;
      if (!Array.isArray(k.allowedModels)) k.allowedModels = [];
      if (typeof k.maxTokensPerRequest !== "number") k.maxTokensPerRequest = 0;
      // default lama 1jt → bebas (efektif dibatasi sisa budget + RPM)
      if (k.maxTokensPerRequest === 1000000) k.maxTokensPerRequest = 0;
      if (typeof k.budgetTokens !== "number") k.budgetTokens = 0;
      if (typeof k.usedTokens !== "number") k.usedTokens = 0;
    }
    return {
      keys,
      providers: Array.isArray(parsed.providers) ? parsed.providers : [],
      defaultModels: Array.isArray(parsed.defaultModels) ? parsed.defaultModels : [],
      modelRoutes: Array.isArray(parsed.modelRoutes) ? parsed.modelRoutes : [],
    };
  } catch {
    return { keys: [], providers: [], defaultModels: [], modelRoutes: [] };
  }
}

export function saveDb(db: DbShape): void {
  const p = dbPath();
  mkdirSync(join(p, ".."), { recursive: true });
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  // tulis atomik sederhana (rename); fallback ke tulis langsung
  try {
    renameSync(tmp, p);
  } catch {
    writeFileSync(p, JSON.stringify(db, null, 2));
  }
}

export function findKeyByRaw(raw: string): ShareKey | null {
  const h = hashKey(raw);
  const db = loadDb();
  return db.keys.find((k) => k.keyHash === h) ?? null;
}

export function addTokens(id: string, tokens: number): void {
  if (tokens <= 0) return;
  const db = loadDb();
  const k = db.keys.find((x) => x.id === id);
  if (!k) return;
  k.usedTokens += tokens;
  k.lastUsedAt = new Date().toISOString();
  saveDb(db);
}

export function touchKey(id: string): void {
  const db = loadDb();
  const k = db.keys.find((x) => x.id === id);
  if (!k) return;
  k.lastUsedAt = new Date().toISOString();
  saveDb(db);
}

export function mintKey(): { raw: string; prefix: string } {
  const raw = `rx-${randomBytes(24).toString("hex")}`;
  return { raw, prefix: raw.slice(0, 7) };
}

export function publicKey(k: ShareKey): Omit<ShareKey, "keyHash"> {
  const { keyHash: _drop, ...rest } = k;
  return rest;
}

/** Cocokkan satu pola ("gpt-4o" persis / "gpt-*" awalan) ke nama model. */
export function providerPatternMatches(pattern: string, model: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  if (p.endsWith("*")) return model.startsWith(p.slice(0, -1));
  return model === p;
}

/** Provider custom yg enabled + cocok utk model ini (pertama yg cocok). */
export function matchProvider(model: string | undefined): Provider | null {
  if (!model) return null;
  const db = loadDb();
  for (const p of db.providers) {
    if (!p.enabled) continue;
    if ((p.models ?? []).some((pat) => providerPatternMatches(pat, model))) return p;
  }
  return null;
}

/** Pola model yg diizinkan lewat default 9router (kosong = semua). */
export function getDefaultModels(): string[] {
  return loadDb().defaultModels ?? [];
}

export function setDefaultModels(models: string[]): string[] {
  const db = loadDb();
  db.defaultModels = [...new Set(models.map((m) => m.trim()).filter(Boolean))].slice(0, 200);
  saveDb(db);
  return db.defaultModels;
}

/** Cek model terhadap allowlist default (kosong = boleh semua). */
export function defaultModelAllowed(model: string): boolean {
  const allowed = getDefaultModels();
  if (allowed.length === 0) return true;
  return allowed.some((pat) => providerPatternMatches(pat, model));
}

/** ---- Model routing (alias → id asli upstream) ---- */

export function getModelRoutes(): ModelRoute[] {
  return loadDb().modelRoutes ?? [];
}

/** Resolve alias ke id asli. Tanpa alias yg cocok → kembalikan apa adanya. */
export function resolveModel(name: string): string {
  const r = getModelRoutes().find((x) => x.alias === name);
  return r ? r.target : name;
}

/** Upsert satu alias. Alias: huruf/angka/dot/dash/underscore/colon. */
export function upsertModelRoute(alias: string, target: string, displayName: string): ModelRoute {
  const a = alias.trim();
  const t = target.trim();
  if (!/^[A-Za-z0-9._:\/-]{1,120}$/.test(a)) throw new Error("alias tidak valid");
  if (!t) throw new Error("target model wajib diisi");
  const db = loadDb();
  const cur = Array.isArray(db.modelRoutes) ? db.modelRoutes : [];
  const route: ModelRoute = { alias: a, target: t, displayName: displayName.trim().slice(0, 120) };
  const i = cur.findIndex((x) => x.alias === a);
  if (i >= 0) cur[i] = route;
  else {
    if (cur.length >= 200) throw new Error("maksimal 200 routing");
    cur.push(route);
  }
  db.modelRoutes = cur;
  saveDb(db);
  return route;
}

export function deleteModelRoute(alias: string): boolean {
  const db = loadDb();
  const cur = Array.isArray(db.modelRoutes) ? db.modelRoutes : [];
  const next = cur.filter((x) => x.alias !== alias);
  if (next.length === cur.length) return false;
  db.modelRoutes = next;
  saveDb(db);
  return true;
}

/** Tampilan aman utk API admin: apiKey disamarkan. */
export function publicProvider(p: Provider): Omit<Provider, "apiKey"> & {
  apiKeySet: boolean;
  apiKeyHint: string;
} {
  const { apiKey, ...rest } = p;
  return {
    ...rest,
    apiKeySet: !!apiKey,
    apiKeyHint: apiKey ? `••••${apiKey.slice(-4)}` : "",
  };
}

export function normalizeBaseUrl(u: string): string {
  return u.trim().replace(/\/$/, "");
}

/** ---- Riwayat request proxy (disimpan terpisah, max 200 terbaru) ---- */

export interface RequestLog {
  id: string;
  at: string;
  keyId: string;
  keyName: string;
  prefix: string;
  method: string;
  path: string;
  model: string | null;
  status: number;
  ok: boolean;
  tokens: number;
}

const MAX_LOGS = 200;

function logPath(): string {
  return process.env.REQUEST_LOG_PATH ?? join(process.cwd(), "data", "requests.json");
}

export function appendRequestLog(e: Omit<RequestLog, "id" | "at">): void {
  try {
    const p = logPath();
    mkdirSync(join(p, ".."), { recursive: true });
    let arr: RequestLog[] = [];
    try {
      if (existsSync(p)) {
        const parsed = JSON.parse(readFileSync(p, "utf8"));
        if (Array.isArray(parsed)) arr = parsed as RequestLog[];
      }
    } catch {
      arr = [];
    }
    const now = new Date().toISOString();
    arr.push({ ...e, id: `${Date.now()}-${randomBytes(4).toString("hex")}`, at: now });
    if (arr.length > MAX_LOGS) arr = arr.slice(-MAX_LOGS);
    const tmp = `${p}.tmp`;
    writeFileSync(tmp, JSON.stringify(arr, null, 2));
    try {
      renameSync(tmp, p);
    } catch {
      writeFileSync(p, JSON.stringify(arr, null, 2));
    }
  } catch {
    /* log gagal = abaikan, jangan ganggu proxy */
  }
}

export function readRequestLogs(limit = 50): RequestLog[] {
  try {
    const p = logPath();
    if (!existsSync(p)) return [];
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    if (!Array.isArray(parsed)) return [];
    const arr = parsed as RequestLog[];
    return arr.slice(-limit).reverse();
  } catch {
    return [];
  }
}

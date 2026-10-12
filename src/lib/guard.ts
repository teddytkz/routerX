import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionUser } from "./auth";

export function adminAuthed(req: Request): boolean {
  const keys = [process.env.ADMIN_KEY, process.env.ADMIN_PASS].filter(Boolean);
  if (keys.length === 0) return false;
  return keys.includes(req.headers.get("x-admin-key") ?? undefined);
}

function cookieSession(req: Request): string | undefined {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Lolos bila header x-admin-key cocok ATAU cookie sesi login valid. */
export async function needAdmin(req: Request): Promise<NextResponse | null> {
  if (!process.env.ADMIN_KEY && !process.env.ADMIN_PASS) {
    return NextResponse.json(
      { error: "ADMIN_KEY/ADMIN_PASS belum diset di environment" },
      { status: 500 },
    );
  }
  if (adminAuthed(req)) return null;
  const user = await sessionUser(cookieSession(req));
  if (user) return null;
  return NextResponse.json({ error: "belum login" }, { status: 401 });
}

export function upstream(): string {
  return (process.env.UPSTREAM ?? "http://127.0.0.1:20128").replace(/\/$/, "");
}

/** Ambil Bearer token dari header Authorization. */
export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Paksa batas max token per request ke body (OpenAI + Anthropic + Responses).
 * Mengembalikan body baru (clamp ke bawah) + flag apakah diubah.
 */
export function clampTokens<T>(body: T, limit: number): { body: T; clamped: boolean } {
  if (!limit || limit <= 0 || typeof body !== "object" || body === null) {
    return { body, clamped: false };
  }
  const b = body as Record<string, unknown>;
  const out = { ...b };
  let clamped = false;
  for (const field of ["max_tokens", "max_completion_tokens", "max_output_tokens"]) {
    const v = out[field];
    if (typeof v === "number" && v > limit) {
      out[field] = limit;
      clamped = true;
    }
    // Anthropic max_tokens wajib ada: isi default bila hilang
    if (field === "max_tokens" && out[field] == null) {
      out[field] = limit;
      clamped = true;
    }
  }
  return { body: out as T, clamped };
}

/** Ekstrak total token dari body respons JSON (OpenAI / Anthropic / Responses). */
export function extractUsage(payload: unknown): number {
  if (typeof payload !== "object" || payload === null) return 0;
  const p = payload as Record<string, unknown>;
  const u = p.usage as Record<string, unknown> | undefined;
  if (u && typeof u === "object") {
    if (typeof u.total_tokens === "number") return u.total_tokens;
    const pt = typeof u.prompt_tokens === "number" ? u.prompt_tokens : 0;
    const ct = typeof u.completion_tokens === "number" ? u.completion_tokens : 0;
    const it = typeof u.input_tokens === "number" ? u.input_tokens : 0;
    const ot = typeof u.output_tokens === "number" ? u.output_tokens : 0;
    const sum = pt + ct + it + ot;
    if (sum > 0) return sum;
  }
  return 0;
}

// Auth dashboard: login username+password -> session cookie (HMAC, stateless).
// File ini edge-safe (hanya WebCrypto) agar bisa dipakai middleware + route handler.

export const SESSION_COOKIE = "rx_sess";
const SESSION_DAYS = 7;

export function adminUser(): string {
  return process.env.ADMIN_USER || "admin";
}

function adminPass(): string {
  return process.env.ADMIN_PASS || process.env.ADMIN_KEY || "";
}

const enc = new TextEncoder();

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function verifyPassword(input: string): Promise<boolean> {
  const real = adminPass();
  if (!real || !input) return false;
  const [a, b] = await Promise.all([
    hmacHex(`pw:${real}`, "routerx-login"),
    hmacHex(`pw:${input}`, "routerx-login"),
  ]);
  return safeEqual(a, b);
}

function b64urlEncode(s: string): string {
  const bytes = enc.encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(out);
}

/** Format cookie: b64url(username).exp.sig */
export async function mintSession(username: string): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86_400_000;
  const pass = adminPass() || "unset";
  const sig = await hmacHex(`sess:${pass}`, `${username}.${exp}`);
  return `${b64urlEncode(username)}.${exp}.${sig}`;
}

/** Kembalikan username bila cookie valid, else null. */
export async function sessionUser(raw: string | undefined | null): Promise<string | null> {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [u, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  let username: string;
  try {
    username = b64urlDecode(u);
  } catch {
    return null;
  }
  if (username !== adminUser()) return null;
  const pass = adminPass() || "unset";
  const expect = await hmacHex(`sess:${pass}`, `${username}.${exp}`);
  return safeEqual(expect, sig) ? username : null;
}

export function sessionMaxAge(): number {
  return SESSION_DAYS * 86_400;
}

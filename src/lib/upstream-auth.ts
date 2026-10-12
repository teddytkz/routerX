import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

let cached: string | null = null;

/**
 * Token CLI 9router: sha256(machineId + "9r-cli-auth" + cliSecret)[0:16].
 * Header x-9r-cli-token ini diakui server 9router lokal sebagai auth
 * setara CLI (melewati requireApiKey) — tanpa perlu menyimpan sk- key.
 * Hanya berfungsi di mesin yang sama (baca ~/.9router).
 */
export function cliToken(): string | null {
  if (cached !== null) return cached || null;
  try {
    const dir = join(process.env.NINEROUTER_DIR ?? join(homedir(), ".9router"));
    const mid = join(dir, "machine-id");
    const sec = join(dir, "auth", "cli-secret");
    if (!existsSync(mid) || !existsSync(sec)) {
      cached = "";
      return null;
    }
    const raw = readFileSync(mid, "utf8").trim();
    const secret = readFileSync(sec, "utf8").trim();
    if (!raw || !secret) {
      cached = "";
      return null;
    }
    cached = createHash("sha256").update(raw + "9r-cli-auth" + secret).digest("hex").slice(0, 16);
    return cached;
  } catch {
    cached = "";
    return null;
  }
}

export function tokensEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

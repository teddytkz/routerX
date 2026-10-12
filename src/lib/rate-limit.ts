/** Tracker RPM per key — simpel in-memory sliding window. */

interface Window {
  /** timestamp request dalam ms */
  hits: number[];
}

const store = new Map<string, Window>();

export function checkRpm(keyId: string, limit: number): { ok: boolean; current: number } {
  if (limit <= 0) return { ok: true, current: 0 };
  const now = Date.now();
  const oneMin = 60_000;
  const cutoff = now - oneMin;

  let w = store.get(keyId);
  if (!w) {
    w = { hits: [] };
    store.set(keyId, w);
  }

  // buang hits >1 menit
  w.hits = w.hits.filter((t) => t > cutoff);

  const current = w.hits.length;
  if (current >= limit) return { ok: false, current };

  w.hits.push(now);
  return { ok: true, current: current + 1 };
}

/** Jumlah request dalam 1 menit terakhir tanpa mencatat (untuk tampilan /usage). */
export function peekRpm(keyId: string): number {
  const w = store.get(keyId);
  if (!w) return 0;
  const cutoff = Date.now() - 60_000;
  w.hits = w.hits.filter((t) => t > cutoff);
  return w.hits.length;
}

import { NextResponse } from "next/server";
import { loadDb, saveDb, mintKey, hashKey, publicKey } from "@/lib/db";
import { needAdmin } from "@/lib/guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Terbitkan ulang key: key lama langsung mati, key baru hanya dikembalikan SEKALI. */
export async function POST(req: Request, ctx: Ctx) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const db = loadDb();
  const k = db.keys.find((x) => x.id === id);
  if (!k) return NextResponse.json({ error: "key tidak ditemukan" }, { status: 404 });
  const { raw, prefix } = mintKey();
  k.keyHash = hashKey(raw);
  k.prefix = prefix;
  saveDb(db);
  return NextResponse.json({ key: raw, info: publicKey(k) });
}

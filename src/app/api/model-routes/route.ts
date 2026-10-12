import { NextResponse } from "next/server";
import { getModelRoutes, upsertModelRoute, deleteModelRoute } from "@/lib/db";
import { needAdmin } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ routes: getModelRoutes() });
}

export async function POST(req: Request) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  let body: { alias?: string; target?: string; displayName?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }
  try {
    const route = upsertModelRoute(body.alias ?? "", body.target ?? "", body.displayName ?? "");
    return NextResponse.json({ route });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  const alias = new URL(req.url).searchParams.get("alias") ?? "";
  if (!alias) return NextResponse.json({ error: "alias wajib diisi" }, { status: 400 });
  if (!deleteModelRoute(alias))
    return NextResponse.json({ error: "alias tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

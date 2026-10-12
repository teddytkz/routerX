import { NextResponse } from "next/server";
import { readRequestLogs } from "@/lib/db";
import { needAdmin } from "@/lib/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = await needAdmin(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1), 200);
  return NextResponse.json({ requests: readRequestLogs(limit) });
}

"use client";

import * as React from "react";
import Link from "next/link";
import { History, RefreshCw, Server } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReqRow = {
  id: string;
  at: string;
  keyName: string;
  prefix: string;
  method: string;
  path: string;
  model: string | null;
  status: number;
  ok: boolean;
  tokens: number;
};

const fmt = (n: number) => n.toLocaleString("id-ID");
const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleString("id-ID");
  } catch {
    return s;
  }
};

export default function DashboardPage() {
  const [keyCount, setKeyCount] = React.useState(0);
  const [activeCount, setActiveCount] = React.useState(0);
  const [totalUsed, setTotalUsed] = React.useState(0);
  const [upOk, setUpOk] = React.useState<boolean | null>(null);
  const [reqs, setReqs] = React.useState<ReqRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [baseUrl, setBaseUrl] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [rk, ru, rh, rr] = await Promise.all([
        fetch("/api/keys"),
        fetch("/api/usage"),
        fetch("/api/health"),
        fetch("/api/requests?limit=20"),
      ]);
      if (rk.ok) {
        const d = (await rk.json()) as { keys: { active: boolean }[] };
        const keys = d.keys ?? [];
        setKeyCount(keys.length);
        setActiveCount(keys.filter((k) => k.active).length);
      }
      if (ru.ok) {
        const d = (await ru.json()) as { totalUsed: number };
        setTotalUsed(d.totalUsed ?? 0);
      }
      if (rh.ok) {
        const d = (await rh.json()) as { upstream: { ok?: boolean } | null };
        setUpOk(d.upstream && typeof d.upstream.ok === "boolean" ? d.upstream.ok : null);
      }
      if (rr.ok) {
        const d = (await rr.json()) as { requests: ReqRow[] };
        setReqs(d.requests ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setBaseUrl(window.location.origin);
    load();
  }, [load]);

  return (
    <DashboardShell title="Ringkasan">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Share key aktif</CardDescription>
            <CardTitle className="text-2xl">{loading ? "…" : `${activeCount}/${keyCount}`}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total token terpakai</CardDescription>
            <CardTitle className="text-2xl">{loading ? "…" : fmt(totalUsed)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Upstream 9router</CardDescription>
            <CardTitle className="text-2xl">
              {upOk === null ? "…" : upOk ? "Online" : "Down"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="size-4" /> URL Koneksi
          </CardTitle>
          <CardDescription>
            Ganti base URL aplikasi OpenAI-compatible dengan URL di bawah, lalu pakai share key
            sebagai Bearer token.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input readOnly value={baseUrl || "…"} className="font-mono" />
            {baseUrl && <CopyButton text={baseUrl} label="Salin URL" />}
          </div>
          <p className="text-muted-foreground font-mono text-xs">
            Contoh endpoint: {baseUrl}/v1/chat/completions
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4" /> History Request
            </CardTitle>
            <CardDescription>20 request terakhir yang lewat proxy.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="mr-1 size-3" /> Muat ulang
            </Button>
            <Button size="sm" nativeButton={false} render={<Link href="/keys">Kelola Key</Link>} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Memuat…</p>
          ) : reqs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Belum ada request. Coba panggil <span className="font-mono">/v1/chat/completions</span>{" "}
              dengan share key.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Token</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reqs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.at)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{r.keyName}</span>{" "}
                      <code className="text-muted-foreground text-[11px]">{r.prefix}</code>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.method} {r.path}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.model ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.ok ? "default" : "destructive"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.tokens > 0 ? fmt(r.tokens) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

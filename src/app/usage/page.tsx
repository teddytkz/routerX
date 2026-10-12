"use client";

import * as React from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Row = {
  id: string;
  name: string;
  prefix: string;
  active: boolean;
  usedTokens: number;
  budgetTokens: number;
  remaining: number | null;
  rpmLimit: number;
  rpmUsed: number;
  lastUsedAt: string | null;
};

const fmt = (n: number) => n.toLocaleString("id-ID");
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString("id-ID") : "—";

export default function UsagePage() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setRows(d.keys ?? []);
          setTotal(d.totalUsed ?? 0);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell title="Penggunaan">
      <Card>
        <CardHeader>
          <CardDescription>Total token terpakai semua key</CardDescription>
          <CardTitle className="text-2xl">{loading ? "…" : fmt(total)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Per key</CardTitle>
          <CardDescription>Pemakaian token + sisa budget tiap share key.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Memuat…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada key.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Terpakai</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Sisa</TableHead>
                  <TableHead>RPM (1 mnt)</TableHead>
                  <TableHead>Terakhir dipakai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.prefix}••••</TableCell>
                    <TableCell>{fmt(r.usedTokens)}</TableCell>
                    <TableCell>{r.budgetTokens > 0 ? fmt(r.budgetTokens) : "∞"}</TableCell>
                    <TableCell>{r.remaining === null ? "∞" : fmt(r.remaining)}</TableCell>
                    <TableCell>
                      {r.rpmLimit > 0 ? `${r.rpmUsed ?? 0} / ${r.rpmLimit}` : "∞"}
                    </TableCell>
                    <TableCell>{fmtDate(r.lastUsedAt)}</TableCell>
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

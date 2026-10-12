"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Route = { alias: string; target: string; displayName: string };

export default function RoutesPage() {
  const [routes, setRoutes] = React.useState<Route[]>([]);
  const [loading, setLoading] = React.useState(true);

  // target picker dari model live
  const [live, setLive] = React.useState<string[]>([]);
  const [liveLoading, setLiveLoading] = React.useState(false);
  const [targetFilter, setTargetFilter] = React.useState("");

  const [showAdd, setShowAdd] = React.useState(false);
  const [alias, setAlias] = React.useState("");
  const [target, setTarget] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<Route | null>(null);
  const [confirm, setConfirm] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/model-routes");
      const d = (await r.json()) as { routes?: Route[] };
      setRoutes(d.routes ?? []);
    } catch {
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function ensureLive() {
    if (live.length > 0 || liveLoading) return;
    setLiveLoading(true);
    try {
      const r = await fetch("/api/models");
      const d = (await r.json()) as { models?: string[] };
      setLive(d.models ?? []);
    } catch {
      setLive([]);
    } finally {
      setLiveLoading(false);
    }
  }

  function openAdd() {
    setAlias("");
    setTarget("");
    setDisplayName("");
    setTargetFilter("");
    setFormErr(null);
    setShowAdd(true);
    void ensureLive();
  }

  function openEdit(r: Route) {
    setEditing(r);
    setTarget(r.target);
    setDisplayName(r.displayName);
    setTargetFilter("");
    setFormErr(null);
    void ensureLive();
  }

  async function save(toAlias: string) {
    setSaving(true);
    setFormErr(null);
    try {
      const r = await fetch("/api/model-routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alias: toAlias, target, displayName }),
      });
      const d = (await r.json()) as { route?: Route; error?: string };
      if (!r.ok || !d.route) {
        setFormErr(d.error ?? "Gagal menyimpan");
        return;
      }
      setShowAdd(false);
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: string) {
    try {
      await fetch(`/api/model-routes?alias=${encodeURIComponent(a)}`, { method: "DELETE" });
    } finally {
      setConfirm(null);
      await load();
    }
  }

  const filtered = live.filter((m) => m.toLowerCase().includes(targetFilter.toLowerCase())).slice(0, 100);

  const targetPicker = (
    <div className="grid gap-2">
      <Label>Target — id model asli di upstream</Label>
      <Input
        placeholder="cth planner-01 / gpt-4o…"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="font-mono text-xs"
      />
      <Input
        placeholder="Cari model live…"
        value={targetFilter}
        onChange={(e) => setTargetFilter(e.target.value)}
        className="text-xs"
      />
      <div className="border-input max-h-40 overflow-auto rounded-md border p-2">
        {liveLoading ? (
          <p className="text-muted-foreground text-xs">Memuat model…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-xs">Tidak ada model yg cocok.</p>
        ) : (
          <div className="grid gap-1">
            {filtered.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTarget(m)}
                className={`rounded px-2 py-1 text-left font-mono text-xs hover:bg-accent ${
                  target === m ? "bg-accent font-medium" : ""
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <DashboardShell title="Routing Model">
      <div className="flex justify-end">
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Tambah routing
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Alias → model asli</CardTitle>
          <CardDescription>
            User cukup kirim alias (cth <code>sonnet-5</code>); RouterX meneruskannya sebagai id model
            asli ke upstream. Alias otomatis muncul di <code>/v1/models</code> dan checklist
            /keys & /providers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Memuat…</p>
          ) : routes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Belum ada routing.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alias (user)</TableHead>
                  <TableHead>Nama tampilan</TableHead>
                  <TableHead>Target (upstream)</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((r) => (
                  <TableRow key={r.alias}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-xs font-medium">{r.alias}</code>
                        <CopyButton text={r.alias} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.displayName ? <Badge variant="outline">{r.displayName}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.target}</TableCell>
                    <TableCell className="text-right">
                      {confirm === r.alias ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="destructive" size="sm" onClick={() => void remove(r.alias)}>
                            Hapus?
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(r)} title="Edit routing">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirm(r.alias)} title="Hapus routing">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={(o) => (!o ? setShowAdd(false) : null)}>
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Tambah routing</DialogTitle>
            <DialogDescription>cth alias sonnet-5 → target model 9router + nama Sonnet 5</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Alias — nama yg dikirim user</Label>
              <Input placeholder="sonnet-5" value={alias} onChange={(e) => setAlias(e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="grid gap-2">
              <Label>Nama tampilan (opsional)</Label>
              <Input placeholder="Sonnet 5" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            {targetPicker}
            {formErr && <p className="text-destructive text-sm">{formErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={() => void save(alias)} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => (!o ? setEditing(null) : null)}>
        <DialogContent className="max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Edit routing {editing?.alias}</DialogTitle>
            <DialogDescription>Alias tidak bisa diubah — hapus lalu buat baru bila perlu ganti nama</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nama tampilan (opsional)</Label>
              <Input placeholder="Sonnet 5" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            {targetPicker}
            {formErr && <p className="text-destructive text-sm">{formErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={() => editing && void save(editing.alias)} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

"use client";

import * as React from "react";
import { Plus, Trash2, Power, PowerOff, Pencil } from "lucide-react";
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

type Provider = {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  enabled: boolean;
  createdAt: string;
  apiKeySet: boolean;
  apiKeyHint: string;
  builtIn?: boolean;
};

export default function ProvidersPage() {
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [showAdd, setShowAdd] = React.useState(false);
  const [formName, setFormName] = React.useState("");
  const [formUrl, setFormUrl] = React.useState("");
  const [formKey, setFormKey] = React.useState("");
  const [formModels, setFormModels] = React.useState("");

  const [editing, setEditing] = React.useState<Provider | null>(null);
  const [editModels, setEditModels] = React.useState("");
  const [editName, setEditName] = React.useState("");
  const [editUrl, setEditUrl] = React.useState("");
  const [editKey, setEditKey] = React.useState("");

  // state khusus edit default 9router via checkbox dari /api/models
  const [liveModels, setLiveModels] = React.useState<string[]>([]);
  const [liveLoading, setLiveLoading] = React.useState(false);
  const [restrict, setRestrict] = React.useState(false);
  const [picked, setPicked] = React.useState<string[]>([]);
  const [extraPat, setExtraPat] = React.useState("");
  const [modelFilter, setModelFilter] = React.useState("");

  React.useEffect(() => {
    void fetch("/api/providers")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { providers: Provider[] }) => setProviders(d.providers ?? []))
      .catch(() => setProviders([]));
  }, []);

  const handleAdd = async () => {
    if (!formName.trim() || !formUrl.trim() || !formKey.trim()) return;
    const models = formModels.split(",").map((m) => m.trim()).filter(Boolean);
    if (models.length === 0) return;

    setLoading(true);
    try {
      const r = await fetch("/api/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), baseUrl: formUrl.trim(), apiKey: formKey, models }),
      });
      if (!r.ok) throw new Error("Gagal tambah provider");
      const data = (await r.json()) as { provider: Provider };
      setProviders((old) => [...old, data.provider]);
      setShowAdd(false);
      setFormName("");
      setFormUrl("");
      setFormKey("");
      setFormModels("");
    } catch {
      alert("Gagal tambah provider");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/providers/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!r.ok) throw new Error("Gagal toggle");
      const data = (await r.json()) as { provider: Provider };
      setProviders((old) => old.map((p) => (p.id === id ? data.provider : p)));
    } catch {
      alert("Gagal toggle provider");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus provider ini?")) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/providers/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Gagal hapus");
      setProviders((old) => old.filter((p) => p.id !== id));
    } catch {
      alert("Gagal hapus provider");
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (p: Provider) => {
    setEditing(p);
    setEditModels((p.models ?? []).join(", "));
    setEditName(p.name ?? "");
    setEditUrl(p.baseUrl ?? "");
    setEditKey("");
    if (p.builtIn) {
      // ambil daftar live dari /api/models utk checkbox
      const cur = p.models ?? [];
      const pats = cur.filter((m) => m.includes("*"));
      const exact = cur.filter((m) => !m.includes("*"));
      setRestrict(cur.length > 0);
      setPicked(exact);
      setExtraPat(pats.join(", "));
      setModelFilter("");
      setLiveLoading(true);
      fetch("/api/models")
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((d: { models?: string[]; providers?: { id: string; models: string[] }[] }) => {
          const defLive =
            d.providers?.find((x) => x.id === "default")?.models ?? d.models ?? [];
          setLiveModels(defLive);
          // kalau sebelumnya "semua boleh", default centang semua
          if (cur.length === 0) setPicked(defLive);
        })
        .catch(() => setLiveModels([]))
        .finally(() => setLiveLoading(false));
    }
  };

  const togglePick = (m: string) =>
    setPicked((old) => (old.includes(m) ? old.filter((x) => x !== m) : [...old, m]));

  const handleSaveEdit = async () => {
    if (!editing) return;
    const models = editing.builtIn
      ? restrict
        ? [...picked, ...extraPat.split(",").map((m) => m.trim()).filter(Boolean)]
        : []
      : editModels.split(",").map((m) => m.trim()).filter(Boolean);
    const body: Record<string, unknown> = { models };
    if (!editing.builtIn) {
      if (editName.trim()) body.name = editName.trim();
      if (editUrl.trim()) body.baseUrl = editUrl.trim();
      // kosong = tidak diubah (key lama tetap dipakai)
      if (editKey.trim()) body.apiKey = editKey.trim();
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/providers/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Gagal simpan");
      const data = (await r.json()) as { provider: Provider };
      setProviders((old) =>
        old.map((p) =>
          p.id === editing.id ? { ...p, ...data.provider, models: data.provider.models ?? models } : p,
        ),
      );
      setEditing(null);
    } catch {
      alert("Gagal simpan perubahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell title="Provider">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Provider</CardTitle>
                <CardDescription>Backend OpenAI-compatible, routing per-model</CardDescription>
              </div>
              <Button onClick={() => setShowAdd(true)} disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                Tambah
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {providers.length === 0 ? (
              <p className="text-muted-foreground text-sm">Memuat…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Base URL</TableHead>
                    <TableHead>Models</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {p.builtIn && <Badge variant="secondary">Default</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs">{p.baseUrl}</code>
                          <CopyButton text={p.baseUrl} />
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.models.length === 0 ? (
                          <span className="text-muted-foreground text-xs">
                            {p.builtIn ? "semua model upstream" : "—"}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {p.models.map((m, i) => (
                              <Badge key={i} variant="outline">
                                {m}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-muted-foreground text-xs">{p.apiKeyHint}</code>
                      </TableCell>
                      <TableCell>
                        {p.builtIn ? (
                          <span className="inline-flex items-center text-sm">
                            <Power className="mr-1 h-3 w-3 text-green-500" />
                            <span className="text-green-600">Aktif</span>
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggle(p.id, !p.enabled)}
                            disabled={loading}
                          >
                            {p.enabled ? (
                              <>
                                <Power className="mr-1 h-3 w-3 text-green-500" />
                                <span className="text-green-600">Aktif</span>
                              </>
                            ) : (
                              <>
                                <PowerOff className="mr-1 h-3 w-3 text-gray-400" />
                                <span className="text-muted-foreground">Mati</span>
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(p)}
                            disabled={loading}
                            title={p.builtIn ? "Edit model yg diizinkan" : "Edit nama, base URL, key, pola model"}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!p.builtIn && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleDelete(p.id)}
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah provider</DialogTitle>
              <DialogDescription>Backend OpenAI-compatible baru</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nama</Label>
                <Input
                  id="name"
                  placeholder="openai"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">Base URL</Label>
                <Input
                  id="url"
                  placeholder="https://api.openai.com"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="key">API Key</Label>
                <Input
                  id="key"
                  type="password"
                  placeholder="sk-..."
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="models">Pola model</Label>
                <Input
                  id="models"
                  placeholder="gpt-4o, gpt-*"
                  value={formModels}
                  onChange={(e) => setFormModels(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Pisah koma. Persis: gpt-4o, awalan: gpt-*
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)} disabled={loading}>
                Batal
              </Button>
              <Button onClick={() => void handleAdd()} disabled={loading}>
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit {editing?.builtIn ? "default 9router" : "provider"}
              </DialogTitle>
              <DialogDescription>
                {editing?.builtIn
                  ? "Model apa saja yg boleh lewat default 9router. Kosongkan = semua model boleh."
                  : "Nama, base URL, API key, dan pola model provider ini."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {editing?.builtIn ? (
                <>
                  <p className="rounded border text-muted-foreground bg-muted/50 px-2 py-1.5 font-mono text-[11px]">
                    {editing.baseUrl} · key: {editing.apiKeyHint || "env/CLI"}
                    <span className="font-sans"> — dari env/fileserver, tidak diubah dari sini.</span>
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="size-4 accent-current"
                      checked={restrict}
                      onChange={(e) => setRestrict(e.target.checked)}
                    />
                    Batasi hanya model terpilih
                  </label>
                  {!restrict ? (
                    <p className="text-muted-foreground text-xs">
                      Semua model upstream boleh lewat default 9router.
                    </p>
                  ) : liveLoading ? (
                    <p className="text-muted-foreground text-xs">Memuat daftar model…</p>
                  ) : liveModels.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Daftar model kosong (upstream tidak terjangkau?) — isi pola manual di bawah.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Cari model…"
                          value={modelFilter}
                          onChange={(e) => setModelFilter(e.target.value)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPicked(
                              liveModels.filter((m) =>
                                m.toLowerCase().includes(modelFilter.toLowerCase()),
                              ),
                            )
                          }
                        >
                          Semua
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPicked([])}>
                          Nol
                        </Button>
                      </div>
                      <div className="max-h-64 overflow-auto rounded border p-2">
                        {liveModels
                          .filter((m) =>
                            m.toLowerCase().includes(modelFilter.toLowerCase()),
                          )
                          .map((m) => (
                            <label
                              key={m}
                              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 font-mono text-xs hover:bg-muted"
                            >
                              <input
                                type="checkbox"
                                className="size-4 accent-current"
                                checked={picked.includes(m)}
                                onChange={() => togglePick(m)}
                              />
                              {m}
                            </label>
                          ))}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {picked.length} dipilih
                      </p>
                    </>
                  )}
                  {restrict && (
                    <div className="grid gap-2">
                      <Label htmlFor="edit-extra">Pola tambahan (opsional)</Label>
                      <Input
                        id="edit-extra"
                        placeholder="cth: gpt-*"
                        value={extraPat}
                        onChange={(e) => setExtraPat(e.target.value)}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-name">Nama</Label>
                    <Input
                      id="edit-name"
                      placeholder="openai"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-url">Base URL</Label>
                    <Input
                      id="edit-url"
                      placeholder="https://api.openai.com"
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-key">API Key</Label>
                    <Input
                      id="edit-key"
                      type="password"
                      placeholder={editing?.apiKeyHint ? `lama: ${editing.apiKeyHint} — kosongkan = tidak diubah` : "kosongkan = tidak diubah"}
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">
                      Kosongkan untuk memakai key lama. Isi untuk mengganti.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-models">Pola model</Label>
                    <Input
                      id="edit-models"
                      placeholder="cth: gpt-4o, claude-* (kosong = semua)"
                      value={editModels}
                      onChange={(e) => setEditModels(e.target.value)}
                    />
                    <p className="text-muted-foreground text-xs">
                      Pisah koma. Persis: gpt-4o, awalan: gpt-*
                    </p>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={loading}>
                Batal
              </Button>
              <Button onClick={() => void handleSaveEdit()} disabled={loading}>
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}

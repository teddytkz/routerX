"use client";

import * as React from "react";
import { Pencil, Plus, Trash2, KeyRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type KeyInfo = {
  id: string;
  name: string;
  prefix: string;
  allowedModels: string[];
  maxTokensPerRequest: number;
  budgetTokens: number;
  usedTokens: number;
  rpmLimit: number;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

type CreatedKey = { id: string; name: string; key: string; prefix: string };

type ProviderModels = {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  online: boolean;
};

const fmt = (n: number) => n.toLocaleString("id-ID");

export default function KeysPage() {
  const [keys, setKeys] = React.useState<KeyInfo[]>([]);
  const [models, setModels] = React.useState<string[]>([]);
  const [modelGroups, setModelGroups] = React.useState<ProviderModels[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [baseUrl, setBaseUrl] = React.useState("");

  // form buat key
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  const [maxReq, setMaxReq] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [rpm, setRpm] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [formErr, setFormErr] = React.useState("");
  const [created, setCreated] = React.useState<CreatedKey | null>(null);

  // konfirmasi hapus dua tahap
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  // konfirmasi rotate dua tahap + hasil rotate (key full, hanya tampil sekali)
  const [rotateId, setRotateId] = React.useState<string | null>(null);
  const [rotated, setRotated] = React.useState<CreatedKey | null>(null);
  const [rotating, setRotating] = React.useState(false);

  // form edit key
  const [editing, setEditing] = React.useState<KeyInfo | null>(null);
  const [eName, setEName] = React.useState("");
  const [ePicked, setEPicked] = React.useState<string[]>([]);
  const [eMaxReq, setEMaxReq] = React.useState("");
  const [eBudget, setEBudget] = React.useState("");
  const [eRpm, setERpm] = React.useState("");
  const [eActive, setEActive] = React.useState(true);
  const [eResetUsage, setEResetUsage] = React.useState(false);
  const [eSaving, setESaving] = React.useState(false);
  const [eErr, setEErr] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [rk, rm] = await Promise.all([fetch("/api/keys"), fetch("/api/models")]);
      if (rk.ok) {
        const d = (await rk.json()) as { keys: KeyInfo[] };
        setKeys(d.keys ?? []);
      }
      if (rm.ok) {
        const d = (await rm.json()) as { models: string[]; providers?: ProviderModels[] };
        setModels(d.models ?? []);
        setModelGroups(d.providers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setBaseUrl(window.location.origin);
    load();
  }, [load]);

  function togglePick(m: string) {
    setPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  }

  function resetForm() {
    setName("");
    setPicked([]);
    setMaxReq("");
    setBudget("");
    setRpm("");
    setFormErr("");
    setCreated(null);
    setSaving(false);
  }

  async function createKey() {
    setFormErr("");
    if (!name.trim()) {
      setFormErr("Nama key wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          allowedModels: picked,
          maxTokensPerRequest: Number(maxReq) || 0,
          budgetTokens: Number(budget) || 0,
          rpmLimit: Number(rpm) || 0,
        }),
      });
      const d = (await r.json()) as {
        key?: string;
        info?: { id: string; name: string; prefix: string };
        id?: string;
        name?: string;
        prefix?: string;
        error?: string;
      };
      if (!r.ok) {
        setFormErr(d.error ?? "Gagal membuat key");
        return;
      }
      const rawKey = d.key ?? "";
      const info = d.info ?? { id: d.id ?? "", name: d.name ?? name.trim(), prefix: d.prefix ?? "" };
      if (!rawKey || !info.id) {
        setFormErr("Respons server tidak lengkap");
        return;
      }
      setCreated({ id: info.id, name: info.name, key: rawKey, prefix: info.prefix });
      await load();
    } catch {
      setFormErr("Gagal membuat key");
    } finally {
      setSaving(false);
    }
  }

  async function deleteKey(id: string) {
    setLoading(true);
    try {
      await fetch(`/api/keys/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setLoading(false);
      setConfirmId(null);
    }
  }

  async function rotateKey(id: string) {
    setRotating(true);
    try {
      const r = await fetch(`/api/keys/${id}/rotate`, { method: "POST" });
      const d = (await r.json()) as {
        key?: string;
        info?: { id: string; name: string; prefix: string };
        error?: string;
      };
      if (!r.ok || !d.key || !d.info) {
        alert(d.error ?? "Gagal rotate key");
        return;
      }
      setRotated({ id: d.info.id, name: d.info.name, key: d.key, prefix: d.info.prefix });
      await load();
    } finally {
      setRotating(false);
      setRotateId(null);
    }
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  function openEdit(k: KeyInfo) {
    setEditing(k);
    setEName(k.name);
    setEPicked([...k.allowedModels]);
    setEMaxReq(k.maxTokensPerRequest > 0 ? String(k.maxTokensPerRequest) : "");
    setEBudget(k.budgetTokens > 0 ? String(k.budgetTokens) : "");
    setERpm(k.rpmLimit > 0 ? String(k.rpmLimit) : "");
    setEActive(k.active);
    setEResetUsage(false);
    setEErr("");
    setESaving(false);
  }

  function closeEdit() {
    setEditing(null);
    setEErr("");
    setESaving(false);
  }

  function toggleEPick(m: string) {
    setEPicked((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  }

  async function saveEdit() {
    if (!editing) return;
    setEErr("");
    if (!eName.trim()) {
      setEErr("Nama key wajib diisi");
      return;
    }
    setESaving(true);
    try {
      const r = await fetch(`/api/keys/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: eName.trim(),
          allowedModels: ePicked,
          maxTokensPerRequest: Number(eMaxReq) || 0,
          budgetTokens: Number(eBudget) || 0,
          rpmLimit: Number(eRpm) || 0,
          active: eActive,
          resetUsage: eResetUsage,
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) {
        setEErr(d.error ?? "Gagal menyimpan");
        return;
      }
      closeEdit();
      await load();
    } catch {
      setEErr("Gagal menyimpan");
    } finally {
      setESaving(false);
    }
  }

  return (
    <DashboardShell title="Key">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Share key</CardTitle>
                <CardDescription>Kelola key proxy dengan batas model, token, RPM</CardDescription>
              </div>
              <Button onClick={() => setOpen(true)} disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                Buat key
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {keys.length === 0 ? (
              <p className="text-muted-foreground text-sm">Belum ada key. Buat key pertama untuk mulai.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Token/req</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>RPM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => {
                    const pct =
                      k.budgetTokens > 0 ? Math.round((k.usedTokens / k.budgetTokens) * 100) : 0;
                    return (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="text-xs">{k.prefix}</code>
                            <CopyButton text={k.prefix} label="" />
                          </div>
                        </TableCell>
                        <TableCell>
                          {k.allowedModels.length === 0 ? (
                            <Badge variant="outline">Semua</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {k.allowedModels.length} model
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {k.maxTokensPerRequest > 0 ? fmt(k.maxTokensPerRequest) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">
                              {fmt(k.usedTokens)}/{k.budgetTokens > 0 ? fmt(k.budgetTokens) : "∞"}
                            </span>
                            {k.budgetTokens > 0 && (
                              <Badge variant={pct >= 90 ? "destructive" : "outline"}>
                                {pct}%
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {k.rpmLimit > 0 ? `${k.rpmLimit}/min` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={k.active ? "default" : "secondary"}>
                            {k.active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {rotateId === k.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => void rotateKey(k.id)}
                                disabled={rotating}
                              >
                                {rotating ? "…" : "Rotate? Key lama mati"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRotateId(null)}
                                disabled={rotating}
                              >
                                Batal
                              </Button>
                            </div>
                          ) : confirmId === k.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => void deleteKey(k.id)}
                                disabled={loading}
                              >
                                Yakin?
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmId(null)}
                                disabled={loading}
                              >
                                Batal
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(k)}
                                disabled={loading}
                                title="Edit key"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRotateId(k.id)}
                                disabled={loading}
                                title="Rotate: terbitkan ulang key full (key lama mati)"
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmId(k.id)}
                                disabled={loading}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
          <DialogContent className="max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{created ? "Key berhasil dibuat" : "Buat share key baru"}</DialogTitle>
              <DialogDescription>
                {created
                  ? "Simpan key ini — tidak akan ditampilkan lagi"
                  : "Batas model, token per request, budget total, dan RPM"}
              </DialogDescription>
            </DialogHeader>
            {created ? (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Base URL</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={baseUrl} className="font-mono text-xs" />
                    <CopyButton text={baseUrl} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={created.key} className="font-mono text-xs" />
                    <CopyButton text={created.key} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Contoh curl</Label>
                  <div className="relative">
                    <pre className="bg-muted overflow-auto rounded p-3 text-xs">
                      {`curl ${baseUrl}/v1/chat/completions \\
  -H "authorization: Bearer ${created.key}" \\
  -H "content-type: application/json" \\
  -d '{"model":"ds/deepseek-chat","max_tokens":100,"messages":[{"role":"user","content":"halo"}]}'`}
                    </pre>
                    <div className="absolute right-2 top-2">
                      <CopyButton
                        text={`curl ${baseUrl}/v1/chat/completions -H "authorization: Bearer ${created.key}" -H "content-type: application/json" -d '{"model":"ds/deepseek-chat","max_tokens":100,"messages":[{"role":"user","content":"halo"}]}'`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nama key</Label>
                  <Input
                    id="name"
                    placeholder="Key production"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Model yang diizinkan</Label>
                  <div className="border-input max-h-48 overflow-auto rounded-md border p-3">
                    <div className="flex items-center gap-2 pb-2">
                      <input
                        type="checkbox"
                        checked={picked.length === 0}
                        onChange={() => setPicked([])}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">Semua model</span>
                    </div>
                    {modelGroups.map((g) => (
                      <div key={g.id} className="mb-3">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant="outline">{g.name}</Badge>
                          {!g.online && (
                            <Badge variant="destructive" className="text-xs">
                              Offline
                            </Badge>
                          )}
                        </div>
                        <div className="grid gap-1 pl-4">
                          {g.models.map((m) => (
                            <label key={m} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={picked.includes(m)}
                                onChange={() => togglePick(m)}
                                className="h-3 w-3"
                              />
                              <code className="text-xs">{m}</code>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Kosongkan untuk izinkan semua model
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxReq">Token maksimal per request</Label>
                  <Input
                    id="maxReq"
                    type="number"
                    placeholder="Bebas"
                    value={maxReq}
                    onChange={(e) => setMaxReq(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">Kosong = bebas, otomatis dibatasi sisa budget</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="budget">Budget token total</Label>
                  <Input
                    id="budget"
                    type="number"
                    placeholder="1000000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">0 = tanpa batas</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rpm">Rate limit (RPM)</Label>
                  <Input
                    id="rpm"
                    type="number"
                    placeholder="60"
                    value={rpm}
                    onChange={(e) => setRpm(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Request per menit. 0 = tanpa batas
                  </p>
                </div>
                {formErr && <p className="text-destructive text-sm">{formErr}</p>}
              </div>
            )}
            <DialogFooter>
              {created ? (
                <Button onClick={handleClose}>Tutup</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleClose} disabled={saving}>
                    Batal
                  </Button>
                  <Button onClick={() => void createKey()} disabled={saving}>
                    {saving ? "Membuat..." : "Buat"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editing !== null} onOpenChange={(o) => (!o ? closeEdit() : null)}>
          <DialogContent className="max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Edit key {editing?.name}</DialogTitle>
              <DialogDescription>Ubah batas model, token, RPM, status</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Prefix</Label>
                <div className="flex gap-2">
                  <Input readOnly value={editing?.prefix ?? ""} className="font-mono text-xs" />
                  {editing && <CopyButton text={editing.prefix} />}
                </div>
                <p className="text-muted-foreground text-xs">
                  Key asli hanya tampil sekali saat dibuat. Untuk dapat key full baru, pakai tombol
                  rotate (ikon kunci) di tabel — key lama langsung mati.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="eName">Nama key</Label>
                <Input id="eName" value={eName} onChange={(e) => setEName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Model yang diizinkan</Label>
                <div className="border-input max-h-48 overflow-auto rounded-md border p-3">
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      checked={ePicked.length === 0}
                      onChange={() => setEPicked([])}
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium">Semua model</span>
                  </div>
                  {modelGroups.map((g) => (
                    <div key={g.id} className="mb-3">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline">{g.name}</Badge>
                        {!g.online && (
                          <Badge variant="destructive" className="text-xs">
                            Offline
                          </Badge>
                        )}
                      </div>
                      <div className="grid gap-1 pl-4">
                        {g.models.map((m) => (
                          <label key={m} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={ePicked.includes(m)}
                              onChange={() => toggleEPick(m)}
                              className="h-3 w-3"
                            />
                            <code className="text-xs">{m}</code>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="eMaxReq">Token/req</Label>
                  <Input
                    id="eMaxReq"
                    type="number"
                    placeholder="0"
                    value={eMaxReq}
                    onChange={(e) => setEMaxReq(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="eBudget">Budget</Label>
                  <Input
                    id="eBudget"
                    type="number"
                    placeholder="0"
                    value={eBudget}
                    onChange={(e) => setEBudget(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="eRpm">RPM</Label>
                  <Input
                    id="eRpm"
                    type="number"
                    placeholder="0"
                    value={eRpm}
                    onChange={(e) => setERpm(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-muted-foreground text-xs">0 = tanpa batas</p>
              <div className="flex items-center gap-2">
                <input
                  id="eActive"
                  type="checkbox"
                  checked={eActive}
                  onChange={(e) => setEActive(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="eActive">Aktif</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="eReset"
                  type="checkbox"
                  checked={eResetUsage}
                  onChange={(e) => setEResetUsage(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="eReset">Reset pemakaian ({editing ? fmt(editing.usedTokens) : "0"} token)</Label>
              </div>
              {eErr && <p className="text-destructive text-sm">{eErr}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeEdit} disabled={eSaving}>
                Batal
              </Button>
              <Button onClick={() => void saveEdit()} disabled={eSaving}>
                {eSaving ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={rotated !== null} onOpenChange={(o) => (!o ? setRotated(null) : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Key baru untuk {rotated?.name}</DialogTitle>
              <DialogDescription>
                Key lama sudah mati. Simpan key full ini — tidak akan ditampilkan lagi.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>API Key (full)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={rotated?.key ?? ""} className="font-mono text-xs" />
                  {rotated && <CopyButton text={rotated.key} />}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setRotated(null)}>Tutup</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}

"use client";

import * as React from "react";
import { LogOut, User } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const [baseUrl, setBaseUrl] = React.useState("");
  const [username, setUsername] = React.useState("");

  React.useEffect(() => {
    setBaseUrl(window.location.origin);
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setUsername(d.user);
      })
      .catch(() => {});
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <DashboardShell title="Pengaturan">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Koneksi</CardTitle>
            <CardDescription>URL proxy untuk klien</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label>Base URL proxy (untuk klien)</Label>
              <div className="flex gap-2">
                <Input readOnly value={baseUrl || "…"} className="font-mono text-xs" />
                {baseUrl && <CopyButton text={baseUrl} label="Salin" />}
              </div>
              <p className="text-muted-foreground text-xs">
                Pakai URL ini di aplikasi klien. Semua backend (termasuk 9router) dikelola di halaman Provider.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-4" /> Akun
            </CardTitle>
            <CardDescription>Admin login</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{username || "—"}</p>
                <p className="text-muted-foreground text-xs">User admin</p>
              </div>
              <Button variant="outline" onClick={() => void logout()}>
                <LogOut className="mr-2 h-4 w-4" />
                Keluar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

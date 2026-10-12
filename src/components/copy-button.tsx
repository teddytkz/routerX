"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [ok, setOk] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  }

  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {ok ? <Check /> : <Copy />}
      {ok ? "Disalin" : label}
    </Button>
  );
}

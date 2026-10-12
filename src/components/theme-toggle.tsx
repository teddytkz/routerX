"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ThemeMenuItem() {
  const [theme, setTheme] = React.useState<"light" | "dark">("dark");

  React.useEffect(() => {
    try {
      const s = localStorage.getItem("routerx-theme");
      if (s === "light" || s === "dark") {
        setTheme(s);
        document.documentElement.classList.toggle("dark", s === "dark");
      }
    } catch {
      /* abaikan */
    }
  }, []);

  const next = theme === "dark" ? "light" : "dark";
  return (
    <DropdownMenuItem
      onClick={() => {
        setTheme(next);
        document.documentElement.classList.toggle("dark", next === "dark");
        try {
          localStorage.setItem("routerx-theme", next);
        } catch {
          /* abaikan */
        }
      }}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
      {theme === "dark" ? "Mode terang" : "Mode gelap"}
    </DropdownMenuItem>
  );
}

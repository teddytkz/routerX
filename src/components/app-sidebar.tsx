"use client";

import * as React from "react";
import { KeyRound, LayoutDashboard, ChartColumn, Settings, Plug, Route } from "lucide-react";
import { usePathname } from "next/navigation";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [user, setUser] = React.useState("admin");

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => {});
  }, []);

  const navMain = [
    { title: "Ringkasan", url: "/", icon: <LayoutDashboard />, isActive: pathname === "/" },
    { title: "Penggunaan", url: "/usage", icon: <ChartColumn />, isActive: pathname === "/usage" },
    { title: "Key", url: "/keys", icon: <KeyRound />, isActive: pathname === "/keys" },
    { title: "Provider", url: "/providers", icon: <Plug />, isActive: pathname === "/providers" },
    { title: "Routing", url: "/routes", icon: <Route />, isActive: pathname === "/routes" },
    { title: "Pengaturan", url: "/settings", icon: <Settings />, isActive: pathname === "/settings" },
  ];

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={
                <a href="/">
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <KeyRound className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">RouterX</span>
                    <span className="truncate text-xs">Proxy 9router</span>
                  </div>
                </a>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser name={user} />
      </SidebarFooter>
    </Sidebar>
  );
}

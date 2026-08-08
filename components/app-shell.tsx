"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SentinelMark } from "./ui";

const navigation = [
  { href: "/dashboard", label: "Dashboard", glyph: "▦" },
  { href: "/products", label: "Products", glyph: "◇" },
  { href: "/test-cases", label: "Test Cases", glyph: "✓" }
];
const sidebarPreferenceKey = "sentinel-sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== "undefined" && window.sessionStorage.getItem(sidebarPreferenceKey) === "true");

  function toggleNavigation() {
    if (window.matchMedia("(max-width: 64rem)").matches) setMenuOpen((open) => !open);
    else setSidebarCollapsed((collapsed) => {
      const nextCollapsed = !collapsed;
      window.sessionStorage.setItem(sidebarPreferenceKey, String(nextCollapsed));
      return nextCollapsed;
    });
  }

  return <div className={`app-shell ${sidebarCollapsed ? "app-shell--sidebar-collapsed" : ""}`}>
    <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`} aria-label="Primary navigation">
      <Link href="/dashboard" className="sidebar__brand" aria-label="Sentinel dashboard" onClick={() => setMenuOpen(false)}><SentinelMark /></Link>
      <nav className="sidebar__nav">
        <p className="sidebar__label">Workspace</p>
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href === "/test-cases" && pathname.startsWith("/test-cases/"));
          return <Link key={item.href} href={item.href} className={`sidebar__link ${active ? "sidebar__link--active" : ""}`} aria-label={item.label} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}><span aria-hidden="true">{item.glyph}</span><span className="sidebar__link-label">{item.label}</span></Link>;
        })}
      </nav>
      <div className="sidebar__footer"><span className="sidebar__status" aria-hidden="true" /><div><strong>Development workspace</strong><small>Local Phase 1</small></div></div>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="app-shell__main">
      <header className="topbar"><button className="topbar__menu" aria-label="Toggle navigation" aria-expanded={menuOpen || !sidebarCollapsed} onClick={toggleNavigation}>☰</button><div className="topbar__spacer" aria-hidden="true" /><Link className="topbar__action" href="/recordings/new">New recording <span aria-hidden="true">+</span></Link></header>
      <main className="app-main">{children}</main>
    </div>
  </div>;
}

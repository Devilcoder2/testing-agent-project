"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SentinelMark } from "./ui";

const navigation = [
  { href: "/dashboard", label: "Dashboard", glyph: "▦" },
  { href: "/test-cases", label: "Test Cases", glyph: "✓" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`} aria-label="Primary navigation">
      <Link href="/dashboard" className="sidebar__brand" onClick={() => setMenuOpen(false)}><SentinelMark /></Link>
      <nav className="sidebar__nav">
        <p className="sidebar__label">Workspace</p>
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href === "/test-cases" && pathname.startsWith("/test-cases/"));
          return <Link key={item.href} href={item.href} className={`sidebar__link ${active ? "sidebar__link--active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}><span aria-hidden="true">{item.glyph}</span>{item.label}</Link>;
        })}
      </nav>
      <div className="sidebar__footer"><span className="sidebar__status" aria-hidden="true" /><div><strong>Development workspace</strong><small>Local Phase 1</small></div></div>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="app-shell__main">
      <header className="topbar"><button className="topbar__menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>☰</button><div className="topbar__crumb">Quality operations <span>/</span> Guided testing</div><Link className="topbar__action" href="/recordings/new">New recording <span aria-hidden="true">+</span></Link></header>
      <main className="app-main">{children}</main>
    </div>
  </div>;
}

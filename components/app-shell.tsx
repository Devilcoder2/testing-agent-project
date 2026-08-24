"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, IconButton, SentinelMark, type IconName } from "./ui";
import { NewRecordingDialog } from "./sentinel-views";

const navigation: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/products", label: "Products", icon: "products" },
  { href: "/test-cases", label: "Test Cases", icon: "testCases" },
  { href: "/test-data", label: "Test Data", icon: "data" },
  { href: "/runs", label: "Runs", icon: "runs" },
  { href: "/releases", label: "Releases", icon: "releases" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
  { href: "/review", label: "Review", icon: "review" },
  { href: "/admin", label: "Administration", icon: "admin" }
];
const sidebarPreferenceKey = "sentinel-sidebar-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isNewRecordingOpen, setIsNewRecordingOpen] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(window.sessionStorage.getItem(sidebarPreferenceKey) === "true");
  }, []);

  function toggleNavigation() {
    if (window.matchMedia("(max-width: 64rem)").matches) setMenuOpen((open) => !open);
    else setSidebarCollapsed((collapsed) => {
      const nextCollapsed = !collapsed;
      window.sessionStorage.setItem(sidebarPreferenceKey, String(nextCollapsed));
      return nextCollapsed;
    });
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return <div className={`app-shell ${sidebarCollapsed ? "app-shell--sidebar-collapsed" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`} aria-label="Primary navigation">
      <Link href="/dashboard" className="sidebar__brand" aria-label="Sentinel dashboard" onClick={() => setMenuOpen(false)}><SentinelMark /></Link>
      <nav className="sidebar__nav">
        <p className="sidebar__label">Workspace</p>
        {navigation.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <Link key={item.href} href={item.href} className={`sidebar__link ${active ? "sidebar__link--active" : ""}`} aria-label={item.label} title={sidebarCollapsed ? item.label : undefined} aria-current={active ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon name={item.icon} /><span className="sidebar__link-label">{item.label}</span></Link>;
        })}
      </nav>
      <div className="sidebar__footer"><span className="sidebar__status" aria-hidden="true" /><div><strong>Organization workspace</strong><small>Controlled local pilot</small></div><IconButton label="Sign out" onClick={signOut}><Icon name="signOut" /></IconButton></div>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="app-shell__main">
      <header className="topbar"><button className="topbar__menu" aria-label="Toggle navigation" aria-expanded={menuOpen || !sidebarCollapsed} onClick={toggleNavigation}><Icon name="menu" /></button><div className="topbar__spacer" aria-hidden="true" /><button className="topbar__action" type="button" onClick={() => setIsNewRecordingOpen(true)}>New recording <Icon name="plus" /></button></header>
      <main className="app-main" id="main-content" tabIndex={-1}>{children}</main>
      {isNewRecordingOpen && <NewRecordingDialog onClose={() => setIsNewRecordingOpen(false)} />}
    </div>
  </div>;
}

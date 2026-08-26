"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { ThemeControl } from "./theme-control";
import { GlobalSearch } from "./global-search";
import { Icon, IconButton, SentinelMark, type IconName } from "./ui";

const NewRecordingDialog = dynamic(() => import("./sentinel-views").then((module) => module.NewRecordingDialog), { ssr: false });

type NavigationItem = { href: string; label: string; icon: IconName };
type NavigationGroup = { label: string; items: NavigationItem[] };

const navigationGroups: NavigationGroup[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: "dashboard" }] },
  { label: "Build", items: [
    { href: "/products", label: "Products", icon: "products" },
    { href: "/test-cases", label: "Test Cases", icon: "testCases" },
    { href: "/test-data", label: "Test Data", icon: "data" }
  ] },
  { label: "Operate", items: [
    { href: "/runs", label: "Runs", icon: "runs" },
    { href: "/releases", label: "Releases", icon: "releases" }
  ] },
  { label: "Decide", items: [
    { href: "/review", label: "Review", icon: "review" },
    { href: "/notifications", label: "Notifications", icon: "bell" }
  ] },
  { label: "Manage", items: [{ href: "/admin", label: "Administration", icon: "admin" }] }
];
const navigationItems = navigationGroups.flatMap((group) => group.items);
const shellContext = createContext(false);

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function activeDestination(pathname: string) {
  return navigationItems.find((item) => isActive(pathname, item.href));
}

export function AppShell({ children }: { children: ReactNode }) {
  return useContext(shellContext) ? children : <AppShellFrame>{children}</AppShellFrame>;
}

function usesWorkspaceShell(pathname: string) {
  if (pathname === "/runs") return true;
  return ["/dashboard", "/products", "/test-cases", "/test-data", "/releases", "/review", "/notifications", "/admin"]
    .some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return usesWorkspaceShell(pathname) ? <AppShellFrame>{children}</AppShellFrame> : children;
}

function AppShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [isNewRecordingOpen, setIsNewRecordingOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const visiblePathname = pendingHref ?? pathname;
  const current = activeDestination(visiblePathname);

  useEffect(() => {
    setNavigationOpen(false);
    if (pendingHref && isActive(pathname, pendingHref)) setPendingHref(null);
  }, [pathname, pendingHref]);

  useEffect(() => {
    if (pendingHref && !isActive(pathname, pendingHref)) router.push(pendingHref);
  }, [pathname, pendingHref, router]);

  useEffect(() => {
    const prefetchRoutes = () => navigationItems.forEach((item) => router.prefetch(item.href));
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetchRoutes, { timeout: 2_000 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = setTimeout(prefetchRoutes, 250);
    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (!navigationOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setNavigationOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [navigationOpen]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  function beginNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || href === pathname) return;
    event.preventDefault();
    setPendingHref(href);
  }

  const navigation = <nav className="section-nav__groups" aria-label="Workspace sections">
    {navigationGroups.map((group) => <div className="section-nav__group" key={group.label}>
      <span className="section-nav__group-label">{group.label}</span>
      <div className="section-nav__links">
        {group.items.map((item) => {
          const active = isActive(visiblePathname, item.href);
          return <Link className={`section-nav__link ${active ? "section-nav__link--active" : ""}`} href={item.href} key={item.href} aria-current={active ? "page" : undefined} onClick={(event) => beginNavigation(event, item.href)}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>;
        })}
      </div>
    </div>)}
  </nav>;

  return <shellContext.Provider value><div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="command-masthead">
      <div className="command-masthead__inner">
        <div className="command-masthead__identity">
          <IconButton className="mobile-menu-trigger" label="Open workspace navigation" aria-expanded={navigationOpen} aria-controls="mobile-workspace-navigation" onClick={() => setNavigationOpen(true)}><Icon name="menu" /></IconButton>
          <Link href="/dashboard" aria-label="Sentinel dashboard"><SentinelMark /></Link>
          <span className="command-masthead__divider" aria-hidden="true" />
          <span className="command-masthead__context"><small>QA workspace</small><strong>{current?.label ?? "Sentinel"}</strong></span>
        </div>
        <GlobalSearch />
        <div className="command-masthead__actions">
          <ThemeControl />
          <Link className="icon-button command-notifications" href="/notifications" aria-label="Open notifications" title="Notifications"><Icon name="bell" /></Link>
          <button className="button button--primary command-record" type="button" onClick={() => setIsNewRecordingOpen(true)}><Icon name="plus" /> New recording</button>
          <IconButton className="command-sign-out" label="Sign out" onClick={signOut}><Icon name="signOut" /></IconButton>
        </div>
      </div>
    </header>
    <div className="section-nav">{navigation}</div>
    {navigationOpen && <>
      <button className="navigation-sheet__backdrop" aria-label="Close workspace navigation" onClick={() => setNavigationOpen(false)} />
      <aside className="navigation-sheet" id="mobile-workspace-navigation" aria-label="Workspace navigation">
        <div className="navigation-sheet__header"><SentinelMark /><IconButton label="Close workspace navigation" onClick={() => setNavigationOpen(false)}><Icon name="close" /></IconButton></div>
        {navigation}
        <div className="navigation-sheet__footer"><ThemeControl /><button className="button button--ghost" onClick={signOut}><Icon name="signOut" /> Sign out</button></div>
      </aside>
    </>}
    <main className="app-main" id="main-content" tabIndex={-1} aria-busy={Boolean(pendingHref)}>
      <span className="sr-only" role="status" aria-live="polite">{pendingHref ? `Loading ${activeDestination(pendingHref)?.label ?? "section"}` : ""}</span>
      {children}
    </main>
    {isNewRecordingOpen && <NewRecordingDialog onClose={() => setIsNewRecordingOpen(false)} />}
  </div></shellContext.Provider>;
}

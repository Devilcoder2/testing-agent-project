"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { SearchResponse, SearchResult, SearchSection } from "@/lib/global-search";
import { Icon } from "./ui";

const sectionIcons: Record<SearchSection, Parameters<typeof Icon>[0]["name"]> = {
  products: "products",
  "test-cases": "testCases",
  "test-data": "data",
  runs: "runs",
  releases: "releases",
  review: "review",
  notifications: "bell",
  admin: "admin"
};

function sectionForPath(pathname: string): SearchSection | null {
  if (pathname.startsWith("/products")) return "products";
  if (pathname.startsWith("/test-cases")) return "test-cases";
  if (pathname.startsWith("/test-data")) return "test-data";
  if (pathname.startsWith("/runs")) return "runs";
  if (pathname.startsWith("/releases")) return "releases";
  if (pathname.startsWith("/review")) return "review";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}

export function GlobalSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestNumber = useRef(0);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<SearchResponse>({ query: "", groups: [], total: 0 });
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const currentSection = sectionForPath(pathname);

  const indexedGroups = useMemo(() => {
    let index = 0;
    return response.groups.map((group) => ({ ...group, results: group.results.map((result) => ({ result, index: index++ })) }));
  }, [response.groups]);
  const results = useMemo(() => indexedGroups.flatMap((group) => group.results.map((item) => item.result)), [indexedGroups]);
  const activeId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      requestNumber.current += 1;
      setResponse({ query: "", groups: [], total: 0 });
      setState("idle");
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    setState("loading");
    setOpen(true);
    const controller = new AbortController();
    const currentRequest = ++requestNumber.current;
    const timer = window.setTimeout(async () => {
      try {
        const parameters = new URLSearchParams({ q: normalized });
        if (currentSection) parameters.set("section", currentSection);
        const result = await fetch(`/api/search?${parameters}`, { signal: controller.signal });
        const payload = await result.json();
        if (!result.ok) throw new Error(payload?.error ?? "Search is temporarily unavailable.");
        if (currentRequest !== requestNumber.current) return;
        setResponse(payload as SearchResponse);
        setState("ready");
        setActiveIndex(-1);
      } catch {
        if (controller.signal.aborted || currentRequest !== requestNumber.current) return;
        setResponse({ query: normalized, groups: [], total: 0 });
        setState("error");
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentSection, query]);

  useEffect(() => {
    function focusSearch(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        if (query.trim()) setOpen(true);
      }
    }
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, [query]);

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function selectResult(result: SearchResult) {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    router.push(result.href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (open) event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => current >= results.length - 1 ? 0 : current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => current <= 0 ? results.length - 1 : current - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectResult(results[activeIndex]);
    }
  }

  const showPanel = open && query.trim().length > 0;
  const announcement = state === "loading" ? "Searching workspace" : state === "error" ? "Search is temporarily unavailable" : state === "ready" ? `${response.total} result${response.total === 1 ? "" : "s"} available` : "";

  return <div className="global-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label className="sr-only" htmlFor={`${listboxId}-input`}>Search workspace</label>
    <div className="global-search__control">
      <Icon name="search" />
      <input
        ref={inputRef}
        id={`${listboxId}-input`}
        type="search"
        value={query}
        placeholder="Search workspace"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        onChange={(event) => setQuery(event.target.value.slice(0, 80))}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      <kbd aria-hidden="true"><span>⌘</span>K</kbd>
    </div>
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    {showPanel && <div className="global-search__panel" id={listboxId} role="listbox" aria-label="Workspace search results" aria-busy={state === "loading"}>
      {state === "loading" && <div className="global-search__state"><span className="global-search__spinner" aria-hidden="true" />Searching workspace…</div>}
      {state === "error" && <div className="global-search__state global-search__state--error">Search is temporarily unavailable. Try again.</div>}
      {state === "ready" && response.total === 0 && <div className="global-search__state">No matches beginning with “{response.query}”.</div>}
      {state === "ready" && indexedGroups.map((group) => <section className="global-search__group" role="group" aria-labelledby={`${listboxId}-${group.section}`} key={group.section}>
        <h2 id={`${listboxId}-${group.section}`}>{group.label}{group.section === currentSection && <span>Current section</span>}</h2>
        {group.results.map(({ result, index }) => <Link
          id={`${listboxId}-option-${index}`}
          role="option"
          aria-selected={activeIndex === index}
          className="global-search__result"
          href={result.href}
          key={`${result.section}-${result.id}`}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={(event) => { event.preventDefault(); selectResult(result); }}
        >
          <span className="global-search__result-icon"><Icon name={sectionIcons[result.section]} /></span>
          <span><strong>{result.title}</strong><small>{result.context}</small></span>
          <span className="global-search__arrow" aria-hidden="true">→</span>
        </Link>)}
      </section>)}
      {state === "ready" && response.total > 0 && <p className="global-search__footer">Prefix matches only · {response.total} result{response.total === 1 ? "" : "s"}</p>}
    </div>}
  </div>;
}

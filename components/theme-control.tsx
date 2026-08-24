"use client";

import { useEffect, useState } from "react";

export type SentinelTheme = "light" | "dark";

export const themeStorageKey = "sentinel-theme";

function currentTheme(): SentinelTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeControl({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<SentinelTheme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function toggleTheme() {
    const nextTheme: SentinelTheme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(themeStorageKey, nextTheme);
    setTheme(nextTheme);
  }

  return <button
    className={`theme-control ${className}`.trim()}
    type="button"
    onClick={toggleTheme}
    aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}
    aria-pressed={theme === "dark"}
    title={`Use ${theme === "dark" ? "light" : "dark"} theme`}
  >
    <span className="theme-control__track" aria-hidden="true">
      <svg className="theme-control__sun" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </svg>
      <svg className="theme-control__moon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
      </svg>
      <span className="theme-control__thumb" />
    </span>
    <span className="sr-only" aria-live="polite">{theme ? `${theme} theme active` : "Theme ready"}</span>
  </button>;
}

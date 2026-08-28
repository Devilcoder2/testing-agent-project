"use client";

type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  redirectOnUnauthorized?: boolean;
};

let sessionExitStarted = false;

function beginExpiredSessionExit() {
  if (sessionExitStarted) return;
  sessionExitStarted = true;
  void fetch("/api/auth/logout", { method: "POST", keepalive: true }).catch(() => undefined);
  window.location.replace("/");
}

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, redirectOnUnauthorized = true } = options;
  const response = await fetch(`/api/${path}`, {
    method,
    signal,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));

  if (response.status === 401 && redirectOnUnauthorized) {
    beginExpiredSessionExit();
    return new Promise<T>(() => undefined);
  }
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
    throw new Error(typeof error === "string" ? error : "Request failed.");
  }
  return payload as T;
}

export async function signOutAndRedirect() {
  if (sessionExitStarted) return;
  sessionExitStarted = true;
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } finally {
    window.location.replace("/");
  }
}

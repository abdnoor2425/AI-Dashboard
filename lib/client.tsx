"use client";
// Client data layer: one `api()` call for every endpoint, a `useApi()` hook that
// keeps views fresh after any change, and the app-wide context (scope, theme, sheet).
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Local = (req: { method: string; path: string; query?: Record<string, string>; body?: any }) => { status: number; data: any };
const local = (): Local | null => (typeof globalThis !== "undefined" ? (globalThis as any).__KEYSTONE_LOCAL__ || null : null);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const listeners = new Set<() => void>();
export const notifyChanged = () => listeners.forEach((l) => l());

export async function api(path: string, opts: { method?: string; body?: any; query?: Record<string, any> } = {}): Promise<any> {
  const method = opts.method || (opts.body ? "POST" : "GET");
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(opts.query || {})) if (v != null && v !== "") query[k] = String(v);
  let status: number, data: any;
  const run = local();
  if (run) {
    await wait(method === "GET" ? 220 + Math.random() * 260 : 90);
    ({ status, data } = run({ method, path: "/api/" + path, query, body: opts.body }));
  } else {
    const qs = new URLSearchParams(query).toString();
    const res = await fetch(`/api/${path}${qs ? "?" + qs : ""}`, { method, headers: opts.body ? { "content-type": "application/json" } : undefined, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" });
    status = res.status; data = await res.json().catch(() => ({ error: "The app did not answer." }));
  }
  if (status >= 400) throw new Error(data?.error || "Something went wrong.");
  if (method !== "GET") notifyChanged();
  return data;
}

/** Load an endpoint. Shows `loading` only the first time; later refreshes swap data in quietly. */
export function useApi<T = any>(path: string | null, query: Record<string, any> = {}) {
  const key = path ? path + "?" + JSON.stringify(query) : null;
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean; key: string | null }>({ data: null, error: null, loading: !!path, key });
  const latest = useRef(key);
  latest.current = key;
  const load = useCallback((quiet: boolean) => {
    if (!path || !key) return;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    api(path, { query }).then(
      (data) => latest.current === key && setState({ data, error: null, loading: false, key }),
      (e) => latest.current === key && setState((s) => ({ ...s, error: e.message, loading: false })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { load(false); }, [load]);
  useEffect(() => { const l = () => load(true); listeners.add(l); return () => { listeners.delete(l); }; }, [load]);
  const fresh = state.key === key;
  return { data: fresh ? state.data : null, error: state.error, loading: state.loading || !fresh, reload: () => load(true) };
}

export interface Scope { mode: "sites" | "clients"; id: string }
export const scopeParam = (s: Scope) => (s.id === "all" ? `${s.mode}:all` : `${s.mode === "sites" ? "site" : "client"}:${s.id}`);

export interface AppCtx {
  boot: any; reloadBoot: () => void;
  scope: Scope; setScope: (s: Scope) => void; scopeKey: string; scopeLabel: string;
  theme: string; setTheme: (t: string) => void;
  openItem: (id: string, from?: HTMLElement | null) => void;
  openPalette: () => void;
  toast: (msg: string) => void;
  title: string; setTitle: (t: string) => void; titleShown: boolean; setTitleShown: (b: boolean) => void;
  syncing: string | null;
  sky: string; setSky: (k: any) => void; skyPhase: string; dark: boolean; collapsed: boolean; setCollapsed: (c: boolean) => void;
  openCard: (c: { title: string; chip?: string; render: (close: () => void) => React.ReactNode }, from?: HTMLElement | null) => void;
}
export const App = createContext<AppCtx>(null as any);
export const useApp = () => useContext(App);

export function store(key: string, value?: any) {
  try {
    if (value === undefined) { const v = localStorage.getItem("keystone:" + key); return v == null ? null : JSON.parse(v); }
    localStorage.setItem("keystone:" + key, JSON.stringify(value));
  } catch { /* storage can be unavailable; the app works without it */ }
  return null;
}

// The hosted preview: the same views and the same API router as the real app,
// but the router runs in the browser on sample data and pages route on #names.
import React from "react";
import { createRoot } from "react-dom/client";
import { usePathname } from "next/navigation";
import { AppShell, pageOf } from "@/components/shell";
import { VIEWS } from "@/views";
import { handle } from "@/lib/api";
import { makeState } from "@/lib/sample";
import { Empty } from "@/components/ui";

const KEY = "keystone:preview-state";
let state: any = null;
try { const raw = localStorage.getItem(KEY); const s = raw && JSON.parse(raw); if (s && s.version === 1 && Date.now() - s.createdAt < 18 * 3600000) state = s; } catch {}
if (!state) state = makeState(Date.now());
(globalThis as any).__KEYSTONE_LOCAL__ = (req: any) => {
  const res = handle(state, req);
  if (res.changed) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
  return JSON.parse(JSON.stringify({ status: res.status, data: res.data }));
};

function Router() {
  const page = pageOf(usePathname());
  const View = VIEWS[page];
  return View ? <View /> : <div className="card"><Empty art="search" title="There is no page here"><p>Use the sidebar to pick a page.</p></Empty></div>;
}
createRoot(document.getElementById("root")!).render(<AppShell><Router /></AppShell>);

// Pulls fresh numbers from every connected tool into the open workspace. Read only: nothing is ever written back to a tool.
import { GOOGLE_TOOLS, syncAnalytics, syncCalendar, syncDrive, syncGmail } from "./google.ts";
import { matchBrands, metricoolBrands, syncBrand } from "./metricool.ts";
import { syncLinear } from "./linear.ts";
import { saveState } from "./store.ts";

const running = new Set<string>();
const USER_FIELDS = ["status", "doneAt", "snoozedUntil", "dismissed", "pin", "override"];

export function isSyncing(wsId: string) { return running.has(wsId); }

export async function syncWorkspace(ws: any, now = Date.now(), only?: string) {
  if (ws.sample) return { ok: true, note: "Sample workspaces have nothing to sync." };
  if (running.has(ws.id)) return { ok: true, note: "Already syncing." };
  running.add(ws.id);
  const conn = (id: string) => ws.connections.find((c: any) => c.id === id);
  const step = async (id: string, fn: () => Promise<string>) => {
    const c = conn(id);
    if (!c || (c.status !== "connected" && c.status !== "error") || (only && only !== id)) return;
    try { c.detail = await fn(); c.status = "connected"; c.lastSync = now; }
    catch (e: any) { c.status = "error"; c.detail = String(e?.message || e).slice(0, 180); }
  };
  try {
    await step("google-analytics", async () => { ws.sites = await syncAnalytics(ws.id, ws.sites); return `${ws.sites.length} website${ws.sites.length === 1 ? "" : "s"} found`; });
    if (ws.modules?.calendar === true) await step("calendar", async () => { ws.events = await syncCalendar(ws.id, now); return "Read only, next seven days"; });
    await step("gmail", async () => { ws.inbox = [...ws.inbox.filter((m: any) => m.tool !== "gmail"), ...(await syncGmail(ws.id))]; return "Reads senders and subject lines of unread mail"; });
    await step("drive", async () => { ws.files = await syncDrive(ws.id); return "Read only, recent files"; });
    await step("linear", async () => {
      const r = await syncLinear(ws.id, ws.setup?.about?.name || ws.owner, now);
      const old = new Map<string, any>(ws.items.map((i: any) => [i.id, i]));
      const fresh = r.items.map((n: any) => {
        const o = old.get(n.id);
        if (!o) return n;
        const keep: any = {}; for (const k of USER_FIELDS) if (o[k] !== undefined) keep[k] = o[k];
        const factors = { ...n.factors, ...Object.fromEntries(Object.entries(o.factors || {}).filter(([, v]) => v != null)) };
        return { ...n, ...keep, factors, ...(o.evidence === "verified" ? { evidence: o.evidence, evidenceNote: o.evidenceNote, missing: undefined } : {}) };
      });
      const ids = new Set(fresh.map((i: any) => i.id));
      // Keep hand-added items, and finished Linear items so "Done" stays a true record.
      ws.items = [...ws.items.filter((i: any) => !String(i.id).startsWith("lin-") || (!ids.has(i.id) && i.status !== "open")), ...fresh];
      conn("linear").account = r.account;
      return `${fresh.length} open task${fresh.length === 1 ? "" : "s"} assigned to you`;
    });
    await step("metricool", async () => {
      const brands = await metricoolBrands(ws.id);
      matchBrands(ws.sites, brands);
      let done = 0;
      for (const s of ws.sites) {
        if (!s.metricoolBrand?.confirmed) continue;
        const social = await syncBrand(ws.id, s.metricoolBrand, now);
        s.live = { ...(s.live || {}), social }; s.networks = social.networks.map((n: any) => n.id); done++;
      }
      return `${done} of ${ws.sites.length} brands confirmed`;
    });
    ws.lastSync = now;
    saveState();
    return { ok: true };
  } finally { running.delete(ws.id); }
}

export function markGoogle(ws: any, status: "connected" | "off", account = "") {
  for (const c of ws.connections) if (GOOGLE_TOOLS.includes(c.id)) { c.status = status; c.account = account; c.detail = status === "connected" ? "Signed in. Fetching for the first time." : "Not connected"; if (status === "off") c.lastSync = null; }
}

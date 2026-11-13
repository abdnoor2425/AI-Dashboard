// One router for every feature. The Next.js server calls it for /api/* requests,
// the MCP connector reaches it over HTTP, and the hosted preview runs it in the browser.
// handle() reads and changes a plain state object, so it works the same in all three.
import { DAY, HOUR, hash, pct, rng, series, startOfDay, sum } from "./rand.ts";
import { buildQueue, FACTORS } from "./scoring.ts";
import type { Scored } from "./scoring.ts";
import { ACCENTS, MODULES, NETWORK_BASE, makeState, makeWorkspace } from "./sample.ts";

export type State = ReturnType<typeof makeState>;
export interface Req { method: string; path: string; query?: Record<string, string>; body?: any; now?: number }
export interface Res { status: number; data: any; changed?: boolean }

const ok = (data: any, changed = false): Res => ({ status: 200, data, changed });
const bad = (msg: string, status = 400): Res => ({ status, data: { error: msg } });

export const ENDPOINTS = [
  ["overview", "Greeting, top 5 attention items, team list, reel summary, key numbers and the 28-day chart"],
  ["attention", "The full ranked attention queue with scores, reasons and sources"],
  ["websites", "All websites side by side"],
  ["website", "Visitors, leads, sources and top pages for one website (?site=)"],
  ["social", "Metricool followers, reach, best post and schedule (?site=)"],
  ["reels", "Reel scores: hooks, PASS or HOLD, and results at 24h, 72h and 7 days"],
  ["goals", "Objectives, key results, owners and check-ins"],
  ["metrics", "The metric catalogue with definitions, targets, sources and freshness"],
  ["decisions", "Decision Room sessions"],
  ["clients", "All clients: replies owed, approvals waiting and what is due"],
  ["inbox", "Messages that may need a reply"],
  ["calendar", "Meetings and deadlines for the week"],
  ["files", "Recent files"],
  ["outputs", "Finished documents with task, owner and version"],
  ["skills", "Reusable playbooks and their status"],
  ["suggestions", "Ideas to improve the setup"],
  ["usage", "AI usage and cost"],
  ["connections", "Each tool and its connection status"],
  ["setup", "First-run setup state"],
  ["settings", "Branding, pages, ranking weights"],
  ["workspaces", "Workspaces made from the shared template"],
  ["search", "Search across everything (?q=)"],
] as const;

function inScope(rec: string | null | undefined, scope: string): boolean {
  if (!scope || scope === "sites:all" || scope === "clients:all" || scope === "all") return true;
  return rec === scope;
}
function inMode(rec: string | null | undefined, scope: string): boolean {
  if (scope === "sites:all") return !rec || rec.startsWith("site:");
  if (scope === "clients:all") return !!rec && rec.startsWith("client:");
  return inScope(rec, scope);
}

function sentence(delta: number | null, noun: string, period: string) {
  const be = /s$/.test(noun) ? "are" : "is";
  if (delta == null) return `No earlier ${period} to compare with yet.`;
  const p = Math.round(Math.abs(delta) * 100);
  if (p < 2) return `${noun} ${be} steady compared with last ${period}.`;
  return `${noun} ${be} ${delta > 0 ? "up" : "down"} ${p}% on last ${period}.`;
}

function siteTraffic(site: any, days: number, now: number) {
  if (site.live?.daily) {
    // Real numbers from Google Analytics. A day with no row is a real zero for that property, not a guess.
    const rows: any[] = site.live.daily, end = startOfDay(now) + DAY, by = new Map(rows.map((r) => [startOfDay(r.t + DAY / 2), r]));
    const span = (from: number, n: number) => Array.from({ length: n }, (_, i) => { const t = from + i * DAY, r = by.get(t); return { t, visitors: r?.visitors || 0, leads: r?.leads || 0 }; });
    const cur = span(end - days * DAY, days), prev = span(end - 2 * days * DAY, days);
    const v = (a: any[]) => a.map((p) => ({ t: p.t, v: p.visitors })), l = (a: any[]) => a.map((p) => ({ t: p.t, v: p.leads }));
    return { visitors: v(cur), leads: l(cur), totals: { visitors: sum(v(cur)), leads: sum(l(cur)), visitorsPrev: sum(v(prev)), leadsPrev: sum(l(prev)) } };
  }
  const all = series("v:" + site.id, site.base, site.growth, days * 2, now);
  const cur = all.slice(days), prev = all.slice(0, days);
  const leadsOf = (arr: any[]) => arr.map((p) => ({ t: p.t, v: Math.round(p.v * site.leadRate * (0.8 + rng(hash("l:" + site.id + p.t))() * 0.4)) }));
  const lc = leadsOf(cur), lp = leadsOf(prev);
  return { visitors: cur, leads: lc, totals: { visitors: sum(cur), leads: sum(lc), visitorsPrev: sum(prev), leadsPrev: sum(lp) } };
}

function addSeries(list: { t: number; v: number }[][]) {
  if (!list.length) return [];
  return list[0].map((p, i) => ({ t: p.t, v: list.reduce((s, a) => s + (a[i]?.v || 0), 0) }));
}

const NETWORK_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook", linkedin: "LinkedIn", x: "X" };

function siteSocial(site: any, now: number) {
  if (site.live?.social && site.metricoolBrand?.confirmed) {
    const networks = site.live.social.networks || [];
    const totals = { reach: networks.reduce((a: number, n: any) => a + (n.reach || 0), 0), reachPrev: networks.reduce((a: number, n: any) => a + (n.reachPrev || 0), 0), followers: networks.reduce((a: number, n: any) => a + (n.followers || 0), 0) };
    return { state: networks.length ? "ok" : "unmatched", networks, reach: addSeries(networks.map((n: any) => n.series || [])), totals };
  }
  if (site.live && !site.live.social) return { state: site.metricoolBrand?.matched ? "unconfirmed" : "unmatched", networks: [], reach: [], totals: null };
  if (!site.metricoolBrand?.confirmed) return { state: site.metricoolBrand?.matched ? "unconfirmed" : "unmatched", networks: [], reach: [], totals: null };
  const f = 0.25 + (hash(site.id) % 100) / 80;
  const networks = site.networks.map((n: string) => {
    const r = rng(hash(site.id + n));
    const followers = Math.round(NETWORK_BASE[n] * f * (0.6 + r() * 0.8));
    const s = series("r:" + site.id + n, followers * 0.21, site.growth * 1.4, 14, now, 0.5);
    const cur = sum(s.slice(7)), prev = sum(s.slice(0, 7));
    return { id: n, name: NETWORK_LABEL[n], followers, followersDelta: Math.round(followers * (0.004 + r() * 0.02) * (site.growth < 0 ? -0.4 : 1)), reach: cur, reachPrev: prev, series: s.slice(7) };
  });
  const reach = addSeries(networks.map((n: any) => n.series));
  const totals = { reach: networks.reduce((s: number, n: any) => s + n.reach, 0), reachPrev: networks.reduce((s: number, n: any) => s + n.reachPrev, 0), followers: networks.reduce((s: number, n: any) => s + n.followers, 0) };
  return { state: "ok", networks, reach, totals };
}

function topPages(site: any, total: number) {
  if (site.live) return (site.live.pages || []).slice(0, 5).map((p: any) => ({ path: p.path, visitors: p.visitors, delta: null }));
  const byKind: Record<string, string[]> = {
    "Restaurant ratings": ["/cities/austin", "/", "/best/tacos", "/restaurant/juniper-diner", "/write-a-review"],
    "Habit app": ["/", "/download", "/blog/two-minute-habits", "/pricing", "/streaks"],
    "Local moving service": ["/quote", "/", "/services/packing", "/areas/riverside", "/reviews"],
    "Newsletter and blog": ["/", "/subscribe", "/issues/142", "/archive", "/podcast"],
    "Pottery studio shop": ["/shop/mugs", "/", "/classes", "/checkout", "/shop/gift-cards"],
    "Help desk software": ["/pricing", "/", "/features/shared-inbox", "/demo", "/compare"],
  };
  const paths = byKind[site.kind] || ["/", "/about", "/contact", "/services", "/blog"];
  const w = [0.31, 0.24, 0.13, 0.09, 0.06];
  return paths.map((p, i) => {
    const r = rng(hash(site.id + p))();
    return { path: p, visitors: Math.round(total * w[i]), delta: Math.round((r - 0.35) * 60) / 100 };
  });
}

function sources(site: any, total: number) {
  if (site.live) { const list = site.live.sources || [], t = list.reduce((a: number, x: any) => a + x.visitors, 0) || 1; return list.map((x: any) => ({ name: x.name, visitors: x.visitors, share: x.visitors / t })).sort((a: any, b: any) => b.visitors - a.visitors).slice(0, 6); }
  const r = rng(hash("src" + site.id));
  const raw = [["Search", 0.34 + r() * 0.2], ["Social", 0.14 + r() * 0.22], ["Direct", 0.14 + r() * 0.1], ["Referral", 0.05 + r() * 0.08], ["Email", 0.03 + r() * 0.08]] as [string, number][];
  const s = raw.reduce((a, x) => a + x[1], 0);
  return raw.map(([name, w]) => ({ name, visitors: Math.round((total * w) / s), share: w / s })).sort((a, b) => b.visitors - a.visitors);
}

function mergeSources(list: any[]) {
  const m = new Map<string, number>();
  list.forEach((s) => (s.live?.sources || []).forEach((x: any) => m.set(x.name, (m.get(x.name) || 0) + x.visitors)));
  const t = [...m.values()].reduce((a, b) => a + b, 0) || 1;
  return [...m].map(([name, visitors]) => ({ name, visitors, share: visitors / t })).sort((a, b) => b.visitors - a.visitors).slice(0, 6);
}

function krProgress(kr: any): number | null {
  if (kr.current == null || kr.target === kr.baseline) return null;
  return Math.max(0, Math.min(1, (kr.current - kr.baseline) / (kr.target - kr.baseline)));
}
function goalView(g: any) {
  const krs = g.krs.map((k: any) => ({ ...k, progress: krProgress(k) }));
  const known = krs.filter((k: any) => k.progress != null);
  const progress = known.length ? known.reduce((s: number, k: any) => s + k.progress, 0) / known.length : null;
  const unknown = krs.length - known.length;
  return {
    ...g, krs, progress,
    how: known.length
      ? `The average of ${known.length} key result${known.length > 1 ? "s" : ""} with a current reading. Each one is (current - start) / (target - start).${unknown ? ` ${unknown} key result${unknown > 1 ? "s have" : " has"} no reading yet and ${unknown > 1 ? "are" : "is"} left out, not counted as zero.` : ""}`
      : "No key result has a current reading yet, so progress is unknown.",
  };
}

function greetingFor(ws: any, q: ReturnType<typeof buildQueue>, now: number, scopeName: string | null) {
  const h = new Date(now).getHours();
  const part = h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const today = q.needsYou.filter((i) => i.due != null && i.due - now <= 24 * HOUR).length;
  const words = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  let line: string;
  if (!q.needsYou.length) line = "Nothing needs you right now. A good day for deep work.";
  else if (today === 0) line = `Nothing is due today. ${words[Math.min(9, q.needsYou.length)] || q.needsYou.length} thing${q.needsYou.length > 1 ? "s" : ""} can wait for when you are ready.`;
  else line = `${words[today] || today} thing${today > 1 ? "s need" : " needs"} you today${scopeName ? ` for ${scopeName}` : ""}.`;
  return { hello: `${part}, ${ws.setup?.about?.name || ws.owner}.`, line, source: "rules" };
}

function publicItem(s: Scored) {
  return s; // Items already hold only what the detail sheet needs. Kept as a hook for redaction.
}

function scopeName(ws: any, scope: string): string | null {
  if (scope.startsWith("site:")) return ws.sites.find((s: any) => "site:" + s.id === scope)?.name || null;
  if (scope.startsWith("client:")) return ws.clients.find((c: any) => c.scope === scope)?.name || null;
  return null;
}

function queueFor(ws: any, scope: string, now: number) {
  return buildQueue(ws.items.filter((i: any) => inScope(i.scope, scope)), ws.rubric, now);
}

function overview(ws: any, scope: string, now: number) {
  const q = queueFor(ws, scope, now);
  const sod = startOfDay(now);
  const doneToday = q.done.filter((d) => d.status === "done" && (d.doneAt || 0) >= sod).length;
  const top = q.needsYou.slice(0, 5);
  const dueToday = q.needsYou.filter((i) => i.due != null && i.due - now <= 24 * HOUR).length;
  const clientsMode = scope.startsWith("client");
  const siteList = scope.startsWith("site:") ? ws.sites.filter((s: any) => "site:" + s.id === scope) : ws.sites;
  const numbers: any[] = [];
  if (!clientsMode && !siteList.length) {
    // No website is connected yet. Say so, rather than show a zero that looks like a real result.
    for (const [id, label] of [["visitors", "Visitors"], ["leads", "Leads"]]) numbers.push({ id, label, value: null, delta: null, spark: [], sentence: "Connect Google Analytics to see this.", href: "connections", source: "Google Analytics", period: "Last 7 days", state: "unknown" });
    numbers.push({ id: "reach", label: "Social reach", value: null, delta: null, spark: [], sentence: "Connect Metricool to see reach.", href: "connections", source: "Metricool", period: "Last 7 days", state: "unknown" });
  } else if (!clientsMode) {
    const tr = siteList.map((s: any) => siteTraffic(s, 7, now));
    const v = tr.reduce((a: number, x: any) => a + x.totals.visitors, 0), vp = tr.reduce((a: number, x: any) => a + x.totals.visitorsPrev, 0);
    const l = tr.reduce((a: number, x: any) => a + x.totals.leads, 0), lp = tr.reduce((a: number, x: any) => a + x.totals.leadsPrev, 0);
    numbers.push({ id: "visitors", label: "Visitors", value: v, delta: pct(v, vp), spark: addSeries(tr.map((x: any) => x.visitors)), sentence: sentence(pct(v, vp), "Visitors", "week"), href: "website", source: "Google Analytics", period: "Last 7 days" });
    numbers.push({ id: "leads", label: "Leads", value: l, delta: pct(l, lp), spark: addSeries(tr.map((x: any) => x.leads)), sentence: sentence(pct(l, lp), "Leads", "week"), href: "website", source: "Google Analytics", period: "Last 7 days" });
    const soc = siteList.map((s: any) => siteSocial(s, now)).filter((s: any) => s.state === "ok");
    if (soc.length) {
      const r = soc.reduce((a: number, x: any) => a + x.totals.reach, 0), rp = soc.reduce((a: number, x: any) => a + x.totals.reachPrev, 0);
      numbers.push({ id: "reach", label: "Social reach", value: r, delta: pct(r, rp), spark: addSeries(soc.map((x: any) => x.reach)), sentence: sentence(pct(r, rp), "Reach", "week"), href: "social", source: "Metricool", period: "Last 7 days" });
    } else numbers.push({ id: "reach", label: "Social reach", value: null, delta: null, spark: [], sentence: "Confirm this website's Metricool brand to see reach.", href: "connections", source: "Metricool", period: "Last 7 days", state: "unknown" });
  } else {
    const mine = q.needsYou.filter((i) => inMode(i.scope, scope));
    const replies = mine.filter((i) => i.kind === "reply").length, approvals = mine.filter((i) => i.kind === "approval").length;
    const dueWeek = mine.filter((i) => i.due != null && i.due - now <= 7 * DAY).length;
    numbers.push({ id: "replies", label: "Replies owed", value: replies, delta: null, spark: [], sentence: replies ? "Clients are waiting to hear from you." : "No client is waiting on a reply.", href: "inbox", source: "Gmail, Slack", period: "Now" });
    numbers.push({ id: "approvals", label: "Approvals waiting", value: approvals, delta: null, spark: [], sentence: approvals ? "Work is ready for your sign-off." : "Nothing is waiting for sign-off.", href: "attention", source: "Linear", period: "Now" });
    numbers.push({ id: "due", label: "Due this week", value: dueWeek, delta: null, spark: [], sentence: dueWeek ? "These have a set deadline in the next 7 days." : "No client deadlines this week.", href: "attention", source: "Linear", period: "Next 7 days" });
  }
  const topGoal = ws.goals.map(goalView).find((g: any) => g.top) || ws.goals.map(goalView)[0];
  if (topGoal) numbers.push({ id: "goal", label: "Top goal", value: topGoal.progress == null ? null : Math.round(topGoal.progress * 100), unit: "%", delta: null, spark: [], ring: topGoal.progress, sentence: topGoal.title, href: "goals", source: "Goals", period: topGoal.period, state: topGoal.progress == null ? "unknown" : undefined });
  const evs = ws.events.filter((e: any) => inScope(e.scope, scope) || !e.scope).filter((e: any) => e.end >= now && e.start < sod + 2 * DAY).sort((a: any, b: any) => a.start - b.start);
  const broken = ws.connections.filter((c: any) => c.status === "error");
  const newSuggestions = ws.suggestions.filter((s: any) => s.status === "new").length;
  // The 28-day chart follows the website that is selected. No website, no chart: never a made-up line.
  let chart: any = null;
  if (!clientsMode && siteList.length) {
    const t28 = siteList.map((s: any) => siteTraffic(s, 28, now));
    const tv = t28.reduce((a: number, x: any) => a + x.totals.visitors, 0), tvp = t28.reduce((a: number, x: any) => a + x.totals.visitorsPrev, 0);
    const tl = t28.reduce((a: number, x: any) => a + x.totals.leads, 0), tlp = t28.reduce((a: number, x: any) => a + x.totals.leadsPrev, 0);
    chart = { name: siteList.length === 1 ? siteList[0].name : "All websites", color: siteList.length === 1 ? siteList[0].color : null, source: "Google Analytics", period: "Last 28 days",
      visitors: { series: addSeries(t28.map((x: any) => x.visitors)), total: tv, delta: pct(tv, tvp) }, leads: { series: addSeries(t28.map((x: any) => x.leads)), total: tl, delta: pct(tl, tlp) } };
  }
  const reelList = ws.modules?.reels === false ? [] : (ws.reels || []).filter((r: any) => inScope(r.scope, scope)).sort((x: any, y: any) => y.publishedAt - x.publishedAt);
  const reelView = (r: any) => { const sc = [r.final.hooks.spoken, r.final.hooks.text, r.final.hooks.visual, ...r.final.buckets.map((b: any) => b.score)]; const site = ws.sites.find((s: any) => s.id === r.site);
    return { id: r.id, title: r.title, siteName: site?.name, color: site?.color, verdict: r.final.verdict, score: Math.round((sc.reduce((a: number, x: number) => a + x, 0) / (sc.length * 5)) * 100), hooks: r.final.hooks, next: r.next, fixes: r.fixes, publishedAt: r.publishedAt, views: (r.perf.d7 || r.perf.h72 || r.perf.h24)?.views ?? null }; };
  const reels = reelList.length ? { pass: reelList.filter((r: any) => r.final.verdict === "PASS").length, hold: reelList.filter((r: any) => r.final.verdict === "HOLD").length, total: reelList.length, list: reelList.slice(0, 6).map(reelView), verdicts: reelList.slice(0, 14).map((r: any) => r.final.verdict), rubric: "v1.2" } : null;
  return {
    chart, reels,
    greeting: greetingFor(ws, q, now, scopeName(ws, scope)),
    ring: { done: doneToday, total: doneToday + dueToday, left: dueToday },
    start: top[0] ? { id: top[0].id, title: top[0].title, nextStep: top[0].nextStep } : null,
    top: top.map(publicItem), totalNeedsYou: q.needsYou.length, verifyCount: q.verify.length,
    numbers, team: q.team.slice(0, 4), teamCount: q.team.length,
    today: { meetings: evs.filter((e: any) => e.kind !== "deadline").slice(0, 2), due: evs.filter((e: any) => e.kind === "deadline" && e.start < sod + DAY) },
    notices: { broken: broken.map((c: any) => ({ id: c.id, name: c.name, detail: c.detail })), newSuggestions },
    sample: !!ws.sample, calculatedAt: now, rubricVersion: ws.rubric.version, setupDone: !!ws.setup?.done,
  };
}

function simulateDebate(question: string) {
  const r = rng(hash(question));
  const pick = (a: string[]) => a[Math.floor(r() * a.length)];
  return [
    { name: "The Operator", stance: pick(["Not yet", "Yes, if scoped", "No"]), argument: "Look at what the team is already carrying. If this adds work in the next four weeks, name what stops to make room. If nothing stops, the answer is not yet." },
    { name: "The Customer", stance: pick(["Yes", "Careful", "Ask them"]), argument: "Start from who feels this decision first. If customers would notice the benefit within a month, that counts for a lot. If they would only notice the disruption, slow down." },
    { name: "The Skeptic", stance: pick(["Test first", "Depends", "Show me"]), argument: "What is the cheapest way to find out? A one-week test, five phone calls or a waitlist would tell you more than another meeting." },
    { name: "The Investor", stance: pick(["Yes, small", "Yes", "Only if it compounds"]), argument: "Ask whether this still pays off a year from now. One-off wins are fine, but the best yes is one that makes the next decision easier." },
  ];
}

export function activeWs(state: State) { return state.workspaces[state.active] || Object.values(state.workspaces)[0]; }

export function handle(state: State, req: Req): Res {
  const now = req.now ?? Date.now();
  const ws: any = activeWs(state);
  const q = req.query || {};
  const scope = q.scope || "sites:all";
  const seg = req.path.replace(/^\/+|\/+$/g, "").replace(/^api\/?/, "").split("/").filter(Boolean);
  const [a, b, c] = seg;
  const post = req.method === "POST";
  const body = req.body || {};

  if (!a) return ok({ name: "Keystone", endpoints: ENDPOINTS.map(([path, about]) => ({ path: "/api/" + path, about })) });

  if (a === "bootstrap") {
    return ok({
      theme: state.theme || "system",
      workspace: { id: ws.id, name: ws.name, owner: ws.owner, kind: ws.kind, sample: ws.sample, brand: ws.brand, modules: ws.modules, setupDone: !!ws.setup?.done },
      workspaces: Object.values(state.workspaces).map((w: any) => ({ id: w.id, name: w.name, kind: w.kind, accent: w.brand.accent })),
      sites: ws.sites.map((s: any) => ({ id: s.id, name: s.name, domain: s.domain, color: s.color, kind: s.kind })),
      clients: ws.clients.map((c: any) => ({ id: c.id, name: c.name, color: c.color, sub: c.sub })),
      accents: ACCENTS, modulesList: MODULES,
      counts: { attention: queueFor(ws, "all", now).needsYou.length, suggestions: ws.suggestions.filter((s: any) => s.status === "new").length, inbox: ws.inbox.filter((m: any) => m.needsReply).length },
    });
  }

  if (a === "overview") return ok(overview(ws, scope, now));

  if (a === "attention") {
    if (post && b) {
      const target = ws.items.find((i: any) => i.id === b);
      if (!target) return bad("No such item", 404);
      const group = ws.items.filter((i: any) => i.id === b || (target.actionKey && i.actionKey === target.actionKey));
      const by = ws.setup?.about?.name || ws.owner;
      const log = (action: string, why = "") => { const o = { by, why: why || body.reason || "", at: now, action }; group.forEach((i: any) => (i.override = o)); ws.overrides.unshift({ ...o, id: b, title: target.title }); ws.overrides = ws.overrides.slice(0, 200); };
      if (c === "done") { group.forEach((i: any) => { i.status = "done"; i.doneAt = now; }); }
      else if (c === "reopen") { group.forEach((i: any) => { i.status = "open"; i.doneAt = undefined; i.dismissed = false; }); }
      else if (c === "dismiss") { group.forEach((i: any) => { i.dismissed = true; i.doneAt = now; }); log("Dismissed"); }
      else if (c === "snooze") { const until = now + (Number(body.days) || 1) * DAY; group.forEach((i: any) => (i.snoozedUntil = until)); log(`Snoozed for ${Number(body.days) || 1} day${Number(body.days) > 1 ? "s" : ""}`); }
      else if (c === "unsnooze") { group.forEach((i: any) => (i.snoozedUntil = null)); log("Woken early"); }
      else if (c === "pin") { const min = Math.min(0, ...ws.items.filter((i: any) => i.pin != null).map((i: any) => i.pin)); group.forEach((i: any) => (i.pin = min - 1)); log("Pinned to the top"); }
      else if (c === "facts") {
        const facts = body.facts || {};
        group.forEach((i: any) => {
          for (const f of FACTORS) { const v = Number(facts[f.key]); if (facts[f.key] != null && isFinite(v)) i.factors = { ...i.factors, [f.key]: Math.max(0, Math.min(5, Math.round(v))) }; }
          const known = (k: string) => i.factors?.[k] != null;
          if ((known("urgency") || i.due != null) && known("impact") && known("unblocks") && known("alignment")) {
            i.missing = undefined;
            if (i.evidence === "needs-context") { i.evidence = "verified"; i.evidenceNote = `The missing facts were filled in by ${by}.`; }
          }
          i.lastVerified = now;
        });
        log("Filled in missing facts");
      }
      else if (c === "unpin") { group.forEach((i: any) => { i.pin = null; i.override = null; }); ws.overrides.unshift({ by, why: "", at: now, action: "Returned to automatic order", id: b, title: target.title }); }
      else if (c === "move") {
        const order = queueFor(ws, "all", now).needsYou.map((s) => s.id);
        const primary = order.find((id) => group.some((g: any) => g.id === id));
        const idx = order.indexOf(primary as string), to = idx + (body.dir === "up" ? -1 : 1);
        if (idx < 0 || to < 0 || to >= order.length) return ok({ moved: false });
        [order[idx], order[to]] = [order[to], order[idx]];
        // Lock the manual order for everything down to the moved row.
        order.slice(0, Math.max(idx, to) + 1).forEach((id, n) => {
          const it = ws.items.find((i: any) => i.id === id);
          ws.items.filter((i: any) => i.id === id || (it.actionKey && i.actionKey === it.actionKey)).forEach((i: any) => (i.pin = n));
        });
        log(body.dir === "up" ? "Moved up" : "Moved down");
      } else return bad("Unknown action");
      return ok({ ok: true }, true);
    }
    if (post) {
      const title = String(body.title || "").trim().slice(0, 140);
      if (title.length < 3) return bad("Give it a short title.");
      const kind = ["decision", "approval", "reply", "risk"].includes(body.kind) ? body.kind : "decision";
      const due = body.due ? Number(new Date(body.due)) : null;
      const sc = typeof body.scope === "string" && /^(site|client):/.test(body.scope) ? body.scope : null;
      const item = {
        id: "att-m" + now.toString(36), kind, title, nextStep: String(body.nextStep || "Decide the next step").trim().slice(0, 160), scope: sc, scopeLabel: sc ? scopeName(ws, sc) || undefined : undefined,
        owner: ws.setup?.about?.name || ws.owner, waitingOn: body.waitingOn === "other" ? "other" : "me", due: due && isFinite(due) ? due : null,
        sources: [{ tool: "doc", label: "Added by hand" }], evidence: "needs-context", evidenceNote: "You added this by hand. Answer the questions below so it can be ranked properly.",
        missing: "business impact, what it unblocks and goal fit", lastVerified: now, factors: {}, status: "open",
      };
      ws.items.push(item);
      return ok(item, true);
    }
    const queue = queueFor(ws, scope, now);
    return ok({ ...queue, factors: FACTORS, overrides: ws.overrides.slice(0, 20), sample: ws.sample });
  }

  if (a === "websites") {
    const rows = ws.sites.map((s: any) => {
      const t = siteTraffic(s, 28, now);
      return { id: s.id, name: s.name, domain: s.domain, kind: s.kind, color: s.color, visitors: t.totals.visitors, visitorsDelta: pct(t.totals.visitors, t.totals.visitorsPrev), leads: t.totals.leads, leadsDelta: pct(t.totals.leads, t.totals.leadsPrev), spark: t.visitors, needsYou: queueFor(ws, "site:" + s.id, now).needsYou.length };
    });
    return ok({ sites: rows, period: "Last 28 days", source: "Google Analytics", sample: ws.sample });
  }

  if (a === "website") {
    const days = [7, 28, 90].includes(Number(q.range)) ? Number(q.range) : 28;
    const list = q.site && q.site !== "all" ? ws.sites.filter((s: any) => s.id === q.site) : ws.sites;
    if (!ws.sites.length) return ok({ empty: true, site: null, days, visitors: [], leads: [], totals: null, deltas: {}, rate: null, sentences: {}, sources: [], pages: null, source: "Google Analytics", sample: ws.sample });
    if (!list.length) return bad("No such website", 404);
    const tr = list.map((s: any) => siteTraffic(s, days, now));
    const visitors = addSeries(tr.map((x: any) => x.visitors)), leads = addSeries(tr.map((x: any) => x.leads));
    const tot = { visitors: sum(visitors), leads: sum(leads), visitorsPrev: tr.reduce((s: number, x: any) => s + x.totals.visitorsPrev, 0), leadsPrev: tr.reduce((s: number, x: any) => s + x.totals.leadsPrev, 0) };
    const one = list.length === 1 ? list[0] : null;
    const period = days === 7 ? "week" : days === 28 ? "four weeks" : "quarter";
    return ok({
      site: one ? { id: one.id, name: one.name, domain: one.domain, kind: one.kind, color: one.color, gaProperty: one.gaProperty } : null,
      days, visitors, leads, totals: tot,
      deltas: { visitors: pct(tot.visitors, tot.visitorsPrev), leads: pct(tot.leads, tot.leadsPrev) },
      rate: tot.visitors ? tot.leads / tot.visitors : null,
      sentences: { visitors: sentence(pct(tot.visitors, tot.visitorsPrev), "Visitors", period), leads: sentence(pct(tot.leads, tot.leadsPrev), "Leads", period) },
      sources: one ? sources(one, tot.visitors) : list.some((x: any) => x.live) ? mergeSources(list) : sources({ id: "all" }, tot.visitors),
      pages: one ? topPages(one, tot.visitors) : null,
      lastSync: ws.connections.find((x: any) => x.id === "google-analytics")?.lastSync, source: "Google Analytics", sample: ws.sample,
    });
  }

  if (a === "social") {
    const list = q.site && q.site !== "all" ? ws.sites.filter((s: any) => s.id === q.site) : ws.sites;
    const per = list.map((s: any) => ({ site: { id: s.id, name: s.name, color: s.color }, ...siteSocial(s, now) }));
    const okOnes = per.filter((p: any) => p.state === "ok");
    const nets: Record<string, any> = {};
    okOnes.forEach((p: any) => p.networks.forEach((n: any) => {
      const x = (nets[n.id] ||= { id: n.id, name: n.name, followers: 0, followersDelta: 0, reach: 0, reachPrev: 0, series: [] as any[] });
      x.followers += n.followers; x.followersDelta += n.followersDelta; x.reach += n.reach; x.reachPrev += n.reachPrev; x.series.push(n.series);
    }));
    const networks = Object.values(nets).map((n: any) => ({ ...n, series: addSeries(n.series), delta: pct(n.reach, n.reachPrev) })).sort((x: any, y: any) => y.reach - x.reach);
    const reach = addSeries(okOnes.map((p: any) => p.reach));
    const tot = { reach: okOnes.reduce((s: number, p: any) => s + p.totals.reach, 0), reachPrev: okOnes.reduce((s: number, p: any) => s + p.totals.reachPrev, 0), followers: okOnes.reduce((s: number, p: any) => s + p.totals.followers, 0) };
    const reelPool = ws.reels.filter((r: any) => list.some((s: any) => s.id === r.site) && r.perf.h24);
    const best = reelPool.sort((x: any, y: any) => (y.perf.d7 || y.perf.h72 || y.perf.h24).views - (x.perf.d7 || x.perf.h72 || x.perf.h24).views)[0];
    const sod = startOfDay(now);
    const upNext = !ws.sample ? [] : list.slice(0, 4).flatMap((s: any, i: number) => s.metricoolBrand.confirmed ? [{ id: "up-" + s.id, site: s.name, color: s.color, network: NETWORK_LABEL[s.networks[0]], title: ["Behind the scenes clip", "Customer story", "Weekly tip", "New feature teaser"][i % 4], at: sod + (i + 1) * DAY + (9 + i * 2) * HOUR }] : []);
    const competitors = ws.sample && list.length === 1 && okOnes.length ? ["instagram", "facebook"].filter((n) => list[0].networks.includes(n)).map((n) => {
      const mine = okOnes[0].networks.find((x: any) => x.id === n);
      const r = rng(hash("comp" + list[0].id + n));
      return { network: NETWORK_LABEL[n], rows: [{ name: list[0].name, you: true, followers: mine.followers, reach: mine.reach }, ...["Rival A", "Rival B"].map((nm) => ({ name: nm, you: false, followers: Math.round(mine.followers * (0.6 + r() * 1.1)), reach: Math.round(mine.reach * (0.5 + r() * 1.2)) }))] };
    }) : [];
    return ok({
      state: okOnes.length ? "ok" : per[0]?.state || "unmatched",
      pending: per.filter((p: any) => p.state !== "ok").map((p: any) => ({ ...p.site, state: p.state })),
      totals: tot, delta: pct(tot.reach, tot.reachPrev), sentence: sentence(pct(tot.reach, tot.reachPrev), "Reach", "week"),
      reach, networks, perSite: per.length > 1 ? okOnes.map((p: any) => ({ ...p.site, reach: p.totals.reach, delta: pct(p.totals.reach, p.totals.reachPrev) })).sort((x: any, y: any) => y.reach - x.reach) : null,
      best: best ? { id: best.id, title: best.title, platform: NETWORK_LABEL[best.platform], views: (best.perf.d7 || best.perf.h72 || best.perf.h24).views, why: best.rationale, site: ws.sites.find((s: any) => s.id === best.site)?.name } : null,
      upNext, competitors, lastSync: ws.connections.find((x: any) => x.id === "metricool")?.lastSync, source: "Metricool", sample: ws.sample,
    });
  }

  if (a === "reels") {
    const list = ws.reels.filter((r: any) => !q.site || q.site === "all" || r.site === q.site).map((r: any) => ({ ...r, siteName: ws.sites.find((s: any) => s.id === r.site)?.name, color: ws.sites.find((s: any) => s.id === r.site)?.color, platformName: NETWORK_LABEL[r.platform] }));
    list.sort((x: any, y: any) => (x.final.verdict === "HOLD" ? 0 : 1) - (y.final.verdict === "HOLD" ? 0 : 1) || y.publishedAt - x.publishedAt);
    return ok({ reels: list, rubric: "v1.2", hold: list.filter((r: any) => r.final.verdict === "HOLD").length, pass: list.filter((r: any) => r.final.verdict === "PASS").length, note: "Scores judge the edit. They do not predict how far a reel will travel.", sample: ws.sample });
  }

  if (a === "goals") {
    if (post && b === "checkin") {
      for (const g of ws.goals) for (const k of g.krs) if (k.id === body.krId) {
        const v = Number(body.value);
        if (!isFinite(v)) return bad("Enter a number");
        k.current = v; k.checkins.push({ at: now, value: v, note: String(body.note || "").slice(0, 200) });
        return ok({ ok: true }, true);
      }
      return bad("No such key result", 404);
    }
    return ok({ goals: ws.goals.map(goalView), sample: ws.sample });
  }

  if (a === "metrics") return ok({ metrics: ws.metrics, sample: ws.sample });

  if (a === "decisions") {
    if (post && !b) {
      const question = String(body.question || "").trim().slice(0, 300);
      if (question.length < 8) return bad("Write the decision as a full question.");
      const d = { id: "dec-" + now.toString(36), question, createdAt: now, status: "open", simulated: !body.advisors, advisors: body.advisors || simulateDebate(question), outcome: null, nextActions: [] as string[] };
      ws.decisions.unshift(d);
      return ok(d, true);
    }
    if (post && b) {
      const d = ws.decisions.find((x: any) => x.id === b);
      if (!d) return bad("No such decision", 404);
      if (body.outcome !== undefined) { d.outcome = String(body.outcome).slice(0, 300) || null; d.status = d.outcome ? "decided" : "open"; d.decidedAt = now; }
      if (Array.isArray(body.nextActions)) d.nextActions = body.nextActions.map((x: any) => String(x).slice(0, 160)).slice(0, 6);
      return ok(d, true);
    }
    return ok({ decisions: ws.decisions, sample: ws.sample });
  }

  if (a === "clients") {
    const all = queueFor(ws, "all", now);
    const rows = ws.clients.map((cl: any) => {
      const mine = all.needsYou.filter((i) => i.scope === cl.scope);
      const dues = [...mine.map((i) => i.due).filter(Boolean), ...cl.tasks.filter((t: any) => t.status !== "Done" && t.due > now).map((t: any) => t.due)] as number[];
      return { ...cl, replies: mine.filter((i) => i.kind === "reply").length, approvals: mine.filter((i) => i.kind === "approval").length, needsYou: mine, waiting: all.team.filter((i) => i.scope === cl.scope), nextDue: dues.length ? Math.min(...dues) : null };
    });
    return ok({ clients: q.id ? rows.filter((r: any) => r.id === q.id) : rows, sample: ws.sample });
  }

  if (a === "inbox") return ok({ messages: ws.inbox.filter((m: any) => inScope(m.scope, scope)).sort((x: any, y: any) => Number(y.needsReply) - Number(x.needsReply) || y.at - x.at), sample: ws.sample });
  if (a === "calendar") { const sod = startOfDay(now); return ok({ start: sod, days: 7, events: ws.events.filter((e: any) => inScope(e.scope, scope) || !e.scope).filter((e: any) => e.start >= sod && e.start < sod + 7 * DAY).sort((x: any, y: any) => x.start - y.start), sample: ws.sample }); }
  if (a === "files") return ok({ files: ws.files.filter((f: any) => inScope(f.scope, scope)).sort((x: any, y: any) => y.modified - x.modified), sample: ws.sample });
  if (a === "outputs") return ok({ outputs: ws.outputs.filter((o: any) => inScope(o.scope, scope)).map((o: any) => ({ ...o, latest: o.revisions[0], latestApproved: o.revisions.find((r: any) => r.state === "Approved") || null })), sample: ws.sample });
  if (a === "skills") return ok({ skills: ws.skills, sample: ws.sample });

  if (a === "suggestions") {
    if (post && b) {
      const s = ws.suggestions.find((x: any) => x.id === b);
      if (!s) return bad("No such suggestion", 404);
      if (!["accepted", "dismissed", "new"].includes(body.status)) return bad("Unknown status");
      s.status = body.status; s.decidedAt = now;
      return ok(s, true);
    }
    return ok({ suggestions: ws.suggestions, note: "Suggestions never change anything by themselves. Accepting one only marks it for you to act on.", sample: ws.sample });
  }

  if (a === "usage") {
    const u = ws.usage;
    const extra = u.entries.filter((e: any) => e.kind === "api" && e.cost != null).reduce((s: number, e: any) => s + e.cost, 0);
    return ok({ ...u, extraSpend: extra, plansTotal: u.plans.filter((p: any) => p.status === "Connected").reduce((s: number, p: any) => s + p.monthly, 0), unknown: u.entries.filter((e: any) => e.tokens == null).length, note: "Tokens used and tasks finished are activity, not business results.", sample: ws.sample });
  }

  if (a === "connections") {
    if (post && b === "brands") {
      const s = ws.sites.find((x: any) => x.id === body.siteId);
      if (!s) return bad("No such website", 404);
      s.metricoolBrand.matched = true; s.metricoolBrand.confirmed = body.confirmed !== false;
      const m = ws.connections.find((x: any) => x.id === "metricool");
      if (m) m.detail = `${ws.sites.filter((x: any) => x.metricoolBrand.confirmed).length} of ${ws.sites.length} brands confirmed`;
      return ok({ ok: true }, true);
    }
    if (post && b) {
      const cn = ws.connections.find((x: any) => x.id === b);
      if (!cn) return bad("No such connection", 404);
      if (body.action === "disconnect") { cn.status = "off"; cn.detail = "Not connected"; cn.lastSync = null; cn.account = ""; }
      else { cn.status = "connected"; cn.detail = ws.sample ? "Connected (sample data)" : "Connected"; cn.lastSync = now; cn.account = cn.account || (cn.auth === "token" ? "Token saved on this laptop" : "Signed in"); }
      return ok(cn, true);
    }
    return ok({ connections: ws.connections, brands: ws.sites.map((s: any) => ({ siteId: s.id, site: s.name, domain: s.domain, color: s.color, ...s.metricoolBrand })), sample: ws.sample });
  }

  if (a === "setup") {
    if (post) {
      if (body.about) ws.setup.about = { ...ws.setup.about, ...body.about };
      if (Array.isArray(body.goals)) ws.setup.goals = body.goals.map((g: any) => String(g).slice(0, 140)).filter(Boolean).slice(0, 5);
      if (body.step != null) ws.setup.step = Number(body.step) || 0;
      if (body.done != null) ws.setup.done = !!body.done;
      if (body.about?.name) ws.owner = String(body.about.name).slice(0, 40);
      return ok(ws.setup, true);
    }
    return ok({ setup: ws.setup, connections: ws.connections.map((x: any) => ({ id: x.id, name: x.name, tool: x.tool, status: x.status, gives: x.gives })), sitesFound: ws.sites.length });
  }

  if (a === "settings") {
    if (post) {
      if (body.brandName != null) { ws.brand.name = String(body.brandName).slice(0, 40) || ws.brand.name; ws.name = ws.brand.name; }
      if (body.accent && ACCENTS[body.accent]) ws.brand.accent = body.accent;
      if (body.theme && ["system", "light", "dark"].includes(body.theme)) state.theme = body.theme;
      if (body.modules) for (const m of MODULES) if (!m.core && body.modules[m.id] != null) ws.modules[m.id] = !!body.modules[m.id];
      if (body.weights) {
        let touched = false;
        for (const f of FACTORS) { const v = Number(body.weights[f.key]); if (isFinite(v) && v >= 0 && v <= 10 && v !== ws.rubric.weights[f.key]) { ws.rubric.weights[f.key] = v; touched = true; } }
        if (touched) { const [maj, min] = String(ws.rubric.version).split(".").map(Number); ws.rubric.version = `${maj}.${(min || 0) + 1}`; ws.rubric.changedAt = now; }
      }
      if (body.resetRubric) { ws.rubric.weights = { urgency: 7, impact: 6, unblocks: 4, alignment: 2, waitingAge: 1 }; ws.rubric.version = String(ws.rubric.version).split(".")[0] + "." + (Number(String(ws.rubric.version).split(".")[1] || 0) + 1); }
      return ok({ ok: true }, true);
    }
    return ok({ brand: ws.brand, theme: state.theme || "system", modules: ws.modules, modulesList: MODULES, rubric: ws.rubric, factors: FACTORS, accents: ACCENTS, workspace: { id: ws.id, name: ws.name, kind: ws.kind, sample: ws.sample, templateVersion: ws.templateVersion } });
  }

  if (a === "workspaces") {
    if (post && b === "switch") { if (!state.workspaces[body.id]) return bad("No such workspace", 404); state.active = body.id; return ok({ active: body.id }, true); }
    if (post && b === "delete") { if (body.id === "main" || !state.workspaces[body.id]) return bad("This workspace cannot be removed."); delete state.workspaces[body.id]; if (state.active === body.id) state.active = "main"; return ok({ ok: true }, true); }
    if (post) {
      const name = String(body.name || "").trim().slice(0, 40);
      if (name.length < 2) return bad("Give the workspace a name.");
      const id = "ws-" + now.toString(36);
      if (body.real) {
        state.workspaces[id] = makeWorkspace({ id, name, owner: String(body.owner || "Owner").slice(0, 40), accent: ACCENTS[body.accent] ? body.accent : "blue", kind: "owner", empty: true }, now);
        state.active = id;
        return ok({ id }, true);
      }
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
      state.workspaces[id] = makeWorkspace({ id, name, owner: String(body.owner || "Owner").slice(0, 40), accent: ACCENTS[body.accent] ? body.accent : "green", kind: "client", sites: [{ id: slug, name, domain: slug + ".example", kind: String(body.kind || "Business website").slice(0, 40), color: ACCENTS[body.accent]?.light || "#1F8F4E", base: 600 + (hash(name) % 900), growth: 0.12, leadRate: 0.03, networks: ["instagram", "facebook"] }] }, now);
      return ok({ id }, true);
    }
    return ok({ active: state.active, workspaces: Object.values(state.workspaces).map((w: any) => ({ id: w.id, name: w.name, owner: w.owner, kind: w.kind, accent: w.brand.accent, sites: w.sites.length, items: w.items.length, rubric: w.rubric.version, sample: w.sample })) });
  }

  if (a === "export") {
    const copy = JSON.parse(JSON.stringify(ws));
    copy.connections.forEach((x: any) => { delete x.token; delete x.tokens; });
    return ok({ exportedAt: now, app: "Keystone", workspace: copy });
  }

  if (a === "reset" && post) {
    const fresh = makeState(now);
    if (body.scope === "workspace" && !ws.sample) { state.workspaces[ws.id] = makeWorkspace({ id: ws.id, name: ws.name, owner: ws.owner, accent: ws.brand.accent, kind: ws.kind, empty: true }, now); }
    else if (body.scope === "workspace") { state.workspaces[ws.id] = fresh.workspaces[ws.id] || makeWorkspace({ id: ws.id, name: ws.name, owner: ws.owner, accent: ws.brand.accent, kind: ws.kind, sites: ws.kind === "client" ? ws.sites : undefined }, now); }
    else { state.workspaces = fresh.workspaces; state.active = "main"; state.theme = "system"; }
    return ok({ ok: true }, true);
  }

  if (a === "search") {
    const term = String(q.q || "").toLowerCase().trim();
    if (!term) return ok({ results: [] });
    const hit = (s: string) => s && s.toLowerCase().includes(term);
    const out: any[] = [];
    MODULES.forEach((m) => hit(m.label) && ws.modules[m.id] !== false && out.push({ type: "Page", title: m.label, href: m.id }));
    ws.sites.forEach((s: any) => (hit(s.name) || hit(s.domain)) && out.push({ type: "Website", title: s.name, sub: s.domain, href: "website", site: s.id }));
    ws.clients.forEach((cl: any) => hit(cl.name) && out.push({ type: "Client", title: cl.name, sub: cl.sub, href: "clients", client: cl.id }));
    queueFor(ws, "all", now).needsYou.forEach((i) => hit(i.title) && out.push({ type: "Needs you", title: i.title, sub: i.nextStep, href: "attention", item: i.id }));
    ws.goals.forEach((g: any) => hit(g.title) && out.push({ type: "Goal", title: g.title, href: "goals" }));
    ws.metrics.forEach((m: any) => hit(m.name) && out.push({ type: "Metric", title: m.name, sub: m.scopeLabel, href: "metrics" }));
    ws.outputs.forEach((o: any) => hit(o.title) && out.push({ type: "Output", title: o.title, sub: o.scopeLabel, href: "outputs" }));
    ws.files.forEach((f: any) => hit(f.name) && out.push({ type: "File", title: f.name, sub: f.owner, href: "files" }));
    ws.decisions.forEach((d: any) => hit(d.question) && out.push({ type: "Decision", title: d.question, href: "decisions" }));
    ws.skills.forEach((s: any) => hit(s.name) && out.push({ type: "Skill", title: s.name, href: "skills" }));
    return ok({ results: out.slice(0, 12) });
  }

  if (a === "ai") {
    if (b === "status") return ok({ available: false, provider: null, mode: "rules", note: "No Claude Code or Codex found. Summaries are written by simple rules." });
    if (b === "ask" && post) return ok(localAnswer(ws, String(body.question || ""), scope, now));
  }

  return bad("Unknown endpoint: /" + seg.join("/"), 404);
}

/** A plain, rules-based answer used when no AI plan is linked. It only reads the dashboard's own data. */
export function localAnswer(ws: any, question: string, scope: string, now: number) {
  const ql = question.toLowerCase();
  const o = overview(ws, scope, now);
  let answer: string;
  if (/reel|video|hook/.test(ql)) {
    const hold = ws.reels.filter((r: any) => r.final.verdict === "HOLD");
    answer = hold.length ? `${hold.length} reel${hold.length > 1 ? "s are" : " is"} on HOLD: ${hold.map((r: any) => r.title).join(", ")}. The first fix for each is on the Reel scores page.` : "Every scored reel has passed. Nothing is on HOLD.";
  } else if (/visitor|traffic|website|lead/.test(ql)) {
    const v = o.numbers.find((n: any) => n.id === "visitors"), l = o.numbers.find((n: any) => n.id === "leads");
    answer = v ? `${v.value.toLocaleString("en-US")} visitors in the last 7 days. ${v.sentence} ${l ? `${l.value.toLocaleString("en-US")} leads. ${l.sentence}` : ""}` : "Website numbers are not available in this view.";
  } else if (/social|reach|follower|metricool/.test(ql)) {
    const r = o.numbers.find((n: any) => n.id === "reach");
    answer = r && r.value != null ? `Social reach is ${r.value.toLocaleString("en-US")} in the last 7 days. ${r.sentence}` : "Social reach is not available yet. Confirm the Metricool brand on the Connections page.";
  } else if (/goal|okr/.test(ql)) {
    const g = o.numbers.find((n: any) => n.id === "goal");
    answer = g ? `Your top goal is "${g.sentence}". It is ${g.value == null ? "not measured yet" : g.value + "% of the way there"}.` : "No goals are set yet.";
  } else {
    answer = o.top.length ? `${o.greeting.line} Start with: ${o.top[0].title}. Then: ${o.top.slice(1, 3).map((t: any) => t.title).join("; ") || "nothing else is pressing"}.` : o.greeting.line;
  }
  return { answer, provider: "rules", note: "Written by simple rules from your dashboard data. Link Claude Code or Codex for fuller answers." };
}

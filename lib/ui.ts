// Everything the Obsidian screens show, worked out in one place from the open workspace.
// The screens in ui/js only draw what this returns. A tool that is not connected comes back as state "off",
// so the screen can say so. Nothing here is ever made up.
import { DAY, HOUR, startOfDay } from "./rand.ts";
import { queueFor, siteTraffic } from "./api.ts";

export const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const word = (n: number) => WORDS[n] || String(n);

/** "4 minutes ago", for the line under a source. */
export function since(t: number | null | undefined, now: number) {
  if (!t) return "not yet";
  const d = Math.max(0, now - t);
  if (d < 90000) return "just now";
  if (d < HOUR) return plural(Math.round(d / 60000), "minute") + " ago";
  if (d < DAY) return plural(Math.round(d / HOUR), "hour") + " ago";
  return plural(Math.round(d / DAY), "day") + " ago";
}
const SYMBOL: Record<string, string> = { usd: "$", eur: "€", gbp: "£", cad: "CA$", aud: "A$", inr: "₹", pkr: "Rs ", aed: "AED ", jpy: "¥", chf: "CHF ", sgd: "S$", nzd: "NZ$" };
export const symbolOf = (code?: string) => SYMBOL[String(code || "usd").toLowerCase()] || String(code || "").toUpperCase() + " ";
const TOOL: Record<string, [string, string]> = {
  linear: ["Linear", "--violet"], gmail: ["Gmail", "--ember"], drive: ["Google Drive", "--mint"], calendar: ["Google Calendar", "--ice"], slack: ["Slack", "--violet"],
  stripe: ["Stripe", "--gold"], analytics: ["Google Analytics", "--ice"], metricool: ["Metricool", "--mint"], manual: ["Added by you", "--text-2"],
};
const tool = (id: string) => TOOL[id] || [id ? id[0].toUpperCase() + id.slice(1) : "Dashboard", "--text-2"];
const conn = (ws: any, id: string) => (ws.connections || []).find((c: any) => c.id === id);
const pctOf = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
const signed = (p: number | null) => (p == null ? "" : `<span class="${p > 0 ? "up" : p < 0 ? "down" : "dim"}">${p > 0 ? "+" : ""}${p}%</span>`);

function dueText(due: number | null | undefined, now: number): [string, boolean] {
  if (due == null) return ["", false];
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  if (due < now) return [now - due < DAY ? "overdue" : `${Math.max(1, Math.round((now - due) / DAY))} days overdue`, true];
  if (days === 0) return ["due today", true];
  if (days === 1) return ["due tomorrow", false];
  if (days < 7) return ["due " + new Date(due).toLocaleDateString("en-US", { weekday: "long" }), false];
  return ["due " + new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "long" }), false];
}

/* ---------- websites ---------- */
function lastDays(rows: any[], key: string, n: number, now: number): number[] | null {
  if (!rows.some((r) => r[key] != null)) return null;
  const end = startOfDay(now), by = new Map(rows.map((r) => [startOfDay(r.t), r]));
  return Array.from({ length: n }, (_, i) => by.get(end - (n - 1 - i) * DAY)?.[key] || 0);
}
function siteView(s: any, now: number) {
  const tr = siteTraffic(s, 180, now), live = s.live || null;
  const srcTotal = (live?.sources || []).reduce((a: number, x: any) => a + x.visitors, 0);
  return {
    id: s.id, name: s.name, sub: s.domain || "",
    v: tr.visitors.map((p: any) => p.v), l: tr.leads.map((p: any) => p.v), s: live?.daily ? lastDays(live.daily, "sessions", 180, now) : null,
    er: live?.engagement || null, tm: live?.time || null,
    src: (live?.sources || []).map((x: any) => ({ name: x.name, n: x.visitors, share: srcTotal ? x.visitors / srcTotal : 0 })).sort((a: any, b: any) => b.n - a.n).slice(0, 6),
    pages: (live?.pages || []).slice(0, 5).map((p: any) => ({ path: p.path, n: p.visitors })),
  };
}
function gaView(ws: any, now: number) {
  const c = conn(ws, "google-analytics"), sites = (ws.sites || []).map((s: any) => siteView(s, now));
  const state = sites.length ? "ok" : c?.status === "connected" ? "empty" : c?.status === "error" ? "error" : "off";
  return { state, when: since(c?.lastSync, now), detail: state === "error" ? String(c?.detail || "") : "", end: startOfDay(now), sites };
}

/* ---------- money ---------- */
function moneyView(ws: any, now: number) {
  const c = conn(ws, "stripe"), m = ws.money;
  if (!m || !Array.isArray(m.daily)) return { state: c?.status === "error" ? "error" : c?.status === "connected" ? "empty" : "off", detail: c?.status === "error" ? String(c.detail || "") : "" };
  const sym = symbolOf(m.currency), day = (t: number) => startOfDay(t), by = new Map<number, number>(m.daily.map((d: any) => [day(d.t), d.gross]));
  const d0 = new Date(now), months: [string, number][] = [];
  for (let k = 11; k >= 0; k--) {
    const a = new Date(d0.getFullYear(), d0.getMonth() - k, 1), b = new Date(d0.getFullYear(), d0.getMonth() - k + 1, 1);
    let t = 0; for (const [ts, v] of by) if (ts >= a.getTime() && ts < b.getTime()) t += v;
    months.push([a.toLocaleDateString("en-US", { month: "short" }), t]);
  }
  const dom = d0.getDate(), dim = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate(), total = months[11][1];
  const pa = new Date(d0.getFullYear(), d0.getMonth() - 1, 1).getTime(), pb = new Date(d0.getFullYear(), d0.getMonth() - 1, Math.min(dom, new Date(d0.getFullYear(), d0.getMonth(), 0).getDate()) + 1).getTime();
  let prevSame = 0; for (const [ts, v] of by) if (ts >= pa && ts < pb) prevSame += v;
  const end = startOfDay(now), days56 = Array.from({ length: 56 }, (_, i) => by.get(end - (55 - i) * DAY) || 0);
  const pays: any[] = m.payments || [], failed = pays.filter((p) => p.status === "failed" && !p.recovered);
  const fresh = pays.filter((p) => p.status === "paid" && p.at >= now - DAY);
  const custs: any[] = (m.customers || []).slice().sort((a: any, b: any) => b.paid - a.paid), ctotal = custs.reduce((a, x) => a + x.paid, 0) || 1;
  const monthName = d0.toLocaleDateString("en-US", { month: "long" }), prevName = new Date(d0.getFullYear(), d0.getMonth() - 1, 1).toLocaleDateString("en-US", { month: "long" });
  return {
    state: "ok", sym, when: since(m.when, now), monthName, prevName, total, delta: pctOf(total, prevSame), months, pace: dom >= 3 ? (total / dom) * dim : null,
    days56, mrr: m.mrr ?? null, subs: m.subs ?? null, payout: m.payout ? { amount: m.payout.amount, on: new Date(m.payout.at).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }) } : null,
    failed: failed.map((p) => ({ who: p.customer || "A customer", why: p.reason || "The payment failed", amount: p.amount, on: new Date(p.at).toLocaleDateString("en-GB", { day: "numeric", month: "long" }), url: p.url || "" })),
    failedTotal: failed.reduce((a, p) => a + p.amount, 0),
    fresh: { total: fresh.reduce((a, p) => a + p.amount, 0), rows: fresh.slice(0, 5).map((p) => [p.customer || "A customer", p.desc || "Payment", sym + fmt(p.amount)]) , n: fresh.length },
    top: custs.slice(0, 6).map((x) => ({ name: x.name, paid: x.paid, share: Math.round((x.paid / ctotal) * 100) })),
    recent: pays.filter((p) => p.status === "paid").slice(0, 8).map((p) => [p.customer || "A customer", (p.desc || "Payment") + " · " + new Date(p.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), sym + fmt(p.amount)]),
  };
}

/* ---------- needs you ---------- */
const KIND: Record<string, string> = { approval: "Approve", reply: "Reply", decision: "Decide", risk: "Check" };
function needCard(i: any, now: number) {
  const [t0, col] = tool(i.sources?.[0]?.tool || "manual"), [due, hot] = dueText(i.due, now), link = (i.sources || []).find((s: any) => /^https?:/.test(s.url || ""));
  const rows: any[] = [];
  if (i.nextStep) rows.push(["Next step", i.nextStep]);
  if (i.consequence) rows.push(["If it waits", i.consequence]);
  if (i.owner) rows.push(["Owner", i.waitingOn === "other" ? "You are waiting on " + i.owner : i.owner]);
  if (i.topReasons?.length) rows.push(["Why it ranks here", i.topReasons.join(". ")]);
  const acts: any[] = [["Mark as done", "do:attention/" + i.id + "/done"], ["All the details", "item:" + i.id]];
  if (link) acts.push(["Open in " + tool(link.tool)[0], link.url]);
  return {
    small: 1, icon: "needs", glow: hot ? "--bad" : col, ey: `<b>${esc(t0)}</b> &nbsp;·&nbsp; needs you`, title: i.title,
    big: due ? due[0].toUpperCase() + due.slice(1) : "", bigCls: hot ? "down" : "", bigNote: i.scopeLabel ? esc(i.scopeLabel) : "",
    lede: i.evidenceNote && i.evidence !== "verified" ? i.evidenceNote : "", rows,
    src: (i.sources || []).map((s: any) => [tool(s.tool)[0], tool(s.tool)[1], (s.label || "") + (s.ref ? " · " + s.ref : ""), since(i.lastVerified, now)]), acts,
  };
}
function needsView(ws: any, now: number) {
  const q = queueFor(ws, "all", now), top = q.needsYou.slice(0, 5);
  return {
    total: q.needsYou.length, today: q.needsYou.filter((i: any) => i.due != null && i.due - now <= DAY).length, waiting: q.team.length,
    done24: q.done.filter((d: any) => d.status === "done" && (d.doneAt || 0) >= now - DAY).length,
    rows: top.map((i: any) => { const [due, hot] = dueText(i.due, now); return { id: i.id, t: i.title, sub: [tool(i.sources?.[0]?.tool || "manual")[0], i.scopeLabel, due].filter(Boolean).join(" · "), tag: KIND[i.kind] || "Open", cls: hot || i.urgentFlag ? "hot" : "", card: needCard(i, now) }; }),
  };
}

/* ---------- goals: week feeds month, month feeds quarter ---------- */
export const LEVELS = ["quarter", "month", "week"] as const;
export function periodName(level: string, now: number) {
  const d = new Date(now);
  if (level === "quarter") return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
  if (level === "month") return d.toLocaleDateString("en-US", { month: "long" });
  const a = new Date(startOfDay(now) - ((d.getDay() + 6) % 7) * DAY), b = new Date(a.getTime() + 6 * DAY);
  const f = (x: Date, m: boolean) => x.toLocaleDateString("en-GB", m ? { day: "numeric", month: "long" } : { day: "numeric" });
  return a.getMonth() === b.getMonth() ? `${f(a, false)} to ${f(b, true)}` : `${f(a, true)} to ${f(b, true)}`;
}
function goalsView(ws: any, now: number) {
  const list: any[] = ws.plan?.goals || [];
  const d = new Date(now), qEnd = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 1).getTime();
  const title = (id: string) => list.find((g) => g.id === id)?.title || "";
  const levels = LEVELS.map((lv, n) => {
    const mine = list.filter((g) => g.level === lv), p = mine.length ? Math.round(mine.reduce((a, g) => a + (g.progress || 0), 0) / mine.length) : 0;
    const on = mine.filter((g) => (g.progress || 0) >= 45).length, top = mine.slice().sort((a, b) => (b.progress || 0) - (a.progress || 0))[0];
    return {
      id: lv, k: ["Quarter", "Month", "Week"][n], sub: periodName(lv, now), p, n: mine.length, head: mine[0]?.title || "", top: top?.title || "",
      note: mine.length ? `${plural(mine.length, "goal")} · ${on === mine.length ? "on pace" : `${on} of ${mine.length} on track`}` : "No goals yet",
      items: mine.map((g) => [g.title, Math.round(g.progress || 0), g.feeds && title(g.feeds) ? "Feeds: " + title(g.feeds) : n === 0 && mine[0] === g ? "Top goal" : "", g.id]),
    };
  });
  return {
    state: list.length ? "ok" : "empty", levels, total: list.length, onTrack: list.filter((g) => (g.progress || 0) >= 45).length,
    raw: list.map((g) => ({ id: g.id, feeds: g.feeds || "" })),
    doneWeek: list.filter((g) => g.level === "week" && (g.progress || 0) >= 100).length, daysLeft: Math.max(0, Math.ceil((qEnd - now) / DAY)), week: isoWeek(now),
  };
}
export function isoWeek(now: number) {
  const d = new Date(now), t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn);
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
}

/* ---------- AI news ---------- */
export const TOPICS: [string, string, string][] = [
  ["video", "AI video and reels", "Video"], ["marketing", "AI for marketing and ads", "Marketing"], ["agents", "AI agents and automation", "Agents"], ["local", "AI for local businesses", "Local"],
  ["image", "AI image and design tools", "Images"], ["models", "New AI models", "Models"], ["code", "AI for websites and code", "Websites"], ["sales", "AI for sales and email", "Sales"],
  ["voice", "AI voice and audio", "Voice"], ["rules", "AI rules and policy", "Rules"],
];
function newsView(ws: any, now: number) {
  const n = ws.news || {}, picked: string[] = n.topics?.length ? n.topics : ["agents", "marketing", "models"], custom: [string, string][] = n.custom || [];
  const all = [...TOPICS.map((t) => [t[0], t[1], t[2]]), ...custom.map(([id, name]) => [id, name, name.length > 14 ? name.slice(0, 13) + "…" : name])];
  const ago = (t: number) => { const d = Math.max(0, now - t); return d < HOUR ? Math.max(1, Math.round(d / 60000)) + "m" : d < DAY ? Math.round(d / HOUR) + "h" : Math.round(d / DAY) + "d"; };
  const stories = (n.stories || []).filter((s: any) => picked.includes(s.topic)).map((s: any) => ({
    id: s.id, topic: s.topic, name: s.src, h: s.by || "", t: s.at ? ago(s.at) : "", head: s.head, sum: s.sum || "", use: s.use || [], fit: s.fit || 0, st: s.st || "", url: s.url || "",
  }));
  return { state: n.when ? "ok" : "off", stale: !!n.when && now - n.when > 6 * HOUR, when: since(n.when, now), error: n.error || "", topics: picked, all, stories, ai: n.ai || "", writing: !!n.busy && now - n.busy < 4 * 60000 };
}

/* ---------- AI made ---------- */
function madeView(ws: any, now: number) {
  const m = ws.made || {}, end = startOfDay(now) + DAY, items = (m.items || []).filter((x: any) => x.at >= end - 14 * DAY).sort((a: any, b: any) => b.at - a.at);
  const perDay = Array.from({ length: 14 }, () => 0), ais: Record<string, number> = {};
  const view = items.map((x: any) => {
    const day = Math.min(13, Math.max(0, Math.floor((end - 1 - x.at) / DAY)));
    perDay[13 - day]++; ais[x.ai] = (ais[x.ai] || 0) + 1;
    return { id: x.id, title: x.title, type: x.type, ai: x.ai, project: x.project || "", path: x.path || "", day, when: day === 0 ? "Today" : day === 1 ? "Yesterday" : day + " days ago", txt: x.title.replace(/\.[a-z0-9]+$/i, ""), pic: x.type === "image" };
  });
  const count = (t: string[]) => view.filter((x: any) => t.includes(x.type)).length;
  return {
    state: m.when ? (view.length ? "ok" : "empty") : "off", old: !!m.when && now - m.when > HOUR, when: since(m.when, now), from: new Date(end - 14 * DAY).toLocaleDateString("en-GB", { day: "numeric", month: "long" }), total: view.length, shown: view.slice(0, 240),
    perDay, ais: Object.entries(ais).sort((a, b) => b[1] - a[1]), counts: { image: count(["image"]), video: count(["video"]), other: count(["doc", "code", "site"]) },
    last24: (m.items || []).filter((x: any) => x.at >= now - DAY).length, roots: m.roots || [],
  };
}

/* ---------- clients ---------- */
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const same = (a: string, b: string) => { const k = (s: string) => String(s || "").toLowerCase().replace(/\b(co|inc|llc|ltd|studio|the)\b|[^a-z0-9]/g, ""); return !!k(a) && (k(a) === k(b) || (k(a).length > 4 && k(b).includes(k(a))) || (k(b).length > 4 && k(a).includes(k(b)))); };
function clientView(ws: any, c: any, money: any, ga: any, now: number) {
  const site = ga.sites.find((s: any) => s.id === c.links?.site) || ga.sites.find((s: any) => same(s.name, c.name)) || null;
  const q = queueFor(ws, "all", now), items = [...q.needsYou, ...q.team].filter((i: any) => i.scope === c.scope || same(i.scopeLabel || "", c.name));
  const late = items.filter((i: any) => i.due != null && i.due < now);
  const pays: any[] = (ws.money?.payments || []).filter((p: any) => same(p.customer || "", c.name)), owed = pays.filter((p) => p.status === "failed" && !p.recovered), paid = pays.filter((p) => p.status === "paid" && p.at >= now - 31 * DAY);
  const sym = money.sym || "$", owedSum = owed.reduce((a, p) => a + p.amount, 0), paidSum = paid.reduce((a, p) => a + p.amount, 0);
  const mail: any[] = (ws.inbox || []).filter((m: any) => m.scope === c.scope || same(m.from || "", c.name) || same(m.scopeLabel || "", c.name)).sort((a: any, b: any) => b.at - a.at), waiting = mail.filter((m) => m.needsReply);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0), v28 = site ? sum(site.v.slice(-28)) : 0, p28 = site ? sum(site.v.slice(-56, -28)) : 0, l28 = site ? sum(site.l.slice(-28)) : 0, up = site ? pctOf(v28, p28) : null;
  const need: string[] = [];
  if (owedSum) need.push(`${sym}${fmt(owedSum)} is unpaid`);
  if (late.length) need.push(`${plural(late.length, "task")} ${late.length > 1 ? "are" : "is"} overdue`);
  if (waiting.length) need.push(`${plural(waiting.length, "email")} ${waiting.length > 1 ? "wait" : "waits"} for a reply`);
  const facts: string[] = [];
  if (site && up != null) facts.push(`Visits are ${up >= 0 ? "up" : "down"} ${Math.abs(up)}% on the four weeks before.`);
  if (items.length) facts.push(`${plural(items.length, "task")} ${items.length > 1 ? "are" : "is"} open.`);
  if (!site && !items.length && !pays.length && !mail.length) facts.push("Nothing from your tools is linked to this client yet.");
  const msg = `${c.name} ${need.length ? "needs a look" : "is in good shape"}. ${facts.join(" ")} ${need.length ? word(need.length) + (need.length > 1 ? " things need you: " : " thing needs you: ") + need.join(need.length > 2 ? ", " : " and ") + "." : "Nothing needs you right now."}`.replace(/\s+/g, " ");
  const tasks = items.slice(0, 8).map((i: any) => { const [due, hot] = dueText(i.due, now); return [i.title, [i.owner, due].filter(Boolean).join(" · "), "", hot ? "Overdue" : i.waitingOn === "other" ? "With " + String(i.owner || "the team").split(" ")[0] : "Yours", hot ? "hot" : ""]; });
  const firstLink = items.flatMap((i: any) => i.sources || []).find((s: any) => /^https?:/.test(s.url || ""));
  return {
    id: c.id, n: c.name, m: initials(c.name), dom: site?.sub || c.sub || "", site: site?.id || null, need: need.length, msg,
    cards: [
      { k: "Performance", icon: "web", glow: "--ice", v: site ? (up == null ? fmt(v28) : (up > 0 ? "+" : "") + up + "%") : "No website", cls: up != null && up < 0 ? "down" : "", t: site ? `${fmt(v28)} visits and ${fmt(l28)} leads in the last 28 days.` : "Link this client's website in Google Analytics to see visits here.", btn: "See the numbers",
        d: { title: `How ${c.name}’s website is doing`, lede: site ? (up == null ? "There is no earlier period to compare with yet." : `Visits are ${up >= 0 ? "up" : "down"} ${Math.abs(up)}% on the four weeks before.`) : "No website in your Google Analytics account matches this client yet.", chart: site ? site.v.slice(-28) : null,
          rows: site ? [["Visitors", "Last 28 days", fmt(v28), up == null ? "" : (up > 0 ? "+" : "") + up + "%", up != null && up < 0 ? "hot" : "ok"], ["Leads", "Key events in Google Analytics", fmt(l28)], ...(site.pages[0] ? [["Top page", "Where most visits start", site.pages[0].path]] : [])] : [],
          src: site ? [["Google Analytics", "--ice", `${site.sub || site.name} · the last 56 days`, ga.when]] : [], acts: site ? [["Open Website", "#website"]] : [["Open Connections", "#connections"]] } },
      { k: "Work in progress", icon: "team", glow: "--violet", v: items.length ? items.length + " open" : "None open", cls: late.length ? "down" : "", t: items.length ? `${late.length ? late.length + " overdue" : "Nothing overdue"}. Next up: ${items[0].title}.` : "No open tasks are linked to this client.", btn: "See the work",
        d: { title: "Work in progress for " + c.name, lede: items.length ? `${plural(items.length, "task")} ${items.length > 1 ? "are" : "is"} open${late.length ? ` and ${late.length} ${late.length > 1 ? "are" : "is"} past the due date` : ", and none is late"}.` : "There are no open tasks for this client yet.", rows: tasks,
          src: items.length ? [["Linear", "--violet", `${plural(items.length, "open task")} that mention ${c.name}`, since(conn(ws, "linear")?.lastSync, now)]] : [], acts: firstLink ? [["Open in Linear", firstLink.url], ["Open Needs you", "#attention"]] : [["Open Needs you", "#attention"]] } },
      { k: "Invoices", icon: "money", glow: "--gold", v: money.state !== "ok" ? "Not connected" : owedSum ? `${sym}${fmt(owedSum)} unpaid` : paidSum ? "All paid" : "None yet", cls: owedSum ? "down" : "", t: money.state !== "ok" ? "Connect Stripe to see what this client paid and owes." : owedSum ? `${plural(owed.length, "payment")} failed. ${owed[0].reason || ""}`.trim() : paidSum ? `${sym}${fmt(paidSum)} came in over the last month. Nothing is waiting.` : "No payment from this client was found in Stripe.", btn: "See the invoices",
        d: { title: "Invoices for " + c.name, lede: money.state !== "ok" ? "Stripe is not connected yet." : owedSum ? `${sym}${fmt(owedSum)} is unpaid.` : paidSum ? "Every payment went through. Nothing is waiting." : "No payment from this client was found in Stripe.",
          rows: pays.slice(0, 8).map((p) => [p.desc || "Payment", (p.status === "failed" ? "Failed " : "Paid ") + new Date(p.at).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) + (p.status === "failed" && p.reason ? " · " + p.reason : ""), sym + fmt(p.amount), p.status === "failed" ? "Unpaid" : "Paid", p.status === "failed" ? "hot" : "ok"]),
          src: money.state === "ok" ? [["Stripe", "--gold", `Customer “${c.name}” · ${plural(pays.length, "payment")} in the last 60 days`, money.when]] : [], acts: money.state === "ok" ? [["Open Money", "#money"]] : [["Open Connections", "#connections"]] } },
      { k: "Important mail", icon: "news", glow: "--ember", v: waiting.length ? waiting.length + " waiting" : mail.length ? "All answered" : "None found", cls: waiting.length ? "down" : "", t: waiting.length ? `The oldest has waited since ${new Date(Math.min(...waiting.map((m) => m.at))).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.` : mail.length ? "Nobody is waiting for a reply from you." : "No unread mail from this client was found.", btn: "Read the mail",
        d: { title: "Important mail from " + c.name, lede: waiting.length ? "The ones still waiting for you come first." : "Nothing is waiting.", rows: [...waiting, ...mail.filter((m) => !m.needsReply)].slice(0, 6).map((m) => [m.from + " · " + m.subject, m.preview || "", "", m.needsReply ? "Waiting" : "Read", m.needsReply ? "hot" : "ok"]),
          src: mail.length ? [["Gmail", "--ember", `${plural(mail.length, "unread thread")} from this client`, since(conn(ws, "gmail")?.lastSync, now)]] : [], acts: mail[0]?.url ? [["Open in Gmail", mail[0].url]] : [["Open Inbox", "#inbox"]] } },
    ],
  };
}
/** Names that look like clients, from what the connected tools already hold: Stripe customers, Linear projects,
 *  the folders your AIs work in and the projects in your Second Brain. Only names are read. */
export function findClients(ws: any, extra: { tool: string; names: string[] }[] = []) {
  const m = new Map<string, { name: string; src: Map<string, number> }>();
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const pretty = (s: string) => s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const dull = /^(personal|private|templates?|tax(es)?|archive|old|misc|test|tests|tmp|temp|demo|examples?|docs?|notes|inbox|downloads?|desktop|documents|projects?|work|workos|src|app|website|site|dashboard|ai dashboard|untitled|new folder|scratch|playground|backup|admin|internal|general|team|home)( \d+)?$/i;
  const own = [ws.name, ws.owner, ws.setup?.about?.name, ws.setup?.about?.business, ...(ws.sites || []).map((s: any) => s.name)].filter(Boolean).map((s: string) => key(s));
  const add = (raw: string, t: string) => {
    const name = pretty(String(raw || "")); const k = key(name);
    if (k.length < 3 || name.length > 48 || dull.test(name) || own.includes(k) || /^\d+$/.test(k)) return;
    const e = m.get(k) || { name, src: new Map<string, number>() }; e.src.set(t, (e.src.get(t) || 0) + 1); m.set(k, e);
  };
  for (const c of ws.money?.customers || []) add(c.name, "Stripe");
  for (const p of ws.money?.payments || []) if (p.customer) add(p.customer, "Stripe");
  for (const i of ws.items || []) if (i.scopeLabel && String(i.id).startsWith("lin-")) add(i.scopeLabel, "Linear");
  for (const x of ws.made?.roots || []) add(x.name, x.ai);
  for (const e of extra) for (const n of e.names) add(n, e.tool);
  const unit: Record<string, [string, string]> = { Stripe: ["Customer", "Customer"], Linear: ["task", "tasks"] };
  return [...m.values()].map((e) => {
    const src = [...e.src].map(([t, n]) => [t, t === "Stripe" ? "Customer" : n + " " + ((unit[t] || ["project", "projects"])[n === 1 ? 0 : 1])]);
    const strong = e.src.has("Stripe") ? 2 : 0;
    return { name: e.name, src, score: strong + e.src.size, why: e.src.has("Stripe") ? "A paying customer in Stripe" + (e.src.size > 1 ? ", and the same name shows up in " + [...e.src.keys()].filter((t) => t !== "Stripe").join(" and ") + "." : ".") : "The name of " + [...e.src.keys()].map((t) => (t === "Linear" ? "a Linear project" : "a " + t + " project")).join(" and ") + "." };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 12);
}
function clientsView(ws: any, money: any, ga: any, now: number) {
  const on = (ws.clients || []).filter((c: any) => !c.sample || ws.sample), known = (n: string) => on.some((c: any) => same(c.name, n)) || (ws.sites || []).some((s: any) => same(s.name, n));
  const no: string[] = ws.found?.no || [];
  const found = (ws.found?.names || []).filter((f: any) => !known(f.name) && !no.some((x) => same(x, f.name))).map((f: any) => ({ n: f.name, m: initials(f.name), src: f.src || [], why: f.why || "" }));
  return { on: on.map((c: any) => clientView(ws, c, money, ga, now)), found, skipped: [...(ws.found?.skipped || []), ...no].slice(0, 12), scanned: since(ws.found?.when, now) };
}

/* ---------- the top of Overview and the daily brief ---------- */
function heroView(ws: any, ga: any, money: any, needs: any, made: any, now: number) {
  const parts: string[] = [];
  if (money.state === "ok" && money.delta != null) parts.push(money.delta >= 3 ? `Revenue is ahead of ${money.prevName}` : money.delta <= -3 ? `Revenue is behind ${money.prevName}` : `Revenue is level with ${money.prevName}`);
  parts.push(needs.today ? `${word(needs.today).toLowerCase()} thing${needs.today > 1 ? "s need" : " needs"} you today` : needs.total ? `nothing is due today` : `nothing needs you right now`);
  const lede = parts.map((p, i) => (i ? p : p[0].toUpperCase() + p.slice(1))).join(", and ") + ".";
  const sinceRows: any[] = [];
  if (money.state === "ok" && money.fresh.n) sinceRows.push({ v: "+" + money.sym + fmt(money.fresh.total), t: "came in through Stripe", cls: "up", card: { small: 1, icon: "money", glow: "--gold", ey: "<b>Since yesterday</b> &nbsp;·&nbsp; Stripe", title: "Money that came in", big: "+" + money.sym + fmt(money.fresh.total), bigCls: "up", bigNote: "from " + plural(money.fresh.n, "payment"), lede: "", rows: money.fresh.rows, src: [["Stripe", "--gold", plural(money.fresh.n, "payment") + " in the last 24 hours", money.when]], acts: [["Open Money", "#money"]] } });
  if (needs.done24) sinceRows.push({ v: plural(needs.done24, "thing"), t: "finished since yesterday", cls: "", card: null, href: "#attention" });
  if (made.last24) sinceRows.push({ v: plural(made.last24, "thing"), t: "saved by your AIs since yesterday", cls: "", card: null, href: "#made" });
  if (ga.state === "ok" && sinceRows.length < 3) { const y = ga.sites.reduce((a: number, s: any) => a + (s.v[s.v.length - 2] || 0), 0); sinceRows.push({ v: fmt(y), t: `visitor${y === 1 ? "" : "s"} yesterday`, cls: "", card: null, href: "#website" }); }
  if (needs.waiting && sinceRows.length < 3) sinceRows.push({ v: plural(needs.waiting, "thing"), t: "waiting on your team", cls: "", card: null, href: "#team" });
  const top = needs.rows[0];
  return { lede, since: sinceRows.slice(0, 3), first: top ? { t: top.t, id: top.id, tag: top.tag } : null };
}
function briefView(ws: any, ga: any, money: any, needs: any, news: any, now: number) {
  const spark = (vals: number[], col: string) => { const mx = Math.max(...vals, 1), P = vals.map((v, i) => `${((i / Math.max(1, vals.length - 1)) * 160).toFixed(1)} ${(36 - (v / mx) * 30).toFixed(1)}`).join(" L"); return `<svg viewBox="0 0 160 40" preserveAspectRatio="none"><path d="M${P}" fill="none" style="stroke:var(${col})" stroke-width="1.8" vector-effect="non-scaling-stroke"/><path d="M${P} V40 H0z" style="fill:rgba(var(--gold-rgb),.14)"/></svg>`; };
  const out: any[] = [];
  if (money.state === "ok") out.push({ k: "Money", s: "Stripe", v: money.sym + fmt(money.total), t: `Revenue in ${money.monthName} so far${money.delta == null ? "" : `, ${Math.abs(money.delta)}% ${money.delta >= 0 ? "ahead of" : "behind"} ${money.prevName}`}.`, icon: "money", glow: "--gold", href: "#money", act: "Open Money", viz: spark(money.months.map((m: any) => m[1]), "--gold"), card: "stripe" });
  else out.push({ k: "Money", s: "Stripe", v: "Not connected", t: "Connect Stripe to see revenue, payouts and failed payments here.", icon: "money", glow: "--gold", href: "#connections", act: "Connect Stripe", viz: "", off: 1 });
  if (money.state === "ok" && money.failed.length) out.push({ k: "Needs you", s: "Stripe", v: money.failed.length + " failed", t: `Payments worth ${money.sym}${fmt(money.failedTotal)} did not go through.`, icon: "needs", glow: "--bad", href: "#money", act: "See the payments", viz: `<div class="rowz">${money.failed.slice(0, 2).map((f: any) => `<div><span>${esc(f.who)}</span><span>${money.sym}${fmt(f.amount)}</span></div>`).join("")}</div>`, card: "failed" });
  else if (needs.rows.length) out.push({ k: "Needs you", s: needs.rows[0].sub.split(" · ")[0], v: plural(needs.total, "thing"), t: needs.rows[0].t + ".", icon: "needs", glow: "--bad", href: "#attention", act: "Open Needs you", viz: `<div class="rowz">${needs.rows.slice(0, 2).map((r: any) => `<div><span>${esc(r.t)}</span><span>${esc(r.tag)}</span></div>`).join("")}</div>`, card: "n0" });
  else out.push({ k: "Needs you", s: "Your tools", v: "All clear", t: "Nothing is waiting on you right now.", icon: "needs", glow: "--mint", href: "#attention", act: "Open Needs you", viz: "" });
  const q = queueFor(ws, "all", now), team = q.team.length, linear = conn(ws, "linear")?.status === "connected";
  if (team) out.push({ k: "Team", s: linear ? "Linear" : "Your team", v: plural(team, "task"), t: `With your team right now. Next: ${q.team[0].title}.`, icon: "team", glow: "--mint", href: "#team", act: "Open Your team", viz: `<div class="pips">${"<i class=\"d\"></i>".repeat(Math.min(9, needs.done24))}${"<i></i>".repeat(Math.min(9, team))}</div>` });
  else out.push({ k: "Team", s: "Linear", v: linear ? "Nothing open" : "Not connected", t: linear ? "Nobody on your team has an open task from you." : "Connect Linear to see what your team is working on.", icon: "team", glow: "--mint", href: linear ? "#team" : "#connections", act: linear ? "Open Your team" : "Connect Linear", viz: "", off: linear ? 0 : 1 });
  if (ga.state === "ok") {
    const best = ga.sites.map((s: any) => { const a = s.v.slice(-7).reduce((x: number, y: number) => x + y, 0), b = s.v.slice(-14, -7).reduce((x: number, y: number) => x + y, 0); return { s, a, p: pctOf(a, b) }; }).sort((x: any, y: any) => (y.p ?? -999) - (x.p ?? -999))[0];
    const last = best.s.v.slice(-7), mx = Math.max(...last, 1);
    out.push({ k: "Growth", s: "Analytics", v: best.p == null ? fmt(best.a) : (best.p > 0 ? "+" : "") + best.p + "%", t: `${best.s.name} visits in the last 7 days${best.p == null ? "" : ", against the week before"}.`, icon: "web", glow: "--ice", href: "#website", act: "Open Website", viz: last.map((x: number, i: number) => `<i class="bar${i === 6 ? " hi" : ""}" style="height:${Math.max(6, (x / mx) * 100)}%"></i>`).join(""), card: "growth", site: best.s.id });
  } else out.push({ k: "Growth", s: "Analytics", v: "Not connected", t: "Connect Google Analytics to see how your websites are doing.", icon: "web", glow: "--ice", href: "#connections", act: "Connect Google Analytics", viz: "", off: 1 });
  const story = news.stories[0];
  if (story) out.push({ k: "AI news", s: story.name, v: plural(news.stories.length, "story", "stories"), t: story.head, icon: "spark", glow: "--violet", href: "#news", act: "Read the story", viz: "<i class=\"fr\"></i>".repeat(5), card: "nw0" });
  else out.push({ k: "AI news", s: "Your topics", v: "Not read yet", t: "Open AI news to read today's stories on your topics.", icon: "spark", glow: "--violet", href: "#news", act: "Open AI news", viz: "", off: 1 });
  const words = out.reduce((a, b) => a + (b.k + " " + b.v + " " + b.t).split(/\s+/).length, 0);
  return { squares: out, seconds: Math.max(10, Math.round(words / 2.7)), real: out.filter((b) => !b.off).length };
}

/** One bundle for the Obsidian screens. `extra` carries what only the laptop knows, such as which AI is linked. */
export function uiBundle(ws: any, now: number, extra: { ai?: { id: string; name: string } | null } = {}) {
  const ga = gaView(ws, now), money = moneyView(ws, now), needs = needsView(ws, now), news = newsView(ws, now), made = madeView(ws, now);
  const owner = String(ws.setup?.about?.name || ws.owner || "").trim();
  return {
    now, me: { name: owner, first: owner.split(/\s+/)[0] || "", biz: ws.name }, ai: extra.ai || null,
    ga, money, needs, news, made, goals: goalsView(ws, now), clients: clientsView(ws, money, ga, now),
    hero: heroView(ws, ga, money, needs, made, now), brief: briefView(ws, ga, money, needs, news, now),
  };
}

// Social numbers from a file, for people whose Metricool plan has no API.
// The owner, or their AI, saves a Metricool export (CSV, Excel, JSON or PDF) and the dashboard reads followers and reach from it.
// This part is pure: it turns a table, a JSON document or plain text into the same shape the Metricool connection produces.
import { DAY } from "./rand.ts";

export type FileNetwork = { id: string; name: string; followers: number; followersDelta: number; reach: number; reachPrev: number; series: { t: number; v: number }[] };
export type SocialFile = { file: string; at: number; rows: number; from: number | null; to: number | null; brands: Record<string, FileNetwork[]> };

const NETS: [string, string, RegExp][] = [
  ["instagram", "Instagram", /\b(instagram|insta|ig)\b/], ["facebook", "Facebook", /\b(facebook|fb|meta)\b/], ["tiktok", "TikTok", /\b(tiktok|tik tok)\b/],
  ["youtube", "YouTube", /\b(youtube|yt)\b/], ["linkedin", "LinkedIn", /\b(linkedin|linked in)\b/], ["x", "X", /\b(x|twitter|x twitter|twitter x)\b/],
  ["threads", "Threads", /\bthreads\b/], ["pinterest", "Pinterest", /\bpinterest\b/], ["bluesky", "Bluesky", /\bbluesky\b/], ["twitch", "Twitch", /\btwitch\b/],
  ["google", "Google Business", /\b(google business|google my business|gmb|gbp)\b/],
];
const plain = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[_\-./()|:]+/g, " ").replace(/\s+/g, " ").trim();
export function networkOf(v: unknown): { id: string; name: string } | null {
  const s = plain(v);
  if (!s) return null;
  for (const [id, name, re] of NETS) if (re.test(s)) return { id, name };
  return null;
}

/** "12,345", "12.345", "1,2 K", "3.4M" or 1200 as a number. Percentages and words are not numbers here. */
export function numberOf(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim().replace(/[\s ]/g, "");
  if (!s || /%$/.test(s)) return null;
  const m = /^([+-]?[\d.,]+)([kmb]|mil|mill)?$/i.exec(s);
  if (!m || !/\d/.test(m[1])) return null;
  s = m[1];
  const dot = s.lastIndexOf("."), comma = s.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) s = dot > comma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  else if (dot >= 0 || comma >= 0) {
    const sep = dot >= 0 ? "." : ",", parts = s.split(sep);
    const thousands = parts.length > 2 || (parts[1].length === 3 && !m[2] && parts[0].replace(/[+-]/, "").length <= 3 && parts[0].replace(/[+-]/, "") !== "0");
    s = thousands ? parts.join("") : parts.join(".");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const unit = (m[2] || "").toLowerCase();
  return n * (unit === "k" || unit === "mil" ? 1e3 : unit === "m" || unit === "mill" ? 1e6 : unit === "b" ? 1e9 : 1);
}

/** A day from a cell. `dayFirst` settles 03/04/2026. Excel stores days as a count from 1900. */
export function dayOf(v: unknown, dayFirst = false): number | null {
  if (v instanceof Date) return Number.isFinite(+v) ? +v : null;
  if (typeof v === "number") return v > 20000 && v < 80000 ? Math.round((v - 25569) * DAY) : v > 1e11 ? v : null;
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) return dayOf(Number(s));
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) {
    let a = +m[1], b = +m[2]; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    if (a > 12 || (dayFirst && b <= 12)) [a, b] = [b, a];
    return b >= 1 && b <= 31 && a >= 1 && a <= 12 ? Date.UTC(y, a - 1, b) : null;
  }
  if (!/[a-z]{3}/i.test(s) || !/\d/.test(s)) return null;
  const t = Date.parse(s + (/(z|utc|gmt|[+-]\d\d:?\d\d)$/i.test(s) ? "" : " UTC"));
  return Number.isFinite(t) ? Math.floor(t / DAY) * DAY : null;
}

type Kind = "date" | "network" | "brand" | "followers" | "newFollowers" | "reach" | "reachPrev" | "impressions";
function kindOf(header: string): Kind | null {
  const h = plain(header);
  if (!h) return null;
  if (/^(date|day|fecha|dia|datetime|week|period|periodo|time)\b/.test(h)) return "date";
  if (/^(network|platform|channel|social network|social|red|red social|source)$/.test(h)) return "network";
  if (/^(brand|profile|account|website|site|marca|page|client)( name)?$/.test(h)) return "brand";
  if (/(new|gained|net) (followers|subscribers|fans)|followers? (growth|change|gained)|nuevos seguidores/.test(h)) return "newFollowers";
  if (/followers?|seguidores|subscribers|suscriptores|community|comunidad|fans|page likes/.test(h)) return "followers";
  if (/(previous|prev|last period|anterior).*(reach|alcance)|(reach|alcance).*(previous|prev|anterior)/.test(h)) return "reachPrev";
  if (/reach|alcance/.test(h)) return "reach";
  if (/impressions?|impresiones|views|visualizaciones|reproducciones/.test(h)) return "impressions";
  return null;
}

type Bucket = { name: string; dated: Map<number, { followers?: number; reach?: number; impressions?: number; newFollowers?: number }>; flat: { followers?: number; reach?: number; reachPrev?: number; impressions?: number; newFollowers?: number } };

/** Reads one table (a header row, then rows). The file name helps when the table does not say which network it is. */
function readTable(rows: unknown[][], hint: string, into: Map<string, Bucket>) {
  let head = -1, cols: { i: number; kind: Kind; net: { id: string; name: string } | null }[] = [];
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const found = (rows[r] || []).map((c, i) => ({ i, kind: kindOf(String(c ?? "")), net: networkOf(c) })).filter((c) => c.kind) as typeof cols;
    if (found.length >= 2 || (found.length === 1 && found[0].kind !== "date" && (rows[r] || []).length <= 3 && rows.length > r + 1)) { head = r; cols = found; break; }
  }
  if (head < 0) return 0;
  const dateCol = cols.find((c) => c.kind === "date"), netCol = cols.find((c) => c.kind === "network"), brandCol = cols.find((c) => c.kind === "brand");
  const metrics = cols.filter((c) => !["date", "network", "brand"].includes(c.kind));
  if (!metrics.length) return 0;
  const body = rows.slice(head + 1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
  // 03/04/2026 is settled by the rest of the column: any day above 12 says which way round the file writes dates.
  const dates = dateCol ? body.map((r) => String(r[dateCol.i] ?? "")) : [];
  const dayFirst = dates.some((d) => { const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/.exec(d.trim()); return !!m && +m[1] > 12; });
  const fromName = networkOf(hint);
  let used = 0;
  for (const row of body) {
    const t = dateCol ? dayOf(row[dateCol.i], dayFirst) : null;
    const brand = brandCol ? String(row[brandCol.i] ?? "").trim() : "";
    const rowNet = netCol ? networkOf(row[netCol.i]) || (String(row[netCol.i] ?? "").trim() ? { id: plain(row[netCol.i]).replace(/ /g, "-").slice(0, 30), name: String(row[netCol.i]).trim().slice(0, 30) } : null) : null;
    if (netCol && !rowNet) continue;
    let took = false;
    for (const c of metrics) {
      const v = numberOf(row[c.i]);
      if (v == null || (v < 0 && c.kind !== "newFollowers")) continue;
      const net = rowNet || c.net || fromName || { id: "all", name: "All networks" };
      const key = brand.toLowerCase() + "\u0000" + net.id;
      let b = into.get(key);
      if (!b) into.set(key, (b = { name: net.name, dated: new Map(), flat: {} }));
      if (t != null && c.kind !== "reachPrev") { const p = b.dated.get(t) || {}; (p as any)[c.kind] = ((c.kind === "followers" ? 0 : (p as any)[c.kind]) || 0) + v; b.dated.set(t, p); }
      else (b.flat as any)[c.kind] = c.kind === "followers" ? v : ((b.flat as any)[c.kind] || 0) + v;
      (b as any).brand = brand; took = true;
    }
    if (took) used++;
  }
  return used;
}

function finish(into: Map<string, Bucket>) {
  const brands: Record<string, FileNetwork[]> = {};
  let from: number | null = null, to: number | null = null;
  for (const [key, b] of into) {
    const id = key.split("\u0000")[1], brand = String((b as any).brand || "");
    const days = [...b.dated.entries()].sort((x, y) => x[0] - y[0]);
    let n: FileNetwork;
    if (days.length) {
      const last = days[days.length - 1][0];
      from = from == null ? days[0][0] : Math.min(from, days[0][0]); to = to == null ? last : Math.max(to, last);
      const useReach = days.some(([, p]) => p.reach != null);
      const val = (p: any) => Number((useReach ? p.reach : p.impressions) || 0);
      const cur = days.filter(([t]) => t > last - 7 * DAY), prev = days.filter(([t]) => t <= last - 7 * DAY && t > last - 14 * DAY);
      const fol = days.filter(([, p]) => p.followers != null);
      const latest = fol.length ? fol[fol.length - 1][1].followers! : b.flat.followers ?? 0;
      const base = fol.filter(([t]) => t > last - 8 * DAY)[0] || fol[0];
      const gained = days.filter(([t]) => t > last - 7 * DAY).reduce((a, [, p]) => a + (p.newFollowers || 0), 0);
      n = { id, name: b.name, followers: Math.round(latest), followersDelta: Math.round(fol.length > 1 ? latest - base[1].followers! : gained || b.flat.newFollowers || 0), reach: Math.round(cur.reduce((a, [, p]) => a + val(p), 0)), reachPrev: Math.round(prev.reduce((a, [, p]) => a + val(p), 0) || b.flat.reachPrev || 0), series: cur.map(([t, p]) => ({ t, v: Math.round(val(p)) })) };
    } else {
      n = { id, name: b.name, followers: Math.round(b.flat.followers || 0), followersDelta: Math.round(b.flat.newFollowers || 0), reach: Math.round(b.flat.reach ?? b.flat.impressions ?? 0), reachPrev: Math.round(b.flat.reachPrev || 0), series: [] };
    }
    if (n.followers || n.reach || n.series.length) (brands[brand] ||= []).push(n);
  }
  for (const list of Object.values(brands)) list.sort((a, b) => b.reach - a.reach || b.followers - a.followers);
  return { brands, from, to };
}

/** Splits CSV or tab-separated text into rows. Quotes, commas inside quotes and semicolons (European exports) are handled. */
export function tableOf(text: string): string[][] {
  const t = text.replace(/^﻿/, ""), first = t.split(/\r?\n/).slice(0, 8).join("\n");
  const count = (ch: string) => first.split(ch).length - 1;
  const sep = count("\t") > count(",") && count("\t") > count(";") ? "\t" : count(";") > count(",") ? ";" : ",";
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch; continue; }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Plain text, such as the words of a PDF report: a network's name, then "Followers 12,345" or "12,345 followers" near it. */
export function tableFromText(text: string): unknown[][] {
  const out = new Map<string, any>(); let cur: { id: string; name: string } | null = null;
  const WORD: [Kind, RegExp][] = [["newFollowers", /new followers|followers gained|nuevos seguidores/i], ["followers", /followers|seguidores|subscribers|fans|community/i], ["reach", /reach|alcance/i], ["impressions", /impressions|impresiones|views/i]];
  const NUM = "([+-]?\\d[\\d.,]*\\s?(?:[kmKM]\\b)?)";
  for (const line of text.split(/\r?\n|\s{3,}/)) {
    const net = networkOf(line.replace(/[^a-zA-Z ]+/g, " ").split(" ").slice(0, 4).join(" "));
    if (net && line.trim().length < 60) cur = net;
    if (!cur) continue;
    for (const [kind, re] of WORD) {
      const w = re.exec(line); if (!w) continue;
      const after = new RegExp("^[\\s:=]*" + NUM).exec(line.slice(w.index + w[0].length)), before = new RegExp(NUM + "\\s*$").exec(line.slice(0, w.index));
      const v = numberOf((after || before)?.[1]);
      if (v == null) continue;
      const r = out.get(cur.id) || { name: cur.name }; if (r[kind] == null) r[kind] = v; out.set(cur.id, r);
      break;
    }
  }
  return [["Network", "Followers", "New followers", "Reach", "Impressions"], ...[...out.values()].map((r) => [r.name, r.followers ?? "", r.newFollowers ?? "", r.reach ?? "", r.impressions ?? ""])];
}

const NOTHING = "No followers or reach numbers were found in this file. It needs a column for followers or reach, and ideally one for the network and one for the date.";

/** Tables (one per sheet) into the social numbers. Throws in plain words when there is nothing to show. */
export function socialFromTables(tables: unknown[][][], file: string, at: number): SocialFile {
  const into = new Map<string, Bucket>(); let rows = 0;
  for (const t of tables) rows += readTable(t, file, into);
  const { brands, from, to } = finish(into);
  if (!Object.keys(brands).length) throw new Error(NOTHING);
  return { file, at, rows, from, to, brands };
}

/** JSON written by an AI. Either the ready shape, { networks: [{ network, followers, reach, ... }] } with optional brands, or a plain list of rows. */
export function socialFromJson(data: any, file: string, at: number): SocialFile {
  const list = (x: any): any[] | null => (Array.isArray(x) ? x : null);
  const asNet = (n: any): FileNetwork | null => {
    const net = networkOf(n.network ?? n.id ?? n.name ?? n.platform) || (n.name || n.network ? { id: plain(n.name || n.network).replace(/ /g, "-").slice(0, 30), name: String(n.name || n.network).slice(0, 30) } : null);
    if (!net) return null;
    const series = (list(n.series) || list(n.daily) || []).map((p: any) => ({ t: dayOf(p.t ?? p.date ?? p.day) ?? 0, v: numberOf(p.v ?? p.reach ?? p.value) ?? 0 })).filter((p) => p.t).sort((a, b) => a.t - b.t);
    const last = series.length ? series[series.length - 1].t : 0, cur = series.filter((p) => p.t > last - 7 * DAY), prev = series.filter((p) => p.t <= last - 7 * DAY);
    return { ...net, followers: Math.round(numberOf(n.followers) ?? 0), followersDelta: Math.round(numberOf(n.followersDelta ?? n.newFollowers ?? n.followersChange) ?? 0), reach: Math.round(numberOf(n.reach ?? n.impressions) ?? cur.reduce((a, p) => a + p.v, 0)), reachPrev: Math.round(numberOf(n.reachPrev ?? n.previousReach) ?? prev.reduce((a, p) => a + p.v, 0)), series: cur };
  };
  const brands: Record<string, FileNetwork[]> = {};
  if (data && !Array.isArray(data) && (list(data.networks) || list(data.brands))) {
    for (const b of [{ name: "", networks: data.networks }, ...(list(data.brands) || [])]) {
      const nets = (list(b?.networks) || []).map(asNet).filter(Boolean) as FileNetwork[];
      if (nets.length) brands[String(b.name ?? b.brand ?? b.website ?? "")] = nets;
    }
    if (!Object.keys(brands).length) throw new Error(NOTHING);
    const days = Object.values(brands).flat().flatMap((n) => n.series.map((p) => p.t));
    return { file, at, rows: Object.values(brands).flat().length, from: days.length ? Math.min(...days) : null, to: days.length ? Math.max(...days) : null, brands };
  }
  const rows = list(data) || list(data?.rows) || list(data?.data);
  if (!rows || !rows.length || typeof rows[0] !== "object") throw new Error(NOTHING);
  const keys = [...new Set(rows.flatMap((r: any) => Object.keys(r || {})))];
  return socialFromTables([[keys, ...rows.map((r: any) => keys.map((k) => r?.[k]))]], file, at);
}

const norm = (s: unknown) => String(s || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[^a-z0-9]/g, "");
/** The numbers for one website, or for everything when no website is given. A file that names no brands belongs to every website. */
export function networksFor(f: SocialFile | null | undefined, site?: { name?: string; domain?: string } | null): FileNetwork[] | null {
  if (!f?.brands) return null;
  const names = Object.keys(f.brands);
  if (site && names.some((n) => n)) {
    const hit = names.find((n) => n && (norm(n) === norm(site.name) || (norm(site.domain) && norm(n).includes(norm(site.domain).replace(/(com|io|co|app|net|org)$/, ""))) || norm(n).includes(norm(site.name)) || norm(site.name).includes(norm(n))));
    return hit ? f.brands[hit] : names.length === 1 ? f.brands[names[0]] : null;
  }
  const all = new Map<string, FileNetwork>();
  for (const list of Object.values(f.brands)) for (const n of list) {
    const x = all.get(n.id);
    if (!x) { all.set(n.id, { ...n, series: n.series.map((p) => ({ ...p })) }); continue; }
    x.followers += n.followers; x.followersDelta += n.followersDelta; x.reach += n.reach; x.reachPrev += n.reachPrev;
    const byDay = new Map(x.series.map((p) => [p.t, p.v])); for (const p of n.series) byDay.set(p.t, (byDay.get(p.t) || 0) + p.v);
    x.series = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v }));
  }
  return [...all.values()].sort((a, b) => b.reach - a.reach || b.followers - a.followers);
}

/** What to tell an AI that is asked to bring Metricool numbers in. */
export const FILE_HELP = {
  formats: ["csv", "xlsx", "json", "pdf"],
  simplest: "A CSV with the columns: date, network, followers, reach. One row per network per day, for at least the last 14 days. Add a brand column when there is more than one website.",
  json: { networks: [{ network: "instagram", followers: 12840, followersDelta: 96, reach: 48210, reachPrev: 45100, series: [{ date: "2026-11-22", reach: 7020 }] }] },
  note: "Save the newest export into the folder. The dashboard shows the newest file and keeps nothing else.",
};

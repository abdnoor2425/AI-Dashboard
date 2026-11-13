// Metricool: followers and reach for each brand. Needs the Advanced or Custom plan, which is where Metricool allows API access.
// NOTE: the brand list call follows Metricool's published API. The analytics calls are a best reading of the same docs and
// have NOT been run against a live account yet, so a network that does not answer is left out rather than guessed.
import { getSecrets } from "./store.ts";
import { DAY } from "../rand.ts";

const BASE = "https://app.metricool.com/api";
const NETS: [string, string, string][] = [["instagram", "Instagram", "instagram"], ["facebook", "Facebook", "facebook"], ["tiktok", "TikTok", "tiktok"], ["youtube", "YouTube", "youtube"], ["linkedin", "LinkedIn", "linkedinCompany"], ["x", "X", "twitter"]];

async function mc(wsId: string, pathAndQuery: string) {
  const s = getSecrets(wsId).metricool;
  if (!s?.token || !s?.userId) throw new Error("Metricool needs both a user ID and a token.");
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const r = await fetch(`${BASE}${pathAndQuery}${sep}userId=${encodeURIComponent(s.userId)}`, { headers: { "X-Mc-Auth": s.token, accept: "application/json" } });
  if (r.status === 401 || r.status === 403) throw new Error("Metricool refused the token. Check it, and that the plan is Advanced or Custom.");
  if (!r.ok) throw new Error(`Metricool answered ${r.status}.`);
  return r.json();
}

export async function metricoolBrands(wsId: string) {
  const list: any = await mc(wsId, "/admin/simpleProfiles");
  return (Array.isArray(list) ? list : list?.data || []).map((b: any) => ({ id: String(b.id), name: b.label || b.title || b.url || "Brand " + b.id, url: b.url || "", raw: b }));
}

const ymd = (t: number) => new Date(t).toISOString().slice(0, 10) + "T00:00:00";

async function timeline(wsId: string, blogId: string, network: string, metric: string, from: number, to: number) {
  const q = new URLSearchParams({ blogId, from: ymd(from), to: ymd(to), metric, network, timezone: "UTC" });
  const j: any = await mc(wsId, "/v2/analytics/timelines?" + q);
  const values = j?.data?.[0]?.values || j?.data || [];
  return (Array.isArray(values) ? values : []).map((v: any) => ({ t: Date.parse(v.dateTime || v.date || v[0]) || 0, v: Number(v.value ?? v[1]) || 0 })).filter((p: any) => p.t).sort((a: any, b: any) => a.t - b.t);
}

/** Reach and followers for one confirmed brand. Returns only the networks that actually answered. */
export async function syncBrand(wsId: string, brand: { id: string; raw?: any }, now: number) {
  const networks: any[] = [];
  for (const [id, name, key] of NETS) {
    if (brand.raw && !brand.raw[key] && !brand.raw[id]) continue; // this brand has no such profile
    try {
      const [reach, followers] = await Promise.all([timeline(wsId, brand.id, id, "reach", now - 14 * DAY, now), timeline(wsId, brand.id, id, "followers", now - 8 * DAY, now)]);
      if (!reach.length && !followers.length) continue;
      const cur = reach.filter((p: any) => p.t >= now - 7 * DAY), prev = reach.filter((p: any) => p.t < now - 7 * DAY);
      const last = followers[followers.length - 1]?.v ?? null, first = followers[0]?.v ?? null;
      networks.push({ id, name, followers: last, followersDelta: last != null && first != null ? last - first : null, reach: cur.reduce((a: number, p: any) => a + p.v, 0), reachPrev: prev.reduce((a: number, p: any) => a + p.v, 0), series: cur });
    } catch { /* leave this network out: unknown is better than a made-up number */ }
  }
  return { networks, at: now };
}

/** Suggest a brand for each website by comparing names and web addresses. A person still has to confirm each match. */
export function matchBrands(sites: any[], brands: any[]) {
  const norm = (s: string) => String(s || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[^a-z0-9]/g, "");
  for (const s of sites) {
    if (s.metricoolBrand?.confirmed) continue;
    const hit = brands.find((b) => norm(b.url) && norm(b.url).startsWith(norm(s.domain))) || brands.find((b) => norm(b.name) === norm(s.name)) || brands.find((b) => norm(b.name).includes(norm(s.name)) || norm(s.name).includes(norm(b.name)));
    s.metricoolBrand = hit ? { id: hit.id, name: hit.name, matched: true, confirmed: false, raw: hit.raw } : { id: "", name: "", matched: false, confirmed: false };
  }
}

// Google: one read-only sign-in covers Analytics, Calendar, Gmail and Drive.
// Each person uses their own Google Cloud OAuth client, so no shared key ships with the app.
// NOTE: written against Google's public REST docs and not yet run against a live account.
import crypto from "node:crypto";
import { getSecrets, setSecrets } from "./store.ts";
import { DAY, hash } from "../rand.ts";

export const GOOGLE_TOOLS = ["google-analytics", "calendar", "gmail", "drive"];
const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "openid", "email",
];
export const redirectUri = (origin: string) => `${origin}/api/oauth/google/callback`;

export function googleAuthUrl(wsId: string, origin: string) {
  const s = getSecrets(wsId).google || {};
  if (!s.clientId || !s.clientSecret) return null;
  const state = crypto.randomBytes(16).toString("hex");
  setSecrets(wsId, { google: { ...s, state } });
  const p = new URLSearchParams({ client_id: s.clientId, redirect_uri: redirectUri(origin), response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", state: `${wsId}.${state}` });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + p;
}

async function tokenCall(params: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || "Google did not accept the sign-in.");
  return j;
}

export async function finishGoogle(stateParam: string, code: string, origin: string) {
  const [wsId, state] = String(stateParam).split(".");
  const s = getSecrets(wsId).google || {};
  if (!s.state || s.state !== state) throw new Error("This sign-in link has expired. Start again from Connections.");
  const t = await tokenCall({ code, client_id: s.clientId, client_secret: s.clientSecret, redirect_uri: redirectUri(origin), grant_type: "authorization_code" });
  let email = "";
  try { email = JSON.parse(Buffer.from(String(t.id_token).split(".")[1], "base64url").toString()).email || ""; } catch {}
  setSecrets(wsId, { google: { clientId: s.clientId, clientSecret: s.clientSecret, refreshToken: t.refresh_token || s.refreshToken, accessToken: t.access_token, expiry: Date.now() + (t.expires_in - 60) * 1000, email } });
  return { wsId, email };
}

async function accessToken(wsId: string) {
  const s = getSecrets(wsId).google;
  if (!s?.refreshToken) throw new Error("Google is not signed in.");
  if (s.accessToken && s.expiry > Date.now()) return s.accessToken;
  const t = await tokenCall({ client_id: s.clientId, client_secret: s.clientSecret, refresh_token: s.refreshToken, grant_type: "refresh_token" });
  setSecrets(wsId, { google: { ...s, accessToken: t.access_token, expiry: Date.now() + (t.expires_in - 60) * 1000 } });
  return t.access_token;
}

async function g(wsId: string, url: string, body?: any) {
  const r = await fetch(url, { method: body ? "POST" : "GET", headers: { authorization: "Bearer " + (await accessToken(wsId)), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `Google answered ${r.status}.`);
  return j;
}

const PALETTE = ["#0A6CFF", "#1F8F4E", "#D9630B", "#5450E0", "#0E8A8F", "#D6336C", "#B8892B", "#4A4F5A"];
const rows = (rep: any) => (rep.rows || []).map((r: any) => ({ d: r.dimensionValues.map((x: any) => x.value), m: r.metricValues.map((x: any) => Number(x.value) || 0) }));

/** The website list and its numbers, straight from Google Analytics. Websites are never typed in by hand. */
export async function syncAnalytics(wsId: string, existing: any[]) {
  const sum = await g(wsId, "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200");
  const props = (sum.accountSummaries || []).flatMap((a: any) => a.propertySummaries || []).slice(0, 25);
  const sites: any[] = [];
  for (const [i, p] of props.entries()) {
    const id = "ga-" + String(p.property).split("/")[1];
    const old = existing.find((s) => s.id === id) || {};
    const run = (b: any) => g(wsId, `https://analyticsdata.googleapis.com/v1beta/${p.property}:runReport`, b);
    try {
      const [daily, src, pages, streams] = await Promise.all([
        run({ dateRanges: [{ startDate: "180daysAgo", endDate: "today" }], dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }, { name: "keyEvents" }], limit: 400 }),
        run({ dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "activeUsers" }], limit: 12 }),
        run({ dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], dimensions: [{ name: "pagePath" }], metrics: [{ name: "activeUsers" }], orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 5 }),
        g(wsId, `https://analyticsadmin.googleapis.com/v1beta/${p.property}/dataStreams`).catch(() => ({})),
      ]);
      const uri = (streams.dataStreams || []).map((s: any) => s.webStreamData?.defaultUri).find(Boolean) || "";
      sites.push({
        id, name: p.displayName, domain: uri.replace(/^https?:\/\//, "").replace(/\/$/, "") || p.displayName, kind: "Website", color: old.color || PALETTE[(i + (hash(id) % 3)) % PALETTE.length],
        gaProperty: p.property, networks: old.networks || [], metricoolBrand: old.metricoolBrand || { id: "", name: "", matched: false, confirmed: false },
        live: {
          ...(old.live || {}),
          daily: rows(daily).map((r: any) => ({ t: Date.UTC(+r.d[0].slice(0, 4), +r.d[0].slice(4, 6) - 1, +r.d[0].slice(6, 8)) + DAY / 2, visitors: r.m[0], leads: r.m[1] })),
          sources: rows(src).map((r: any) => ({ name: r.d[0], visitors: r.m[0] })),
          pages: rows(pages).map((r: any) => ({ path: r.d[0], visitors: r.m[0] })),
        },
      });
    } catch (e) { if (old.id) sites.push(old); /* keep the last good numbers rather than drop the website */ }
  }
  return sites;
}

export async function syncCalendar(wsId: string, now: number) {
  const p = new URLSearchParams({ timeMin: new Date(now - DAY).toISOString(), timeMax: new Date(now + 8 * DAY).toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "60" });
  const j = await g(wsId, "https://www.googleapis.com/calendar/v3/calendars/primary/events?" + p);
  return (j.items || []).filter((e: any) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date)).map((e: any) => ({
    id: "gcal-" + e.id, title: e.summary || "Busy", start: Date.parse(e.start.dateTime || e.start.date + "T09:00:00"), end: Date.parse(e.end?.dateTime || e.end?.date || e.start.dateTime || e.start.date),
    with: (e.attendees || []).filter((a: any) => !a.self).slice(0, 3).map((a: any) => a.displayName || a.email).join(", "), scope: null, kind: /deadline|due/i.test(e.summary || "") ? "deadline" : "meeting", url: e.htmlLink,
  }));
}

/** Unread inbox mail: sender, subject and time only. The body is never read (the sign-in does not allow it). */
export async function syncGmail(wsId: string) {
  const list = await g(wsId, "https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&labelIds=UNREAD&maxResults=15");
  const out: any[] = [];
  for (const m of list.messages || []) {
    const d = await g(wsId, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`);
    const h = (n: string) => (d.payload?.headers || []).find((x: any) => x.name.toLowerCase() === n)?.value || "";
    out.push({ id: "gm-" + m.id, tool: "gmail", from: h("from").replace(/<.*>/, "").replace(/"/g, "").trim() || h("from"), subject: h("subject") || "(no subject)", preview: "", at: Number(d.internalDate) || Date.now(), needsReply: (d.labelIds || []).includes("IMPORTANT"), scope: null, scopeLabel: "", url: `https://mail.google.com/mail/u/0/#inbox/${d.threadId}` });
  }
  return out;
}

export async function syncDrive(wsId: string) {
  const p = new URLSearchParams({ orderBy: "modifiedTime desc", pageSize: "20", fields: "files(id,name,mimeType,modifiedTime,webViewLink,owners(displayName))", q: "trashed = false" });
  const j = await g(wsId, "https://www.googleapis.com/drive/v3/files?" + p);
  const type = (m: string) => (/spreadsheet/.test(m) ? "sheet" : /folder/.test(m) ? "folder" : /video/.test(m) ? "video" : "doc");
  return (j.files || []).map((f: any) => ({ id: "gd-" + f.id, name: f.name, type: type(f.mimeType || ""), modified: Date.parse(f.modifiedTime), owner: f.owners?.[0]?.displayName || "", scope: null, scopeLabel: "", url: f.webViewLink || "#" }));
}

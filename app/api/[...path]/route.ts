// One door for every request: /api/<page>. The shared router in lib/api.ts answers almost everything.
// This file adds the parts that only make sense on the laptop: saving to disk, real sign-ins, syncing and the AI link.
import { NextRequest, NextResponse } from "next/server";
import { handle, activeWs } from "@/lib/api";
import { dropSecrets, getSecrets, loadState, saveState, setSecrets } from "@/lib/server/store";
import { GOOGLE_TOOLS, finishGoogle, googleAuthUrl, redirectUri } from "@/lib/server/google";
import { isSyncing, markGoogle, syncWorkspace } from "@/lib/server/sync";
import * as ai from "@/lib/server/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const json = (data: any, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** This server is for the person at this laptop only. Refuse anything that arrives under another name or from another site. */
function guard(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (!LOCAL.test(host)) return "This dashboard only answers on localhost.";
  const origin = req.headers.get("origin");
  if (req.method !== "GET" && origin && origin !== `http://${host}`) return "Requests from other sites are not allowed.";
  return null;
}

function logUsage(ws: any, task: string, provider: string, now: number) {
  ws.usage.entries.unshift({ id: "u-" + now.toString(36), task: task.slice(0, 80), scopeLabel: ws.name, provider, kind: "plan", tokens: null, cost: 0, estimated: false, at: now });
  ws.usage.entries = ws.usage.entries.slice(0, 200);
  if (!ws.usage.plans.some((p: any) => p.provider === provider)) ws.usage.plans.push({ provider, plan: "Your plan", monthly: null, status: "Connected" });
}

function snapshot(state: any, scope: string, now: number) {
  const get = (path: string, query: any = {}) => handle(state, { method: "GET", path: "/api/" + path, query: { scope, ...query }, now }).data;
  const o = get("overview"), a = get("attention"), g = get("goals"), m = get("metrics");
  const slim = (i: any) => ({ title: i.title, nextStep: i.nextStep, due: i.due ? new Date(i.due).toISOString() : null, owner: i.owner, for: i.scopeLabel, score: i.score });
  return {
    today: new Date(now).toISOString(), sampleData: o.sample, greeting: o.greeting?.line, numbers: o.numbers?.map((n: any) => ({ label: n.label, value: n.value, period: n.period, note: n.sentence, source: n.source })),
    needsYou: a.needsYou.slice(0, 10).map(slim), waitingOnOthers: a.team.slice(0, 6).map(slim), needsChecking: a.verify.length,
    goals: g.goals?.map((x: any) => ({ title: x.title, progress: x.progress, keyResults: x.krs?.map((k: any) => ({ title: k.title, current: k.current, target: k.target })) })),
    metrics: m.metrics?.map((x: any) => ({ name: x.name, current: x.current, target: x.target, unit: x.unit, period: x.period, state: x.state })),
    today_events: o.today,
  };
}

async function serve(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const blocked = guard(req);
  if (blocked) return json({ error: blocked }, 403);
  const seg = (await ctx.params).path || [];
  const [a, b, c] = seg;
  const url = new URL(req.url);
  const origin = `http://${req.headers.get("host")}`;
  const query = Object.fromEntries(url.searchParams);
  const post = req.method === "POST";
  const body = post ? await req.json().catch(() => ({})) : {};
  const now = Date.now();
  const state = loadState(now);
  const ws: any = activeWs(state);
  const pass = () => {
    const res = handle(state, { method: req.method, path: "/api/" + seg.join("/"), query, body, now });
    if (res.changed) saveState();
    return res;
  };

  // --- Google sign-in comes back here ---
  if (a === "oauth" && b === "google" && c === "callback") {
    try {
      if (query.error) throw new Error("Google sign-in was cancelled.");
      const done = await finishGoogle(query.state, query.code, origin);
      const target = state.workspaces[done.wsId];
      if (target) { markGoogle(target, "connected", done.email); saveState(); syncWorkspace(target).catch(() => {}); }
      return NextResponse.redirect(`${origin}/connections?connected=google`);
    } catch (e: any) { return NextResponse.redirect(`${origin}/connections?problem=${encodeURIComponent(e.message)}`); }
  }

  if (a === "sync" && post) return json(await syncWorkspace(ws, now, body.only));

  // --- The AI link ---
  if (a === "ai" && b === "status") return json(await ai.status(ws.ai?.provider));
  if (a === "ai" && b === "ask" && post) {
    const st = await ai.status(ws.ai?.provider);
    if (st.provider) {
      try {
        const answer = await ai.run(st.provider, ai.askPrompt(String(body.question || ""), snapshot(state, query.scope || "all", now)));
        if (answer) { logUsage(ws, "Question: " + String(body.question || ""), st.provider, now); saveState(); return json({ answer, provider: st.provider, note: `Answered by your ${st.provider} plan, from the numbers on this dashboard.` }); }
      } catch { /* fall through to the rules answer below */ }
    }
    return json(pass().data);
  }
  if (a === "decisions" && post && !b) {
    const st = await ai.status(ws.ai?.provider);
    if (st.provider && String(body.question || "").trim().length >= 8) {
      try {
        const advisors = ai.parseAdvisors(await ai.run(st.provider, ai.debatePrompt(String(body.question), snapshot(state, "all", now))));
        if (advisors) { body.advisors = advisors; logUsage(ws, "Decision Room: " + String(body.question), st.provider, now); }
      } catch { /* the built-in advisors answer instead */ }
    }
    const res = pass();
    if (res.status < 400 && body.advisors) { res.data.provider = st.provider; saveState(); }
    return json(res.data, res.status);
  }

  // --- Real connections (sample workspaces only pretend, and say so) ---
  if (a === "connections" && !ws.sample) {
    const g = getSecrets(ws.id).google || {};
    if (!post) {
      const res = pass();
      return json({ ...res.data, google: { ready: !!(g.clientId && g.clientSecret), redirectUri: redirectUri(origin) }, syncing: isSyncing(ws.id) });
    }
    if (b && b !== "brands") {
      const cn = ws.connections.find((x: any) => x.id === b);
      if (!cn) return json({ error: "No such connection" }, 404);
      if (cn.auth === "soon") return json({ error: `${cn.name} is not available in this version yet.` }, 400);
      if (body.action === "disconnect") {
        if (GOOGLE_TOOLS.includes(b)) { setSecrets(ws.id, { google: g.clientId ? { clientId: g.clientId, clientSecret: g.clientSecret } : null }); markGoogle(ws, "off"); ws.sites = []; ws.events = []; ws.files = []; ws.inbox = ws.inbox.filter((m: any) => m.tool !== "gmail"); }
        else { setSecrets(ws.id, { [b]: null }); cn.status = "off"; cn.detail = "Not connected"; cn.lastSync = null; cn.account = ""; if (b === "linear") ws.items = ws.items.filter((i: any) => !String(i.id).startsWith("lin-")); if (b === "metricool") ws.sites.forEach((s: any) => { if (s.live) delete s.live.social; s.metricoolBrand = { id: "", name: "", matched: false, confirmed: false }; }); }
        saveState();
        return json({ ok: true });
      }
      if (GOOGLE_TOOLS.includes(b)) {
        if (body.clientId && body.clientSecret) setSecrets(ws.id, { google: { ...g, clientId: String(body.clientId).trim(), clientSecret: String(body.clientSecret).trim() } });
        const to = googleAuthUrl(ws.id, origin, ws.modules?.calendar === true);
        return json(to ? { redirect: to } : { needs: "Add your Google client ID and secret first." });
      }
      if (!body.token) return json({ needs: `Paste your ${cn.name} token first.` });
      if (b === "metricool" && !body.userId) return json({ needs: "Metricool also needs your user ID." });
      setSecrets(ws.id, { [b]: { token: String(body.token).trim(), userId: body.userId ? String(body.userId).trim() : undefined } });
      cn.status = "connected"; cn.account = "Token saved on this laptop"; cn.detail = "Fetching for the first time";
      await syncWorkspace(ws, now, b);
      saveState();
      return json(cn, cn.status === "error" ? 400 : 200);
    }
    if (b === "brands") { const res = pass(); await syncWorkspace(ws, now, "metricool"); return json(res.data, res.status); }
  }

  // --- Housekeeping around the shared router ---
  if (a === "workspaces" && b === "delete" && post) dropSecrets(String(body.id));
  if (a === "reset" && post) { if (body.scope === "workspace" || !ws.sample) dropSecrets(ws.id); else dropSecrets(); }
  if (a === "bootstrap" && !ws.sample && ws.connections.some((x: any) => x.status === "connected") && now - (ws.lastSync || 0) > 15 * 60000) syncWorkspace(ws, now).catch(() => {});

  const res = pass();
  return json(res.data, res.status);
}

export const GET = serve;
export const POST = serve;

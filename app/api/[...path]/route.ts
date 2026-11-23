// One door for every request: /api/<page>. The shared router in lib/api.ts answers almost everything.
// This file adds the parts that only make sense on the laptop: saving to disk, real sign-ins, syncing and the AI link.
import { NextRequest, NextResponse } from "next/server";
import { handle, activeWs } from "@/lib/api";
import { dropSecrets, getSecrets, loadState, saveState, setSecrets } from "@/lib/server/store";
import { GOOGLE_TOOLS, finishGoogle, googleAuthUrl, googleReady, realtime, sendMail, sentTo, signOutGoogle } from "@/lib/server/google";
import { keyProblem } from "@/lib/server/stripe";
import { NEWS_EVERY, applyNotes, fallbackSum, fetchStories, keepNotes, notesPrompt } from "@/lib/server/news";
import { openMade, openPath, readPicture, scanMade } from "@/lib/server/made";
import * as room from "@/lib/server/room";
import fs from "node:fs";
import path from "node:path";
import { linearAlert, linearComment, linearTasksFor } from "@/lib/server/linear";
import { clearGoogle, isSyncing, markGoogle, syncWorkspace } from "@/lib/server/sync";
import * as ai from "@/lib/server/ai";
import { connectAgent, disconnectAgent, listAgents } from "@/lib/server/agents";
import { brainSummary, dropBrain } from "@/lib/server/brain";

import { requireWorkOSLauncher } from "@/lib/workos/launcher-only";
// The owner's choice about AI sending, written where the MCP server can read it without calling the dashboard.
let aiSendingSaved: string | null = null;
function syncAiSending(ws: any) {
  const want = JSON.stringify({ on: !ws.sample && ws.modules?.aiSend !== false });
  if (want === aiSendingSaved) return;
  try { const dir = process.env.KEYSTONE_HOME || path.join(process.cwd(), ".keystone"); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "ai-sending.json"), want); aiSendingSaved = want; } catch { /* the tools simply stay off */ }
}
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const json = (data: any, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
const reading = new Set<string>();
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** This server is for the person at this computer only. Refuse anything that arrives under another name or from another site. */
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
    // The Second Brain as an outline: project names, sizes and which projects connect. Never file contents.
    secondBrain: brainSummary(state.active),
    ...extras(state, now),
  };
}

/** Money, the three levels of goals and what the AIs made, in a few lines the AI can read. Only what is really connected. */
function extras(state: any, now: number) {
  const u: any = handle(state, { method: "GET", path: "/api/ui", query: {}, now }).data;
  return {
    money: u.money.state === "ok" ? { currency: u.money.sym.trim(), thisMonth: Math.round(u.money.total), month: u.money.monthName, changeOnLastMonthPercent: u.money.delta, monthlyRecurring: u.money.mrr, subscriptions: u.money.subs, failedPayments: u.money.failed.map((p: any) => ({ who: p.who, amount: p.amount, why: p.why, on: p.on })), nextPayout: u.money.payout, source: "Stripe, updated " + u.money.when } : "Stripe is not connected.",
    plan: u.goals.levels.map((l: any) => ({ level: l.k, period: l.sub, goals: l.items.map((i: any) => ({ title: i[0], progressPercent: i[1], note: i[2] })) })),
    aiMade: u.made.state === "off" ? "Not looked at yet." : { last14Days: u.made.total, pictures: u.made.counts.image, videos: u.made.counts.video, docsAndCode: u.made.counts.other, byAi: u.made.ais, projects: u.made.roots.map((r: any) => r.name).slice(0, 12) },
    aiNews: u.news.stories.slice(0, 8).map((s: any) => ({ headline: s.head, source: s.name, topic: s.topic })),
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
  syncAiSending(ws);
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
      const firstRun = state.onboarded === false || (state.onboarded == null && state.firstRun);
      if (target && done.tools.length) {
        // Every Google app the person allowed is connected in one go. Apps connected earlier keep working, and now use the newest sign-in.
        for (const c of target.connections) if (GOOGLE_TOOLS.includes(c.id) && c.status !== "off") c.account = done.email;
        for (const t of done.tools) { markGoogle(target, t, "connected", done.email); if (t === "calendar") target.modules.calendar = true; }
        saveState();
        (async () => { for (const t of done.tools) await syncWorkspace(target, Date.now(), t).catch(() => {}); })();
      }
      if (target && done.tool === "account") {
        // First-run sign-in: remember who this is, then move on to connecting the rest of the tools.
        state.firstRun = { ...(state.firstRun || {}), step: "connect", email: done.email, name: done.name, picture: done.picture };
        target.setup = { ...(target.setup || {}), about: { ...(target.setup?.about || {}), name: done.name || target.setup?.about?.name, email: done.email } };
        saveState();
        return NextResponse.redirect(`${origin}/`);
      }
      return NextResponse.redirect(firstRun ? `${origin}/` : `${origin}/?connected=${encodeURIComponent(done.tools.length > 1 ? "google" : done.tool)}#connections`);
    } catch (e: any) { return NextResponse.redirect(`${origin}/?problem=${encodeURIComponent(e.message)}${state.firstRun ? "" : "#connections"}`); }
  }

  // First-run sign-in with Google: name, email and photo only.
  if (a === "firstrun" && b === "google" && post) {
    if (ws.sample) return json({ error: "Start your own workspace first." }, 400);
    // One click: the sign-in also asks for every Google app that is not connected yet.
    const to = googleAuthUrl(ws.id, origin, "account", false, GOOGLE_TOOLS.filter((t) => !ws.connections.some((x: any) => x.id === t && x.status === "connected")));
    return json(to ? { redirect: to } : { needs: "Google sign-in is not switched on in this copy of the dashboard yet." });
  }

  if (a === "sync" && post) return json(await syncWorkspace(ws, now, body.only));

  // Your team: what one person has on their plate. Linear tasks assigned to them and emails you sent them. Read only.
  if (a === "team" && b && c === "details" && !post) {
    const team: any[] = Array.isArray(ws.team) ? ws.team : [];
    const person = team.find((p) => p.id === b);
    if (!person) return json({ error: "No such person" }, 404);
    const isOwner = team[0] === person;
    const on = (id: string) => ws.connections.some((x: any) => x.id === id && x.status === "connected");
    const email = String(person.email || (isOwner ? ws.setup?.about?.email || "" : "")).trim();
    const out: any = { person: { id: person.id, name: person.name, role: person.role, email }, isOwner, sample: !!ws.sample, linear: { on: on("linear"), found: true, list: [], error: "" }, email: { on: on("gmail"), hasEmail: !!email, list: [], error: "" }, slack: { on: false } };
    if (ws.sample) {
      // The example workspace only has what is already in it: tasks that name this person, and alerts sent to them.
      const hand: any[] = (handle(state, { method: "GET", path: "/api/team", query: {}, now }).data.handovers || []).filter((h: any) => h.to === person.id);
      const item = (h: any) => ws.items.find((x: any) => x.id === h.itemId) || {};
      const theirs = isOwner ? ws.items.filter((x: any) => x.sources?.[0]?.tool === "linear" && x.waitingOn === "me") : hand.filter((h) => h.via === "linear").map(item).filter((x) => x.id);
      out.linear = { on: true, found: true, error: "", list: theirs.map((i: any) => ({ id: i.id, key: i.sources?.[0]?.ref || "", title: i.title, url: i.sources?.[0]?.url || "", project: i.scopeLabel || "", due: i.due ?? null, doneAt: null, state: i.status === "done" ? "Done" : i.due != null && i.due < now ? "Overdue" : "Open", tone: i.status === "done" ? "good" : i.due != null && i.due < now ? "bad" : "" })) };
      out.email = { on: true, hasEmail: true, error: "", list: hand.filter((h) => h.via === "alert").map((h: any) => ({ id: h.id, subject: "Please look at: " + h.title, at: h.at, url: "" })) };
      return json(out);
    }
    await Promise.all([
      out.linear.on && linearTasksFor(ws.id, { name: person.name, email }, isOwner).then((r) => { out.linear.found = r.found; out.linear.list = r.list; }).catch((e: any) => { out.linear.error = String(e?.message || e); }),
      out.email.on && email && !isOwner && sentTo(ws.id, email).then((l) => { out.email.list = l; }).catch((e: any) => { out.email.error = String(e?.message || e); }),
    ]);
    return json(out);
  }

  // --- AI news: public feeds, read from this computer; the linked AI then writes the notes in one go ---
  if (a === "news" && b === "read" && post) {
    const n = (ws.news ||= {});
    const topics: string[] = n.topics?.length ? n.topics : ["agents", "marketing", "models"];
    if (!body.force && n.when && now - n.when < NEWS_EVERY && (n.stories || []).length) return json({ ok: true, fresh: false });
    if (reading.has(ws.id)) return json({ ok: true, busy: true });
    reading.add(ws.id);
    let handed = false;
    try {
      const r = await fetchStories(topics, n.custom || [], now);
      if (r.error) { n.error = r.error; saveState(); return json({ error: r.error }, 502); }
      n.stories = keepNotes(r.stories, n.stories); n.when = now; n.error = "";
      const todo = n.stories.filter((s: any) => !s.use?.length);
      for (const s of todo) s.sum = fallbackSum(s);
      const st = await ai.status(ws.ai?.provider).catch(() => null);
      if (st?.provider && todo.length) {
        const provider = st.provider;
        n.busy = now; handed = true;
        const about = { name: ws.name, does: [ws.setup?.about?.role, ...(ws.setup?.goals || [])].filter(Boolean).join(". ").slice(0, 300), sites: (ws.sites || []).map((s: any) => s.name).slice(0, 8) };
        ai.run(provider, notesPrompt(todo, about, n.custom || []))
          .then((answer) => { if (applyNotes(n.stories, answer)) { n.ai = provider; logUsage(ws, "AI news: notes on " + todo.length + " stories", provider, Date.now()); } })
          .catch(() => { /* the stories stay, without the AI's notes */ })
          .finally(() => { delete n.busy; reading.delete(ws.id); saveState(); });
      }
      saveState();
      return json({ ok: true, stories: n.stories.length, writing: handed });
    } catch (e: any) { return json({ error: String(e?.message || e).slice(0, 200) }, 500); }
    finally { if (!handed) reading.delete(ws.id); }
  }

  // --- AI made: files saved in the folders your AI apps worked in. Looked up on this computer only. ---
  if (a === "made" && b === "scan" && post) {
    try { ws.made = scanMade(now); saveState(); return json({ ok: true, found: ws.made.items.length, folders: ws.made.roots.length }); }
    catch (e: any) { return json({ error: "The folders could not be read: " + String(e?.message || e).slice(0, 160) }, 500); }
  }
  if (a === "made" && b === "open" && post) {
    try { return json(await openMade(ws.made, String(body.id || ""), String(body.how || "folder"))); }
    catch (e: any) { return json({ error: String(e?.message || e).slice(0, 200) }, 400); }
  }
  if (a === "made" && b === "file" && !post) {
    const pic = readPicture(ws.made, String(query.id || ""));
    if (!pic) return json({ error: "No such picture" }, 404);
    return new NextResponse(new Uint8Array(pic.data), { headers: { "content-type": pic.type, "cache-control": "private, max-age=900", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox" } });
  }

  // --- People on the websites right now, from Google Analytics ---
  if (a === "realtime" && !post) {
    const off = (note: string) => json({ ok: false, n: 0, minutes: [], pages: [], note });
    const gaConn = ws.connections.find((x: any) => x.id === "google-analytics");
    if (ws.sample || gaConn?.status !== "connected") return off("Connect Google Analytics to see who is on your websites right now.");
    const ids = String(query.sites || "").split(",").filter(Boolean);
    const props = (ws.sites || []).filter((s: any) => s.gaProperty && (!ids.length || ids.includes(s.id))).map((s: any) => s.gaProperty);
    if (!props.length) return off("No website to read yet.");
    return json(await realtime(ws.id, props).catch(() => ({ ok: false, n: 0, minutes: [], pages: [], note: "Google Analytics gave no live reading just now." })));
  }

  // --- The AI link ---
  // --- Decision Room: a council of AI seats argues one question with the owner's real numbers ---
  if (a === "room") {
    try {
      const ui = () => handle(state, { method: "GET", path: "/api/ui", query: {}, now }).data;
      const ctx = (): room.Ctx => ({
        ws, u: ui(), team: (handle(state, { method: "GET", path: "/api/attention", query: { scope: "all" }, now }).data.team || []).map((i: any) => ({ owner: String(i.owner || "").split(" ")[0], due: i.due ?? null })),
        usage: (task, provider) => { logUsage(ws, task, provider, Date.now()); saveState(); },
      });
      if (!b) return json(await room.roomHome(ws, ui(), now));
      if (b === "access" && post) { const access = room.setAccess(ws, body); saveState(); return json({ ok: true, access }); }
      if (b === "attach" && post) { const item = await room.attachFile(ws, body.name, body.data); saveState(); return json({ ok: true, item }); }
      if (b === "detach" && post) { room.dropAttach(ws, String(body.id || "")); saveState(); return json({ ok: true }); }
      if (b === "start" && post) { const made = await room.startSession(ctx(), body, now); saveState(); return json(made); }
      const s = room.readSession(ws.id, b);
      if (!s) return json({ error: "That decision is no longer here." }, 404);
      if (!c && !post) {
        // A council that rested because the AI plan ran out carries on by itself once the rest is over.
        if (s.status === "resting" && s.rest?.until <= now) room.resume(s, ctx());
        return json(room.viewSession(s, now));
      }
      if (c === "report" && !post) {
        if (!s.verdict) return json({ error: "This decision has no report yet." }, 404);
        return new NextResponse(room.reportPage(s), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:" } });
      }
      if (c === "pdf" && !post) {
        if (!s.verdict) return json({ error: "This decision has no report yet." }, 404);
        const file = await room.reportPdf(s);
        if (!file) return json({ error: "The PDF needs Chrome or Edge on this computer. Open the report and print it to PDF instead." }, 404);
        const name = "Decision report - " + String(s.report?.short || "decision").replace(/[^\w -]/g, "").trim() + ".pdf";
        return new NextResponse(fs.readFileSync(file), { headers: { "content-type": "application/pdf", "content-disposition": `${query.inline ? "inline" : "attachment"}; filename="${name}"`, "cache-control": "no-store" } });
      }
      if (!post) return json({ error: "No such page." }, 404);
      if (c === "edit") return json(room.viewSession(room.editSession(s, body), now));
      if (c === "gather") { room.gather(s, ctx()); return json(room.viewSession(s, now)); }
      if (c === "run") { room.run(s, ctx()); return json(room.viewSession(s, now)); }
      if (c === "pause") { room.pause(s); return json(room.viewSession(s, now)); }
      if (c === "resume") { room.resume(s, ctx()); return json(room.viewSession(s, now)); }
      if (c === "checkin") { room.checkin(s, String(body.result || "")); return json({ ok: true }); }
      if (c === "folder") return json(await openPath(room.sessionFolder(s) + "/report.html", "folder"));
      if (c === "delete") { room.removeSession(ws.id, s.id); return json({ ok: true }); }
      if (c === "tasks") {
        if (!s.verdict) return json({ error: "There is no verdict yet." }, 400);
        if (s.tasks) return json({ ok: true, added: 0, note: "These steps are already in Needs you." });
        const me = String(ws.setup?.about?.name || ws.owner || "").split(" ")[0];
        s.verdict.next.forEach((n: any, i: number) => ws.items.push({
          id: "att-d" + (now + i).toString(36), kind: "decision", title: n.step, nextStep: "From the Decision Room: " + String(s.brief.title).slice(0, 110), scope: null,
          owner: n.owner === me ? ws.setup?.about?.name || ws.owner : n.owner, waitingOn: n.owner === me ? "me" : "other", due: n.due,
          sources: [{ tool: "doc", label: "Decision Room" }], evidence: "verified", evidenceNote: "A step from a council verdict. The report holds the reasons.", lastVerified: now, factors: {}, status: "open",
        }));
        s.tasks = true; room.saveSession(s); saveState();
        return json({ ok: true, added: s.verdict.next.length });
      }
      return json({ error: "No such action." }, 404);
    } catch (e: any) { return json({ error: String(e?.message || e).slice(0, 240) }, 400); }
  }

  if (a === "ai" && b === "status") return json(await ai.status(ws.ai?.provider));
  if (a === "ai" && b === "agents") {
    if (post) {
      if (typeof c !== "string" || !c) return json({ error: "Pick an AI app." }, 400);
      try { if (body.action === "disconnect") await disconnectAgent(c); else await connectAgent(c); }
      catch (e: any) { return json({ error: String(e?.message || e).slice(0, 240) }, 400); }
    }
    const [agents, st] = await Promise.all([listAgents(), ai.status(ws.ai?.provider)]);
    // Remembered so the top bar can say the same thing as this list without asking every AI app again.
    const linkedIds = agents.filter((x) => x.connected).map((x) => x.id);
    if (JSON.stringify(ws.ai?.linked || null) !== JSON.stringify(linkedIds)) { ws.ai = { ...(ws.ai || {}), linked: linkedIds }; saveState(); }
    const answerWith = Object.entries(ai.PROVIDER_IDS).find(([, p]) => p === st.provider)?.[0] || null;
    return json({ agents, answerWith });
  }
  if (a === "ai" && b === "answer" && post) {
    const provider = ai.PROVIDER_IDS[String(body.id)];
    if (!provider) return json({ error: "That AI can't write answers inside the dashboard." }, 400);
    if (!(await ai.detect()).includes(provider)) return json({ error: `${provider} is not installed on this computer.` }, 400);
    ws.ai = { ...(ws.ai || {}), provider: provider.split(" ")[0].toLowerCase() };
    saveState();
    return json({ ok: true, provider });
  }
  // Draft steps from a goal: the owner's own AI suggests up to three short steps for the level below. Without a linked AI a plain starter set is used.
  if (a === "plan" && b === "draft" && post && !ws.sample) {
    const goal = (ws.plan?.goals || []).find((g: any) => g.id === body.id);
    const LV = ["quarter", "month", "week", "day"], down = goal ? LV[LV.indexOf(goal.level) + 1] : "";
    let titles: string[] = [];
    const st = goal && down ? await ai.status(ws.ai?.provider).catch(() => null) : null;
    if (st?.provider) {
      try {
        const text = await ai.run(st.provider, `A business owner has this ${goal.level} goal: "${String(goal.title).slice(0, 120)}".\nWrite exactly three short, concrete steps for ${down === "day" ? "today" : "this " + down} that move it forward. One per line, at most ten words each, plain words, no numbering, no extra text.`);
        titles = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 3);
        if (titles.length) logUsage(ws, "Draft steps: " + String(goal.title), st.provider, now);
      } catch { /* the starter set below is used instead */ }
    }
    const res = handle(state, { method: "POST", path: "/api/plan/draft", query, body: { id: body.id, titles }, now });
    if (res.status < 400) saveState();
    return json(res.data, res.status);
  }
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
    if (!post) {
      const res = pass();
      return json({ ...res.data, google: { ready: googleReady(ws.id) }, syncing: isSyncing(ws.id) });
    }
    if (b && b !== "brands") {
      const cn = ws.connections.find((x: any) => x.id === b);
      if (!cn) return json({ error: "No such connection" }, 404);
      if (cn.auth === "soon") return json({ error: `${cn.name} is not available in this version yet.` }, 400);
      if (body.action === "disconnect") {
        if (GOOGLE_TOOLS.includes(b)) {
          markGoogle(ws, b, "off"); clearGoogle(ws, b);
          if (b === "calendar") ws.modules.calendar = false;
          if (!ws.connections.some((x: any) => GOOGLE_TOOLS.includes(x.id) && x.status !== "off")) await signOutGoogle(ws.id);
        }
        else { setSecrets(ws.id, { [b]: null }); cn.status = "off"; cn.detail = "Not connected"; cn.lastSync = null; cn.account = ""; if (b === "linear") ws.items = ws.items.filter((i: any) => !String(i.id).startsWith("lin-")); if (b === "stripe") delete ws.money; if (b === "metricool") ws.sites.forEach((s: any) => { if (s.live) delete s.live.social; s.metricoolBrand = { id: "", name: "", matched: false, confirmed: false }; }); }
        saveState();
        return json({ ok: true });
      }
      if (GOOGLE_TOOLS.includes(b)) {
        if (body.send === true) { ws.modules.mailSend = true; saveState(); }
        // The first Google app connects all of them at once. After that, each one connects on its own, so an app you turned off stays off.
        const first = !ws.connections.some((x: any) => GOOGLE_TOOLS.includes(x.id) && x.status === "connected");
        const to = googleAuthUrl(ws.id, origin, b, ws.modules?.mailSend === true, first ? GOOGLE_TOOLS : []);
        return json(to ? { redirect: to } : { needs: "Google sign-in is not switched on in this copy of the dashboard yet." });
      }
      if (!body.token) return json({ needs: b === "stripe" ? "Paste your Stripe read-only key first." : `Paste your ${cn.name} token first.` });
      if (b === "stripe") { const bad = keyProblem(String(body.token)); if (bad) return json({ needs: bad }); }
      if (b === "stripe" && body.stripeScopesReviewed !== true) return json({ needs: "Tick the box to confirm you checked the key is set to Read only in Stripe." });
      if (b === "metricool" && !body.userId) return json({ needs: "Metricool also needs your user ID." });
      setSecrets(ws.id, { [b]: { token: String(body.token).trim(), userId: body.userId ? String(body.userId).trim() : undefined, ...(b === "stripe" ? { scopesReviewed: true } : {}) } });
      cn.status = "connected"; cn.account = "Token saved on this computer"; cn.detail = "Fetching for the first time";
      // Wait for a sync that is already running, so this key is really checked now.
      for (let i = 0; i < 60 && isSyncing(ws.id); i++) await new Promise((r) => setTimeout(r, 500));
      await syncWorkspace(ws, now, b);
      if (cn.status === "error") {
        // A key that does not work is not kept: the tool stays off and the person sees why.
        const why = cn.detail;
        setSecrets(ws.id, { [b]: null }); cn.status = "off"; cn.detail = "Not connected"; cn.account = ""; cn.lastSync = null;
        saveState();
        return json({ error: why }, 400);
      }
      saveState();
      return json(cn);
    }
    if (b === "brands") { const res = pass(); await syncWorkspace(ws, now, "metricool"); return json(res.data, res.status); }
  }

  // --- Comments and alerts you send yourself (sample workspaces only pretend, and say so) ---
  if (a === "attention" && post && b && (c === "comment" || c === "alert") && !ws.sample) {
    const item = ws.items.find((i: any) => i.id === b);
    if (!item) return json({ error: "No such item" }, 404);
    if (body.via === "your AI" && ws.modules?.aiSend === false) return json({ error: "The owner switched off sending by AI in Settings." }, 403);
    const issueId = String(item.id).startsWith("lin-") ? String(item.id).slice(4) : null;
    const me = ws.setup?.about?.name || ws.owner || "The owner";
    try {
      if (c === "comment") {
        const text = String(body.text || "").trim().slice(0, 2000);
        if (!issueId) return json({ error: "Comments go to Linear, and this did not come from Linear." }, 400);
        if (text.length < 2) return json({ error: "Write a short comment first." }, 400);
        await linearComment(ws.id, issueId, text);
        body.via = body.via || "Linear";
      } else {
        const team: any[] = Array.isArray(ws.team) ? ws.team : [];
        const picked = team.filter((p, n) => n > 0 && Array.isArray(body.people) && body.people.includes(p.id));
        if (!picked.length) return json({ error: "Pick at least one person to alert." }, 400);
        const note = String(body.note || "").trim().slice(0, 300);
        let byLinear: string[] = [], rest = picked;
        const people = picked.map((p) => ({ name: p.name, email: p.email }));
        if (issueId) {
          // Look first, send second: nothing goes out until every picked person can be reached.
          const r = await linearAlert(ws.id, issueId, people, note, me, true);
          byLinear = r.reached; rest = picked.filter((p) => r.missing.includes(p.name));
        }
        if (rest.length) {
          const noMail = rest.filter((p) => !p.email).map((p) => p.name);
          if (noMail.length) return json({ error: `${noMail.join(" and ")} ${issueId ? "could not be found in Linear. Add an email" : "needs an email"} on the Your team page, so the alert can go by email.` }, 400);
          if (ws.modules?.mailSend !== true) return json({ error: "Email alerts need your permission to send from Gmail.", needs: "mail" }, 400);
        }
        if (byLinear.length) await linearAlert(ws.id, issueId as string, people.filter((p) => byLinear.includes(p.name)), note, me);
        if (rest.length) {
          const src = (item.sources || [])[0];
          const parts = [`Hi ${rest.map((p) => p.name).join(" and ")},`, `${me} would like you to look at this:`, [item.title, item.nextStep ? "Next step: " + item.nextStep : "", item.scopeLabel ? "For: " + item.scopeLabel : "", src ? `From: ${src.label}${src.url && src.url !== "#" ? " " + src.url : ""}` : ""].filter(Boolean).join("\n"), note ? `Note from ${me}: ${note}` : "", `Sent from ${me}'s dashboard.`].filter(Boolean);
          try { await sendMail(ws.id, rest.map((p) => p.email), `${me} needs you on: ${item.title}`.slice(0, 140), parts.join("\n\n")); }
          catch (e: any) {
            if (!byLinear.length) return json({ error: String(e?.message || e), needs: /allow/i.test(String(e?.message)) ? "mail" : undefined }, 400);
            // Linear already went out: record that part, and say plainly that the email did not.
            body.people = picked.filter((p) => byLinear.includes(p.name)).map((p) => p.id); body.how = { linear: byLinear, email: [] };
            const part = pass();
            return json({ ...part.data, warning: `${byLinear.join(" and ")} was alerted on Linear. The email to ${rest.map((p) => p.name).join(" and ")} did not send: ${String(e?.message || e)}` }, part.status);
          }
        }
        body.how = { linear: byLinear, email: rest.map((p) => p.name) };
      }
    } catch (e: any) { return json({ error: String(e?.message || e).slice(0, 200) }, 400); }
    const res = pass();
    // Sent by the owner's AI: leave a note for the open dashboard, so it can say so and play it in Your team.
    if (res.status < 400 && body.via === "your AI") {
      ws.aiSent = [...(ws.aiSent || []), { kind: c, title: String(item.title).slice(0, 120), to: res.data?.to || [], watch: res.data?.watch || [], at: now }].slice(-10);
      saveState();
    }
    return json(res.data, res.status);
  }
  // What the owner's AI sent since the dashboard last looked. Read once, then cleared.
  if (a === "ai" && b === "sent") {
    const list = (ws.aiSent || []).filter((x: any) => now - x.at < 10 * 60000);
    if (ws.aiSent?.length) { ws.aiSent = []; saveState(); }
    return json({ sent: list });
  }

  // --- Housekeeping around the shared router ---
  if (a === "workspaces" && b === "delete" && post) {
    if (typeof body.id === "string" && Object.hasOwn(state.workspaces, body.id) && Object.keys(state.workspaces).length > 1 && !(body.id === "main" && state.workspaces.main.sample)) { dropBrain(body.id); dropSecrets(body.id); }
  }
  if (a === "firstrun" && b === "finish" && post) {
    for (const [id, w] of Object.entries<any>(state.workspaces)) if (w.sample && id !== ws.id) { dropBrain(id); dropSecrets(id); }
  }
  if (a === "reset" && post) {
    for (const id of body.scope === "workspace" ? [ws.id] : Object.keys(state.workspaces)) dropBrain(id);
    if (body.scope === "workspace" || !ws.sample) dropSecrets(ws.id); else dropSecrets();
  }
  if (a === "bootstrap" && !ws.sample && ws.connections.some((x: any) => x.status === "connected") && now - (ws.lastSync || 0) > 15 * 60000) syncWorkspace(ws, now).catch(() => {});

  // The main screens: one bundle, plus which AI answers on this computer.
  if ((a === "ui" || a === "bootstrap") && !post) {
    const st = await ai.status(ws.ai?.provider).catch(() => null);
    const aiId = st?.provider ? Object.entries(ai.PROVIDER_IDS).find(([, p]) => p === st.provider)?.[0] || "" : "";
    // "linked" is whether that AI is also connected on Connections. Not known until the list was read once.
    const linked = st?.provider ? { id: aiId, name: st.provider, linked: Array.isArray(ws.ai?.linked) ? ws.ai.linked.includes(aiId) : null } : null;
    if (a === "ui") return json(handle(state, { method: "GET", path: "/api/ui", query, body: { ai: linked }, now }).data);
    const boot = pass();
    return json({ ...boot.data, ai: linked }, boot.status);
  }

  const res = pass();
  return json(res.data, res.status);
}

// In client mode (a WorkOS installation) the dashboard API is closed: everything goes through the installation's own launcher.
const guarded: typeof serve = (...args) => (process.env.WORKOS_LOCAL_CLIENT === "1" ? (requireWorkOSLauncher() as any) : serve(...args));
export const GET = guarded;
export const POST = guarded;

// Fixture tests for the attention ranking. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQueue, scoreItem, DEFAULT_RUBRIC, urgencyFromDue, waitingAgeFromFollowUp } from "../lib/scoring.ts";
import type { AttentionItem } from "../lib/scoring.ts";
import { handle, ENDPOINTS } from "../lib/api.ts";
import { makeState } from "../lib/sample.ts";

const NOW = Date.UTC(2026, 10, 13, 9, 0, 0);
const H = 3600000, D = 24 * H;
const base = (p: Partial<AttentionItem>): AttentionItem => ({
  id: "x", kind: "decision", title: "t", nextStep: "n", owner: "Sam", waitingOn: "me", sources: [{ tool: "linear", label: "A", ref: "A-1" }],
  evidence: "verified", factors: { impact: 3, unblocks: 3, alignment: 3 }, status: "open", ...p,
});

test("score follows 7U + 6I + 4S + 2G + W and tops out at 100", () => {
  const s = scoreItem(base({ due: NOW + H, factors: { impact: 5, unblocks: 5, alignment: 5, waitingAge: 5 } }), DEFAULT_RUBRIC, NOW);
  assert.equal(s.score, 100); assert.equal(s.maxScore, 100);
  assert.deepEqual(s.contributions, { urgency: 35, impact: 30, unblocks: 20, alignment: 10, waitingAge: 5 });
});

test("urgency bands sit on the 24h, 72h, 7d and 14d boundaries", () => {
  assert.equal(urgencyFromDue(NOW - H, NOW), 5); // overdue
  assert.equal(urgencyFromDue(NOW + 24 * H, NOW), 5);
  assert.equal(urgencyFromDue(NOW + 24 * H + 1, NOW), 4);
  assert.equal(urgencyFromDue(NOW + 72 * H + 1, NOW), 3);
  assert.equal(urgencyFromDue(NOW + 7 * D + 1, NOW), 2);
  assert.equal(urgencyFromDue(NOW + 14 * D + 1, NOW), 1);
  assert.equal(urgencyFromDue(null, NOW), null);
});

test("waiting age only counts a follow-up that is already due", () => {
  assert.equal(waitingAgeFromFollowUp(NOW + D, NOW), 0);
  assert.equal(waitingAgeFromFollowUp(null, NOW), 0);
  assert.equal(waitingAgeFromFollowUp(NOW - 1 * D, NOW), 1);
  assert.equal(waitingAgeFromFollowUp(NOW - 4 * D, NOW), 2);
  assert.equal(waitingAgeFromFollowUp(NOW - 10 * D, NOW), 3);
  assert.equal(waitingAgeFromFollowUp(NOW - 20 * D, NOW), 4);
  assert.equal(waitingAgeFromFollowUp(NOW - 40 * D, NOW), 5);
});

test("an imminent deadline outranks a high-impact decision with no time pressure", () => {
  const q = buildQueue([
    base({ id: "soon", due: NOW + 3 * H }),
    base({ id: "big", due: null, factors: { urgency: 0, impact: 5, unblocks: 3, alignment: 5 } }),
  ], DEFAULT_RUBRIC, NOW);
  assert.deepEqual(q.needsYou.map((i) => i.id), ["soon", "big"]);
});

test("someone blocked by you ranks above the same item where nobody is blocked", () => {
  const q = buildQueue([
    base({ id: "free", due: NOW + 5 * D, factors: { impact: 3, unblocks: 1, alignment: 3 } }),
    base({ id: "blocked", due: NOW + 5 * D, factors: { impact: 3, unblocks: 5, alignment: 3 } }),
  ], DEFAULT_RUBRIC, NOW);
  assert.equal(q.needsYou[0].id, "blocked");
});

test("things you are waiting on go to the team list, never your queue", () => {
  const q = buildQueue([base({ id: "theirs", waitingOn: "other", followUpDue: NOW + D })], DEFAULT_RUBRIC, NOW);
  assert.equal(q.needsYou.length, 0); assert.equal(q.team[0].id, "theirs");
});

test("old low-value work stays at the bottom: age alone adds no points", () => {
  const old = scoreItem(base({ id: "old", due: null, lastVerified: NOW - 200 * D, factors: { urgency: 0, impact: 1, unblocks: 1, alignment: 1 } }), DEFAULT_RUBRIC, NOW);
  assert.equal(old.score, 6 + 4 + 2);
});

test("duplicate sources merge into one card and do not add priority", () => {
  const one = buildQueue([base({ id: "a1", actionKey: "k", due: NOW + D })], DEFAULT_RUBRIC, NOW);
  const three = buildQueue([
    base({ id: "a1", actionKey: "k", due: NOW + D }),
    base({ id: "a2", actionKey: "k", due: NOW + D, sources: [{ tool: "slack", label: "B", ref: "s-1" }] }),
    base({ id: "a3", actionKey: "k", due: NOW + D, sources: [{ tool: "gmail", label: "C", ref: "g-1" }, { tool: "slack", label: "B", ref: "s-1" }] }),
  ], DEFAULT_RUBRIC, NOW);
  assert.equal(three.needsYou.length, 1);
  assert.equal(three.needsYou[0].score, one.needsYou[0].score);
  assert.equal(three.needsYou[0].sources.length, 3);
  assert.equal(three.needsYou[0].merged, 3);
});

test("an unknown factor is never treated as zero and keeps the item out of the main queue", () => {
  const q = buildQueue([base({ id: "vague", due: null, factors: { urgency: null, impact: 2, unblocks: 2, alignment: null } })], DEFAULT_RUBRIC, NOW);
  assert.equal(q.needsYou.length, 0);
  assert.equal(q.verify[0].id, "vague");
  assert.equal(q.verify[0].complete, false);
  assert.equal(q.verify[0].contributions.urgency, null);
});

test("an urgent item with missing facts stays visible in the main queue", () => {
  const q = buildQueue([base({ id: "renewal", due: NOW + 20 * H, factors: { impact: null, unblocks: 5, alignment: null } })], DEFAULT_RUBRIC, NOW);
  assert.equal(q.needsYou[0].id, "renewal");
  assert.equal(q.needsYou[0].urgentFlag, true);
  assert.equal(q.needsYou[0].warn, true);
});

test("stale and conflicting evidence are flagged and listed for checking", () => {
  const q = buildQueue([base({ id: "s", evidence: "stale", due: NOW + 5 * D }), base({ id: "c", evidence: "conflicting", due: NOW + 5 * D })], DEFAULT_RUBRIC, NOW);
  assert.equal(q.verify.length, 2);
  assert.ok(q.needsYou.every((i) => i.warn));
});

test("finished, cancelled and snoozed items leave the active queue", () => {
  const q = buildQueue([
    base({ id: "done", status: "done", doneAt: NOW - H }), base({ id: "gone", status: "cancelled" }),
    base({ id: "later", snoozedUntil: NOW + D }), base({ id: "live", due: NOW + D }),
  ], DEFAULT_RUBRIC, NOW);
  assert.deepEqual(q.needsYou.map((i) => i.id), ["live"]);
  assert.deepEqual(q.snoozed.map((i) => i.id), ["later"]);
  assert.equal(q.done.length, 2);
});

test("a pinned item goes first and unpinning restores the computed order", () => {
  const items = [base({ id: "hi", due: NOW + H }), base({ id: "lo", due: NOW + 10 * D, pin: 0 })];
  assert.equal(buildQueue(items, DEFAULT_RUBRIC, NOW).needsYou[0].id, "lo");
  items[1].pin = null;
  assert.equal(buildQueue(items, DEFAULT_RUBRIC, NOW).needsYou[0].id, "hi");
});

test("ties break by deadline, then overdue follow-up, then id, and never reshuffle", () => {
  const mk = () => [
    base({ id: "b", due: NOW + 30 * H }), base({ id: "a", due: NOW + 30 * H }),
    base({ id: "c", due: NOW + 26 * H }),
  ];
  const first = buildQueue(mk(), DEFAULT_RUBRIC, NOW).needsYou.map((i) => i.id);
  assert.deepEqual(first, ["c", "a", "b"]);
  assert.deepEqual(buildQueue(mk().reverse(), DEFAULT_RUBRIC, NOW).needsYou.map((i) => i.id), first);
});

test("changing a weight changes the result, and each workspace keeps its own rubric", () => {
  const state = makeState(NOW);
  handle(state, { method: "POST", path: "/api/workspaces/switch", body: { id: "sample-lumen" }, now: NOW });
  handle(state, { method: "POST", path: "/api/settings", body: { weights: { urgency: 3 } }, now: NOW });
  assert.equal(state.workspaces["sample-lumen"].rubric.weights.urgency, 3);
  assert.equal(state.workspaces["sample-lumen"].rubric.version, "1.1");
  assert.equal(state.workspaces["main"].rubric.weights.urgency, 7);
  assert.equal(state.workspaces["sample-meridian"].rubric.version, "1.0");
});

test("two workspaces from the same template change independently", () => {
  const state = makeState(NOW);
  handle(state, { method: "POST", path: "/api/workspaces/switch", body: { id: "sample-meridian" }, now: NOW });
  const before = JSON.stringify(state.workspaces["sample-lumen"]) + JSON.stringify(state.workspaces["main"]);
  handle(state, { method: "POST", path: "/api/attention/att-101/done", now: NOW });
  handle(state, { method: "POST", path: "/api/settings", body: { brandName: "Meridian HQ", accent: "pink" }, now: NOW });
  assert.equal(state.workspaces["sample-meridian"].brand.name, "Meridian HQ");
  assert.equal(JSON.stringify(state.workspaces["sample-lumen"]) + JSON.stringify(state.workspaces["main"]), before);
});

test("a workspace cannot read another workspace's records", () => {
  const state = makeState(NOW);
  handle(state, { method: "POST", path: "/api/workspaces/switch", body: { id: "sample-lumen" }, now: NOW });
  const dump = JSON.stringify([
    handle(state, { method: "GET", path: "/api/attention", now: NOW }).data,
    handle(state, { method: "GET", path: "/api/search", query: { q: "platewise" }, now: NOW }).data,
    handle(state, { method: "GET", path: "/api/search", query: { q: "meridian" }, now: NOW }).data,
    handle(state, { method: "GET", path: "/api/export", now: NOW }).data,
    handle(state, { method: "GET", path: "/api/clients", now: NOW }).data,
  ]);
  assert.ok(!/Platewise|Elena|att-003|Meridian/.test(dump));
  assert.equal(handle(state, { method: "POST", path: "/api/attention/att-003/done", now: NOW }).status, 404);
});

test("the sample queue: duplicates merged, overrides recorded and reversible, state survives a save and reopen", () => {
  let state = makeState(NOW);
  const get = () => handle(state, { method: "GET", path: "/api/attention", now: NOW }).data;
  const q0 = get();
  assert.equal(q0.needsYou.filter((i: any) => i.actionKey === "platewise-launch-post").length, 1);
  assert.ok(q0.needsYou.some((i: any) => i.id === "att-011" && i.urgentFlag && !i.complete));
  assert.ok(!q0.needsYou.some((i: any) => i.id === "att-010"));
  const last = q0.needsYou[q0.needsYou.length - 1].id;
  handle(state, { method: "POST", path: `/api/attention/${last}/pin`, body: { reason: "Promised today" }, now: NOW });
  state = JSON.parse(JSON.stringify(state)); // save and reopen
  const q1 = get();
  assert.equal(q1.needsYou[0].id, last);
  assert.equal(q1.needsYou[0].override.why, "Promised today");
  handle(state, { method: "POST", path: `/api/attention/${last}/unpin`, now: NOW });
  assert.deepEqual(get().needsYou.map((i: any) => i.id), q0.needsYou.map((i: any) => i.id));
  handle(state, { method: "POST", path: `/api/attention/att-001/done`, now: NOW });
  assert.ok(!get().needsYou.some((i: any) => i.actionKey === "platewise-launch-post"));
});

test("every listed endpoint answers, and unknown numbers stay unknown", () => {
  const state = makeState(NOW);
  const root = handle(state, { method: "GET", path: "/api", now: NOW }).data;
  for (const e of root.endpoints) assert.equal(handle(state, { method: "GET", path: e.path, query: { q: "a" }, now: NOW }).status, 200, e.path);
  const metrics = handle(state, { method: "GET", path: "/api/metrics", now: NOW }).data.metrics;
  assert.equal(metrics.find((m: any) => m.id === "m-mrr").current, null);
  const goals = handle(state, { method: "GET", path: "/api/goals", now: NOW }).data.goals;
  assert.equal(goals[0].krs[2].progress, null);
  assert.ok(goals[0].progress > 0 && goals[0].progress < 1);
});

test("a real workspace starts empty, answers every endpoint and invents nothing", () => {
  const state = makeState(NOW);
  const made = handle(state, { method: "POST", path: "/api/workspaces", body: { name: "My real business", owner: "Jo", real: true }, now: NOW });
  assert.equal(made.status, 200);
  const ws: any = state.workspaces[made.data.id];
  assert.equal(ws.sample, false);
  assert.equal(ws.sites.length + ws.items.length + ws.reels.length + ws.inbox.length + ws.goals.length, 0);
  assert.ok(ws.connections.every((c: any) => c.status === "off"));
  for (const [path] of ENDPOINTS) {
    if (/reset|ai\/ask|workspaces\/|:id|brands|checkin/.test(path)) continue;
    const r = handle(state, { method: "GET", path: "/api/" + path, query: {}, now: NOW });
    assert.equal(r.status, 200, path + " should answer");
  }
  const o = handle(state, { method: "GET", path: "/api/overview", now: NOW }).data;
  assert.equal(o.sample, false);
  assert.equal(o.top.length, 0);
});

test("live website numbers are used as given and missing social data is never invented", () => {
  const state = makeState(NOW);
  const id = handle(state, { method: "POST", path: "/api/workspaces", body: { name: "Live", owner: "Jo", real: true }, now: NOW }).data.id;
  const ws: any = state.workspaces[id];
  const day0 = new Date(NOW); day0.setHours(0, 0, 0, 0);
  ws.sites.push({ id: "p1", name: "Example", domain: "example.com", kind: "Website", color: "#0A6CFF", networks: [], metricoolBrand: { id: "", name: "", matched: false, confirmed: false },
    live: { daily: Array.from({ length: 56 }, (_, i) => ({ t: day0.getTime() - i * 86400000, visitors: 100, leads: 5 })), sources: [{ name: "Search", visitors: 70 }, { name: "Direct", visitors: 30 }], pages: [{ path: "/", visitors: 60 }] } });
  const w = handle(state, { method: "GET", path: "/api/website", query: { site: "p1", range: "28" }, now: NOW }).data;
  assert.equal(w.totals.visitors, 2800);
  assert.equal(w.totals.leads, 140);
  assert.equal(w.sources[0].name, "Search");
  const s = handle(state, { method: "GET", path: "/api/social", query: { site: "p1" }, now: NOW }).data;
  assert.notEqual(s.state, "ok");
  assert.equal(s.upNext.length, 0);
});

test("an item added by hand is provisional until its missing facts are answered", () => {
  const state = makeState(NOW);
  const it = handle(state, { method: "POST", path: "/api/attention", body: { title: "Approve the spring price list" }, now: NOW }).data;
  let q = handle(state, { method: "GET", path: "/api/attention", query: { scope: "all" }, now: NOW }).data;
  assert.ok(q.verify.some((x: any) => x.id === it.id));
  assert.ok(!q.needsYou.some((x: any) => x.id === it.id));
  handle(state, { method: "POST", path: `/api/attention/${it.id}/facts`, body: { facts: { urgency: 2, impact: 3, unblocks: 4, alignment: 1 } }, now: NOW });
  q = handle(state, { method: "GET", path: "/api/attention", query: { scope: "all" }, now: NOW }).data;
  const mine = q.needsYou.find((x: any) => x.id === it.id);
  assert.ok(mine && mine.complete);
  assert.equal(mine.score, 7 * 2 + 6 * 3 + 4 * 4 + 2 * 1);
});

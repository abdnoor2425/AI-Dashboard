// Tests for Watch it live: who handed what to whom. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PHRASES, handoversFrom, matchPerson, phrasesFrom, pickPhrase } from "../lib/handover.ts";
import { handle } from "../lib/api.ts";
import { makeState } from "../lib/sample.ts";

const team = [
  { id: "p1", name: "Dana Reyes", email: "dana@acme.test", parent: null },
  { id: "p2", name: "Ali Khan", email: "ali@acme.test", parent: "p1" },
  { id: "p3", name: "Ali Moreno", parent: "p1" },
  { id: "p4", name: "Priya", email: "priya@acme.test", parent: "p2" },
];

test("matches people by email, full name, then a unique first name", () => {
  assert.equal(matchPerson(team, "PRIYA@acme.test")?.id, "p4");
  assert.equal(matchPerson(team, "  ali   khan ")?.id, "p2");
  assert.equal(matchPerson(team, "Priya Shah")?.id, "p4", "a unique first name is enough");
  assert.equal(matchPerson(team, "Ali"), null, "two people called Ali: no guess");
  assert.equal(matchPerson(team, "nobody@acme.test"), null);
  assert.equal(matchPerson(team, ""), null);
});

test("a Linear ticket the owner assigned is a handover from The Leader", () => {
  const h = handoversFrom([{ id: "i1", title: "Ship it", assignedByMe: true, assignee: "Priya", assignedAt: 100 }], team);
  assert.deepEqual(h.map((x) => [x.from, x.to, x.via, x.at]), [["p1", "p4", "linear", 100]]);
});

test("an email from Linear wins over a name that does not match", () => {
  const h = handoversFrom([{ id: "i1", title: "T", assignedByMe: true, assignee: "P. S.", assigneeEmail: "priya@acme.test", assignedAt: 1 }], team);
  assert.equal(h[0]?.to, "p4");
});

test("alerts become handovers from whoever sent them, one per recipient", () => {
  const items = [{ id: "i2", title: "Fix checkout", alerts: [{ to: ["Ali Khan", "Priya"], by: "Ali Khan", at: 50 }] }];
  const h = handoversFrom(items, team);
  assert.deepEqual(h.map((x) => [x.from, x.to]).sort(), [["p2", "p4"]], "nobody hands a task to themselves");
  const h2 = handoversFrom([{ id: "i3", title: "X", alerts: [{ to: ["Priya"], by: "Someone outside", at: 5 }] }], team);
  assert.equal(h2[0].from, "p1", "an unknown sender counts as The Leader");
});

test("the newest handover of the same task and person wins, and the list is newest first", () => {
  const items = [
    { id: "a", title: "A", assignedByMe: true, assignee: "Priya", assignedAt: 10, alerts: [{ to: ["Priya"], by: "Dana Reyes", at: 40 }] },
    { id: "b", title: "B", alerts: [{ to: ["Ali Khan"], by: "Dana Reyes", at: 30 }] },
    { id: "c", title: "C", dismissed: true, assignedByMe: true, assignee: "Priya", assignedAt: 99 },
  ];
  const h = handoversFrom(items, team);
  assert.deepEqual(h.map((x) => [x.id, x.at, x.via]), [["a:p4", 40, "alert"], ["b:p2", 30, "alert"]]);
});

test("no handovers without a team to hand to", () => {
  assert.deepEqual(handoversFrom([{ id: "a", title: "A", assignedByMe: true, assignee: "Dana Reyes" }], [team[0]]), []);
  assert.deepEqual(handoversFrom([], []), []);
});

test("phrases are cleaned, never empty, and picked the same way for the same seed", () => {
  const p = phrasesFrom({ give: ["  Go!  ", "", "Go!", "x".repeat(90)], reply: [] });
  assert.deepEqual(p.give, ["Go!", "x".repeat(60)]);
  assert.deepEqual(p.reply, DEFAULT_PHRASES.reply);
  assert.equal(pickPhrase(p.give, "a:p4"), pickPhrase(p.give, "a:p4"));
  assert.notEqual(pickPhrase(DEFAULT_PHRASES.give, "a:p4", 0), pickPhrase(DEFAULT_PHRASES.give, "a:p4", 1), "a replay says something else");
});

test("the API serves handovers on team and overview, and saves phrases", () => {
  const now = Date.UTC(2026, 10, 14, 10);
  const state = makeState(now);
  const call = (method: string, path: string, body?: any) => handle(state, { method, path: "/api/" + path, body, now });
  const t = call("GET", "team").data;
  assert.ok(t.handovers.length >= 2, "the sample team has handovers");
  assert.ok(t.handovers.every((h: any) => h.fromName && h.toName && h.title));
  assert.equal(call("GET", "overview", undefined).data.handover.id, t.handovers[0].id);

  const item = state.workspaces.main.items.find((i: any) => !i.assignee && i.status === "open");
  const sent = call("POST", `attention/${item.id}/alert`, { people: ["p3"] });
  assert.deepEqual(sent.data.watch, [`${item.id}:p3`]);
  assert.equal(call("GET", "team").data.handovers[0].id, `${item.id}:p3`, "the alert is now the newest handover");

  call("POST", "settings", { phrases: { give: ["Ship it."] } });
  const s = call("GET", "settings").data;
  assert.deepEqual(s.phrases.give, ["Ship it."]);
  assert.deepEqual(s.phrases.reply, DEFAULT_PHRASES.reply);
  call("POST", "settings", { resetPhrases: true });
  assert.equal(call("GET", "settings").data.customPhrases, false);
});

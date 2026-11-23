import { evaluate } from "../scripts/workos-routing-eval.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  initialize,
  change,
  configure,
  snapshot,
  configOf,
} from "../lib/workos/operations.ts";
import { request } from "../lib/workos/dashboard.ts";
import { draftSteps } from "../lib/workos/draft.ts";
import { validatePlan, type Plan } from "../lib/workos/plan.ts";
import {
  pin,
  progressPin,
  handoffPin,
  deadlinePin,
  type Config,
} from "../lib/workos/config.ts";

function fixture(name = "alder") {
  const c: Config = JSON.parse(
    fs.readFileSync(
      new URL("../examples/workos/" + name + ".json", import.meta.url),
      "utf8",
    ),
  );
  const db = new DatabaseSync(":memory:");
  initialize(db, c);
  const view = () => snapshot(db, configOf(db), Date.now());
  const act = (action: string, body: Record<string, unknown> = {}) =>
    change(db, c, action, { task: c.tasks[0].id, ...body });
  const api = (method: string, path: string, body = {}, query = "") =>
    request(db, "unused", method, path, new URLSearchParams(query), body);
  return { db, c, view, act, api };
}
function fresh(p: Plan) {
  const quarter = {
    ...p.quarter,
    title: "Shorten synthetic intake",
    owner: "Fixture lead",
    due: "2027-01-04",
    metric: "Intake duration",
    baseline: 18,
    target: 10,
    unit: "hours",
    source: "QA observation",
  };
  return { quarter, ...draftSteps(quarter) };
}
const mock = (week = "week") => ({
  id: "mock-intake",
  identifier: "QA-101",
  version: 1,
  title: "Examine intake",
  owner: "Fixture lead",
  week,
  due: "2026-10-10",
  state: "Todo",
});
const batch = (client: string, rev: number, issues: unknown[]) => ({
  client,
  source: "synthetic-linear/v1",
  planRevision: rev,
  issues,
});

test("a new goal creates editable dated outcomes, milestones and dependent tasks across a month boundary", () => {
  const { db, view, api } = fixture();
  const plan = fresh(view().plan);
  assert.deepEqual(
    plan.months.map((x) => x.due),
    ["2026-12-31", "2027-01-04"],
  );
  assert.equal(plan.tasks[1].after, plan.tasks[0].id);
  assert.match(plan.tasks[1].title, /Intake duration.*10 hours/);
  plan.tasks[1].title = "Verify the second observation";
  plan.tasks[1].owner = "Synthetic reviewer";
  validatePlan(plan);
  api("POST", "workos/new-plan", { plan, planRevision: 1 });
  assert.deepEqual(view().plan, plan);
  assert.equal(view().approved, false);
  assert.equal(view().queue.current, null);
  assert.throws(() => api("POST", "workos/approve", {}), /fields/);
  assert.throws(
    () => api("POST", "workos/approve", { planRevision: 1 }),
    /plan changed/,
  );
  api("POST", "workos/approve", { planRevision: 2 });
  assert.equal(view().queue.current, plan.tasks[0].id);
  assert.equal(view().approval?.principal, "alder-demo");
  assert.equal(api("GET", "workos/history").archives.length, 1);
  assert.equal(api("GET", "workos/history", {}, "revision=1").tasks.length, 2);
  const amended = structuredClone(plan);
  amended.tasks[0].owner = "New lead";
  api("POST", "workos/plan", { plan: amended, planRevision: 2 });
  assert.equal(view().approved, false);
  assert.equal(view().revision, 3);
  assert.equal(view().approval, null);
  assert.throws(
    () => api("POST", "workos/plan", { plan, planRevision: 2 }),
    /changed/,
  );
  assert.throws(
    () => api("GET", "workos/history", {}, "revision=33"),
    /not found/,
  );
  db.close();
});
test("invalid parents, cycles, deadlines, incomplete proposals, and archived task IDs fail safely", () => {
  const { db, view, api } = fixture();
  const p = fresh(view().plan);
  for (const mutate of [
    (p: Plan) => (p.tasks[0].parent = "missing"),
    (p: Plan) => (p.tasks[0].after = p.tasks[1].id),
    (p: Plan) => (p.weeks[0].due = "2028-01-01"),
    (p: Plan) => (p.quarter.baseline = p.quarter.target),
  ]) {
    const invalid = structuredClone(p);
    mutate(invalid);
    assert.throws(() =>
      api("POST", "workos/plan", { plan: invalid, planRevision: 1 }),
    );
    assert.equal(view().revision, 1);
  }
  const blank = { quarter: p.quarter, months: [], weeks: [], tasks: [] };
  api("POST", "workos/new-plan", { plan: blank, planRevision: 1 });
  assert.throws(
    () => api("POST", "workos/approve", { planRevision: 2 }),
    /Add a monthly/,
  );
  p.tasks[0].id = "measure-pilot";
  p.tasks[1].after = "measure-pilot";
  assert.throws(
    () => api("POST", "workos/plan", { plan: p, planRevision: 2 }),
    /archived plan/,
  );
  db.close();
});
test("cancelled prerequisite permits cancellation of its blocked dependent with no duplicate event", () => {
  const { db, c, view, act } = fixture();
  act("approve");
  act("cancel");
  assert.match(view().tasks[1].blocker!, /Prerequisite cancelled/);
  act("cancel", { task: c.tasks[1].id });
  act("cancel", { task: c.tasks[1].id });
  assert.equal(view().tasks[1].blocker, "Cancelled");
  assert.deepEqual(view().queue, { current: null, next: null });
  assert.equal(
    view().usage.events.filter((e) => e.stage === "cancelled").length,
    2,
  );
  db.close();
});
test("blocked dependent can instead be replanned and reapproved, including a pre-existing cancelled record", () => {
  const { db, view, act } = fixture();
  act("approve");
  db.prepare("UPDATE tasks SET cancelled=1 WHERE id=?").run("measure-pilot");
  const p = view().plan;
  p.tasks[1].after = null;
  act("plan", { plan: p, planRevision: 1 });
  assert.equal(view().approved, false);
  act("approve");
  assert.equal(view().queue.current, "repeat-check");
  db.close();
});
test("three skill revisions distinguish ambiguity, explicit choices, mixed requests and per-tool grants", () => {
  const { db, c, view, act } = fixture();
  act("approve");
  act("measure", { value: 12, reference: "qa-12" });
  const two = "Check the task deadline and prepare a handoff note";
  assert.match(act("select", { intent: two }).reason, /Multiple/);
  assert.equal(
    act("select", { intent: two, revision: handoffPin }).selected,
    handoffPin,
  );
  assert.equal(
    act("select", { intent: "Prepare a handoff note and send it" }).selected,
    null,
  );
  assert.equal(
    act("select", { intent: "prepare a handoff note", revision: pin }).selected,
    null,
  );
  configure(db, { ...c, availableTools: ["WorkOS local calendar"] });
  assert.deepEqual(
    view()
      .catalog.filter((s) => s.enabled)
      .map((s) => s.pin),
    [deadlinePin],
  );
  assert.equal(
    act("select", { intent: two, revision: deadlinePin }).selected,
    null,
  );
  assert.equal(
    act("select", { intent: "Please check the due date." }).selected,
    deadlinePin,
  );
  configure(db, { ...c, permissions: ["queue.read"] });
  assert.throws(() => act("run"), /permitted/);
  db.close();
});
test("handoff and calendar runs yield evidence receipts without advancing business metrics; stale selection fails", () => {
  for (const [rev, intent] of [
    [handoffPin, "Prepare a handoff note"],
    [deadlinePin, "Check the task deadline"],
  ]) {
    const { db, c, act, api, view } = fixture();
    act("approve");
    if (rev === handoffPin) act("measure", { value: 10, reference: "qa-10" });
    const chosen = act("select", { intent });
    assert.equal(chosen.selected, rev);
    assert.throws(
      () =>
        api("POST", "workos/run", {
          task: c.tasks[0].id,
          planRevision: 1,
          expectedRun: "old",
          expectedSkill: rev,
        }),
      /Selection changed/,
    );
    const result = act("run");
    assert.ok(result.output);
    assert.equal(result.principal, c.client);
    assert.equal(result.taskOwner, c.owner);
    assert.equal(act("run").output, result.output);
    configure(db, { ...c, enabledSkills: [] });
    assert.throws(
      () => act("verify", { reference: result.reference }),
      /permitted/,
    );
    configure(db);
    act("verify", { reference: result.reference });
    assert.equal(view().tasks[0].receipt.reviewedByPrincipal, c.client);
    assert.equal(view().tasks[0].receipt.reviewer, undefined);
    assert.equal(api("GET", "metrics").metrics[0].current, null);
    assert.equal(view().usage.perSkill.find((s) => s.pin === rev)?.verified, 1);
    const p = fresh(view().plan);
    act("new-plan", { plan: p, planRevision: 1 });
    assert.equal(view().usage.verifiedAmongExecutions, 1);
    assert.equal(
      api("GET", "workos/history", {}, "revision=1").tasks[0].receipt.output,
      result.output,
    );
    db.close();
  }
});
test("legacy owner stamps are historical labels on reads and retried runs", () => {
  const { db, view, act } = fixture();
  act("approve");
  act("select", { intent: "Check the task deadline" });
  const receipt = act("run");
  db.prepare("UPDATE tasks SET receipt=?,verified=1 WHERE id=?").run(
    JSON.stringify({
      ...receipt,
      reviewer: "Configured owner",
      operator: "Configured owner",
    }),
    "measure-pilot",
  );
  for (const r of [view().tasks[0].receipt, act("run")]) {
    assert.equal(r.reviewer, undefined);
    assert.equal(r.operator, undefined);
    assert.equal(r.reviewedByPrincipal, undefined);
    assert.equal(r.legacyOwnerLabel, "Configured owner");
  }
  db.close();
});
test("unchanged and stale issue batches are replay-safe even with an earlier plan revision", () => {
  const { db, c, act, view, api } = fixture();
  const i = mock();
  const original = batch(c.client, 1, [i]);
  assert.equal(api("POST", "workos/reconcile", original).created, 1);
  assert.equal(view().revision, 2);
  assert.equal(api("POST", "workos/reconcile", original).unchanged, 1);
  act("approve");
  const next = batch(c.client, 2, [{ ...i, version: 2, state: "Done" }]);
  assert.equal(api("POST", "workos/reconcile", next).updated, 1);
  assert.equal(view().approved, true);
  assert.equal(api("POST", "workos/reconcile", original).stale, 1);
  assert.equal(view().tasks[2].sourceIssue.state, "Done");
  assert.equal(view().tasks[2].verified, false);
  assert.equal(view().usage.executed, 0);
  assert.throws(
    () =>
      api(
        "POST",
        "workos/reconcile",
        batch(c.client, 1, [{ ...i, version: 3, title: "Fresh" }]),
      ),
    /changed/,
  );
  db.close();
});
test("three-way reconciliation preserves independent edits and rolls back a batch with conflicting data", () => {
  const { db, c, api, view } = fixture();
  const i = mock();
  const send = (issues: unknown[]) =>
    api("POST", "workos/reconcile", batch(c.client, view().revision, issues));
  send([i]);
  let p = view().plan;
  p.tasks[2].owner = "Local lead";
  api("POST", "workos/plan", { plan: p, planRevision: 2 });
  send([{ ...i, version: 2, title: "Source fix" }]);
  assert.equal(view().tasks[2].owner, "Local lead");
  assert.equal(view().tasks[2].title, "Source fix");
  const before = view();
  const extra = { ...i, id: "mock-extra", identifier: "QA-102" };
  assert.throws(
    () => send([extra, { ...i, version: 3, owner: "Competing lead" }]),
    /Concurrent/,
  );
  assert.deepEqual(view().tasks, before.tasks);
  assert.equal(view().revision, before.revision);
  assert.throws(
    () => send([{ ...i, version: 2, title: "Different" }]),
    /same source version/,
  );
  assert.throws(() => send([extra, extra]), /Duplicate/);
  assert.throws(
    () => send([{ ...extra, week: "foreign-week" }]),
    /destination week/,
  );
  assert.throws(() => send([{ ...extra, version: 0 }]), /Invalid synthetic/);
  assert.throws(
    () =>
      api(
        "POST",
        "workos/reconcile",
        batch("birch-demo", before.revision, [extra]),
      ),
    /different installation/,
  );
  db.close();
});
test("installation grants gate planner and reconciliation endpoints and ignore no unknown action fields", () => {
  const { db, api, view } = fixture("birch");
  const endpoints = api("GET", "").endpoints.map((e) => e.path);
  for (const action of ["plan", "new-plan", "reconcile"]) {
    assert.ok(!endpoints.includes("/api/workos/" + action));
    assert.throws(() => api("POST", "workos/" + action, {}), /disabled/);
  }
  assert.throws(
    () => api("POST", "decisions/:id", { outcome: "sample" }),
    /unavailable/,
  );
  assert.throws(() => api("GET", "workos", {}, "days=7&days=30"), /Duplicate/);
  assert.throws(
    () =>
      api("POST", "workos/approve", {
        planRevision: 1,
        reviewer: "Other person",
      }),
    /fields/,
  );
  assert.equal(view().approved, false);
  db.close();
});

test("migrated event identifiers preserve idempotent selections", () => {
  const { db, act, view } = fixture();
  act("approve");
  act("measure", { value: 13, reference: "old-13" });
  act("select", { intent: "Review goal progress" });
  db.exec(
    "UPDATE events SET id=run || '.' || stage WHERE stage IN ('suggested','selected')",
  );
  act("select", { intent: "Review goal progress" });
  assert.equal(view().usage.suggested, 1);
  assert.equal(view().usage.selected, 1);
  db.close();
});
test("source mappings and grant revocation are installation-specific", () => {
  const alder = fixture(),
    birch = fixture("birch");
  configure(birch.db, {
    ...birch.c,
    permissions: [...birch.c.permissions, "fixture.import"],
  });
  for (const f of [alder, birch])
    f.api("POST", "workos/reconcile", batch(f.c.client, 1, [mock()]));
  const a = alder.view().tasks[2],
    b = birch.view().tasks[2];
  assert.notEqual(a.id, b.id);
  assert.throws(
    () => birch.api("POST", "workos/cancel", { task: a.id, planRevision: 2 }),
    /not found/,
  );
  configure(alder.db, { ...alder.c, permissions: [] });
  assert.throws(
    () =>
      alder.api("POST", "workos/reconcile", batch(alder.c.client, 2, [mock()])),
    /disabled/,
  );
  assert.throws(
    () =>
      alder.api("POST", "workos/plan", {
        plan: alder.view().plan,
        planRevision: 2,
      }),
    /disabled/,
  );
  for (const f of [alder, birch]) f.db.close();
});

test("evaluate all routing cases against expected selection and a constrained example-only baseline", () => {
  const result = evaluate();
  assert.equal(result.router.correct, result.router.cases);
  assert.equal(result.router.wrongSelection, 0);
  assert.ok(result.router.correct > result.exampleLookup.correct);
});
test("catalogue upgrade, deprecation and rollback preserve historic pins and local outcome semantics", () => {
  const f = fixture();
  const { db, c, view, act, api } = f;
  act("approve");
  configure(db, {
    ...c,
    enabledSkills: [pin, progressPin],
    deprecatedSkills: [pin],
  });
  assert.equal(view().catalog.find((s) => s.pin === pin)?.deprecated, true);
  act("measure", { value: 18, reference: "upgrade-18" });
  assert.equal(
    act("select", { intent: "Review goal progress", revision: pin }).selected,
    null,
  );
  assert.equal(
    act("select", { intent: "Calculate target progress" }).selected,
    progressPin,
  );
  assert.equal(
    view().tasks[0].routing.permissions.includes("goals.read"),
    true,
  );
  assert.equal(act("run").progressPercent, 50);
  act("verify", { reference: "upgrade-18" });
  configure(db);
  assert.equal(view().tasks[0].receipt.revision, progressPin);
  assert.equal(api("GET", "metrics").metrics[0].current, 18);
  assert.equal(view().rollups.week.observed, 18);
  assert.equal(view().rollups.month.verified, 1);
  act("measure", { task: "repeat-check", value: 15, reference: "original-15" });
  assert.equal(
    act("select", { task: "repeat-check", intent: "Review goal progress" })
      .selected,
    pin,
  );
  assert.equal(view().usage.trend.at(-1).distinctSkills, 1);
  assert.ok(
    view().usage.blockedReasons.some(
      (r) => r.reason === "Revision or permissions unavailable",
    ),
  );
  assert.ok(
    !JSON.stringify(view().tasks[0].routing).includes(
      "Calculate target progress",
    ),
  );
  db.close();
});

test("a newly generated plan reaches its own measured outcome and retains the previous quarter in history", () => {
  const { api, view, act, db } = fixture();
  const p = fresh(view().plan);
  api("POST", "workos/new-plan", { plan: p, planRevision: 1 });
  act("approve");
  for (const [i, t] of p.tasks.entries()) {
    const reference = "intake-" + i,
      value = i === 0 ? 18 : 11;
    act("measure", { task: t.id, value, reference });
    const selection = act("select", {
      task: t.id,
      intent: "Review goal progress",
    });
    const guard = {
      task: t.id,
      expectedRun: selection.run,
      expectedSkill: selection.selected,
      planRevision: 2,
    };
    const output = api("POST", "workos/run", guard);
    assert.equal(output.unit, "hours");
    assert.equal(output.target, 10);
    api("POST", "workos/verify", { ...guard, reference });
    assert.equal(api("GET", "metrics").metrics[0].current, value);
  }
  assert.equal(view().queue.current, null);
  assert.equal(view().rollups[p.weeks[1].id].observed, 11);
  assert.equal(
    api("GET", "workos/history", {}, "revision=1").plan.quarter.title,
    "Reduce review turnaround",
  );
  db.close();
});

test("dependency dates apply to new goals, edits, approvals, installations and source reconciliation", () => {
  const { db, c, view, api, act } = fixture();
  const p = view().plan;
  p.tasks[0].due = "2026-12-30";
  p.tasks[1].due = "2026-12-01";
  const incompatible = /before its prerequisite/;
  assert.throws(() => validatePlan(p), incompatible);
  assert.throws(
    () => api("POST", "workos/plan", { plan: p, planRevision: 1 }),
    incompatible,
  );
  assert.throws(
    () => api("POST", "workos/new-plan", { plan: p, planRevision: 1 }),
    incompatible,
  );
  const freshDb = new DatabaseSync(":memory:");
  assert.throws(
    () =>
      initialize(freshDb, {
        ...c,
        tasks: c.tasks.map((t, i) => ({ ...t, due: p.tasks[i].due })),
      }),
    incompatible,
  );
  freshDb.close();
  // Simulate a hierarchy saved by the earlier release. The owner can still open and repair it.
  db.prepare("UPDATE plan SET document=?").run(JSON.stringify(p));
  assert.equal(view().scheduleConflicts.length, 1);
  assert.throws(() => act("approve"), incompatible);
  p.tasks[1].due = p.tasks[0].due;
  act("plan", { plan: p, planRevision: 1 });
  act("approve");
  const issue = { ...mock(), due: "2026-12-30" };
  api("POST", "workos/reconcile", batch(c.client, 2, [issue]));
  const mapped = view().plan;
  mapped.tasks.push({
    id: "dependent",
    title: "Review receipt",
    owner: c.owner,
    parent: "week",
    due: "2026-12-30",
    after: mapped.tasks[2].id,
  });
  act("plan", { planRevision: 3, plan: mapped });
  assert.throws(
    () =>
      api(
        "POST",
        "workos/reconcile",
        batch(c.client, 4, [{ ...issue, version: 2, due: "2026-12-31" }]),
      ),
    incompatible,
  );
  assert.equal(view().tasks[2].sourceIssue.version, 1);
  assert.equal(view().approved, false);
  db.close();
});
test("cancelling a legacy date conflict preserves evidence and allows unrelated replanning", () => {
  const { db, api, view, act } = fixture();
  const p = view().plan;
  p.tasks[0].due = "2026-12-30";
  db.prepare("UPDATE plan SET document=?").run(JSON.stringify(p));
  act("cancel", { task: p.tasks[1].id });
  p.quarter.title = "Replan remaining work";
  act("plan", { plan: p, planRevision: 1 });
  act("approve");
  assert.equal(view().tasks[1].blocker, "Cancelled");
  assert.equal(view().scheduleConflicts.length, 1);
  const next = fresh(p);
  api("POST", "workos/new-plan", { plan: next, planRevision: 2 });
  assert.equal(view().scheduleConflicts.length, 0);
  assert.equal(
    api("GET", "workos/history", {}, "revision=2").tasks[1].blocker,
    "Cancelled",
  );
  db.close();
});

test("explicit skill-record opens require the reviewed pin and run, deduplicate and preserve execution counts", () => {
  const { db, c, api, view } = fixture();
  const task = c.tasks[0].id;
  api("POST", "workos/approve", { planRevision: 1 });
  const choice = api("POST", "workos/select", {
    task,
    intent: "Check the task deadline",
    planRevision: 1,
  });
  const fields = {
    task,
    planRevision: 1,
    expectedRun: choice.run,
    expectedSkill: deadlinePin,
  };
  assert.throws(
    () => api("POST", "workos/read-skill", { ...fields, expectedRun: "stale" }),
    /changed/,
  );
  const record = api("POST", "workos/read-skill", fields);
  assert.equal(record.pin, deadlinePin);
  assert.ok(record.inputs);
  assert.ok(record.permissions.length);
  api("POST", "workos/read-skill", fields);
  assert.equal(view().usage.opened, 1);
  assert.equal(view().usage.executed, 0);
  configure(db, { ...c, permissions: [] });
  assert.throws(() => api("POST", "workos/read-skill", fields), /permitted/);
  assert.equal(view().usage.opened, 1);
  db.close();
});

test("calendar-wide planning covers actual month ends and Sundays without inventing a measurement", () => {
  const { db, view } = fixture();
  const q = {
    ...view().plan.quarter,
    title: "Quarterly intake review",
    owner: "Team lead",
    due: "2028-03-31",
    source: "Synthetic counters",
  };
  let runs = 0,
    seq = 0;
  for (const [start, end] of [
    ["2028-01-01", "2028-03-31"],
    ["2027-12-15", "2028-03-15"],
    ["2028-02-29", "2028-02-29"],
    ["0000-01-01", "0000-01-02"],
  ]) {
    const part = draftSteps({ ...q, due: end }, () => "node-" + ++seq, start);
    validatePlan({ quarter: { ...q, due: end }, ...part });
    const dates = part.tasks.map((r) => r.due);
    assert.equal(dates[0], start);
    assert.equal(dates.at(-1), end);
    assert.ok(part.tasks.every((t) => t.owner === q.owner));
    assert.ok(part.tasks.slice(1).every((t) => t.after === part.tasks[0].id));
    assert.equal(part.tasks[0].after, null);
    assert.equal(
      new Set(part.months.map((m) => m.due.slice(0, 7))).size,
      part.months.length,
    );
    if (start === "2028-01-01") {
      assert.deepEqual(
        part.months.map((m) => m.due),
        ["2028-01-31", "2028-02-29", "2028-03-31"],
      );
      assert.deepEqual(dates, [
        start,
        "2028-01-02",
        "2028-01-09",
        "2028-01-16",
        "2028-01-23",
        "2028-01-30",
        "2028-01-31",
        "2028-02-06",
        "2028-02-13",
        "2028-02-20",
        "2028-02-27",
        "2028-02-29",
        "2028-03-05",
        "2028-03-12",
        "2028-03-19",
        "2028-03-26",
        end,
      ]);
    }
    runs++;
  }
  assert.equal(runs, 4);
  assert.throws(() => draftSteps(q, undefined, "2027-10-01"), /92 calendar/);
  assert.throws(() => draftSteps(q, undefined, "2028-04-01"), /92 calendar/);
  assert.throws(() => draftSteps(q, undefined, "2028-02-30"), /92 calendar/);
  assert.throws(() => draftSteps({ ...q, due: "2028-02-30" }), /quarterly/);
  db.close();
});

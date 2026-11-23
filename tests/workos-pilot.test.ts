import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { draftSteps, type PilotApproach } from "../lib/workos/draft.ts";
import { seedPlan, validatePlan } from "../lib/workos/plan.ts";
import { pin, type Config } from "../lib/workos/config.ts";
import { request } from "../lib/workos/dashboard.ts";
import { configure, initialize } from "../lib/workos/operations.ts";
import { evaluateContract } from "../scripts/workos-routing-contract.mjs";

const config: Config = JSON.parse(
  readFileSync(
    new URL("../examples/workos/alder.json", import.meta.url),
    "utf8",
  ),
);
const quarter = { ...seedPlan(config).quarter, due: "2028-03-31" };
const pilot = {
  approach: "turnaround" as PilotApproach,
  scope: "intake review",
  change: "assign one reviewer at intake",
};
function proposal(approach = pilot.approach, start = "2028-01-01") {
  let sequence = 0;
  return {
    quarter,
    ...draftSteps(quarter, () => "pilot-" + ++sequence, start, {
      ...pilot,
      approach,
    }),
  };
}
function fixture() {
  const db = new DatabaseSync(":memory:");
  initialize(db, config);
  const api = (path: string, body?: Record<string, unknown>) =>
    request(db, ".", body ? "POST" : "GET", path, new URLSearchParams(), body);
  return { db, api };
}
test("each operational goal has distinct work products, criteria, ordered dependencies and independent editable owners", () => {
  const titles = new Set();
  for (const approach of ["turnaround", "conversion", "quality"] as const) {
    for (const start of ["2028-01-01", "2028-02-29", "2028-03-27"]) {
      const plan = validatePlan(proposal(approach, start));
      assert.equal(plan.tasks.length, 5);
      assert.deepEqual(
        plan.tasks.map((t) => t.evidence?.kind),
        [
          "observation",
          "deliverable",
          "deliverable",
          "deliverable",
          "observation",
        ],
      );
      assert.equal(plan.tasks[0].due, start);
      assert.equal(plan.tasks[4].due, plan.quarter.due);
      for (const [i, t] of plan.tasks.entries()) {
        assert.equal(t.after, i ? plan.tasks[i - 1].id : null);
        if (i) assert.ok(t.due > plan.tasks[i - 1].due);
        if (t.evidence?.kind === "deliverable") {
          assert.ok(
            t.title.includes(pilot.scope) &&
              t.evidence.criterion.includes(pilot.scope),
          );
          titles.add(t.evidence.criterion);
        }
      }
      assert.ok(plan.tasks[2].title.includes(pilot.change));
      plan.tasks[2].owner = "Trial owner";
      assert.equal(validatePlan(plan).tasks[2].owner, "Trial owner");
    }
  }
  assert.equal(titles.size, 9);
});
test("bad pilot parameters and malformed evidence definitions fail before plan replacement", () => {
  assert.throws(() => proposal("quality", "2028-03-28"), /five calendar/);
  for (const p of [
    { ...pilot, scope: "" },
    { ...pilot, change: "z".repeat(45) },
    { ...pilot, approach: "other" },
  ])
    assert.throws(
      () => draftSteps(quarter, undefined, "2028-01-01", p as typeof pilot),
      /pilot approach/,
    );
  const { db, api } = fixture();
  try {
    for (const evidence of [
      null,
      {},
      { kind: "deliverable", criterion: "" },
      { kind: "observation", extra: true },
      { kind: "other" },
    ]) {
      const plan = proposal();
      Object.assign(plan.tasks[0], { evidence });
      assert.throws(
        () => api("workos/new-plan", { plan, planRevision: 1 }),
        /work product/,
      );
      assert.equal(api("workos").revision, 1);
    }
  } finally {
    db.close();
  }
});
test("pilot execution enforces proof type and stale evidence, releases dependencies once, and separates task and skill outcomes", () => {
  const { db, api } = fixture();
  try {
    const plan = proposal();
    api("workos/new-plan", { plan, planRevision: 1 });
    const go = (name: string, id: string, data: Record<string, unknown> = {}) =>
      api("workos/" + name, { planRevision: 2, task: id, ...data });
    const measure = (index: number, value: number, reference: string) => {
      const id = plan.tasks[index].id;
      go("measure", id, { value, reference });
      const choice = go("select", id, { intent: "Review goal progress" });
      assert.equal(choice.selected, pin);
      const guard = { expectedRun: choice.run, expectedSkill: pin };
      go("run", id, guard);
      go("verify", id, { ...guard, reference });
    };
    const [baseline, diagnosis, design, trial, final] = plan.tasks;
    assert.throws(
      () =>
        go("submit-work", diagnosis.id, {
          expectedRun: null,
          summary: "A sample",
          reference: "work-01",
        }),
      /Approve/,
    );
    api("workos/approve", { planRevision: 2 });
    assert.equal(
      go("select", baseline.id, { intent: "Check the task deadline" }).selected,
      null,
    );
    assert.throws(
      () =>
        go("submit-work", baseline.id, {
          expectedRun: null,
          summary: "A sample",
          reference: "work-01",
        }),
      /work-product task/,
    );
    measure(0, 24, "base-01");
    const before = api("workos").usage;
    assert.throws(
      () => go("measure", diagnosis.id, { value: 100, reference: "fake-01" }),
      /submission/,
    );
    assert.throws(
      () => go("select", diagnosis.id, { intent: "Check the task deadline" }),
      /submission/,
    );
    assert.throws(
      () =>
        go("submit-work", diagnosis.id, {
          expectedRun: null,
          summary: "",
          reference: "valid-01",
        }),
      /Describe/,
    );
    const evidence = {
      expectedRun: null,
      summary: "Sample records waiting at assignment.",
      reference: "trial-01",
    };
    const first = go("submit-work", diagnosis.id, evidence);
    assert.deepEqual(go("submit-work", diagnosis.id, evidence), first);
    assert.throws(() => go("submit-work", design.id, evidence), /dependency/);
    const revised = go("submit-work", diagnosis.id, {
      ...evidence,
      expectedRun: first.run,
      reference: "trial-02",
    });
    assert.notEqual(revised.run, first.run);
    assert.throws(() => go("submit-work", diagnosis.id, evidence), /changed/);
    assert.throws(
      () =>
        go("review-work", diagnosis.id, {
          expectedRun: first.run,
          reference: "trial-01",
        }),
      /current work/,
    );
    assert.throws(
      () =>
        go("review-work", diagnosis.id, {
          expectedRun: revised.run,
          reference: "trial-01",
        }),
      /current work/,
    );
    for (let i = 0; i < 2; i++)
      go("review-work", diagnosis.id, {
        expectedRun: revised.run,
        reference: "trial-02",
      });
    assert.throws(
      () =>
        go("submit-work", diagnosis.id, {
          ...evidence,
          expectedRun: revised.run,
        }),
      /changed/,
    );
    for (const t of [design, trial]) {
      const r = go("submit-work", t.id, {
        expectedRun: null,
        summary: t.title,
        reference: t.id,
      });
      go("review-work", t.id, { expectedRun: r.run, reference: t.id });
    }
    const after = api("workos");
    assert.equal(after.queue.current, final.id);
    assert.equal(after.tasks.filter((t: any) => t.verified).length, 4);
    for (const key of [
      "suggested",
      "selected",
      "opened",
      "loaded",
      "executed",
      "verified",
    ])
      assert.equal(after.usage[key], before[key]);
    assert.equal(after.tasks[2].value, null);
    measure(4, 18, "final-01");
    const result = api("workos");
    assert.equal(result.queue.current, null);
    assert.equal(result.usage.executed, 2);
    assert.equal(result.usage.verified, 2);
    assert.equal(result.rollups[result.plan.weeks.at(-1).id].observed, 18);
    const exported = api("export");
    assert.ok(JSON.stringify(exported).includes("trial-02"));
  } finally {
    db.close();
  }
});
test("recording requires an explicit install grant and an eligible measurement revision to approve", () => {
  const { db, api } = fixture(),
    plan = proposal();
  try {
    configure(db, {
      ...config,
      permissions: config.permissions.filter((x) => x !== "work.record"),
    });
    assert.ok(
      !api("").endpoints.some((e: any) => e.path.endsWith("submit-work")),
    );
    assert.throws(
      () => api("workos/new-plan", { plan, planRevision: 1 }),
      /installation grant/,
    );
    configure(db, config);
    api("workos/new-plan", { plan, planRevision: 1 });
    configure(db, { ...config, enabledSkills: [] });
    assert.throws(
      () => api("workos/approve", { planRevision: 2 }),
      /goal measurement/,
    );
    configure(db, config);
    api("workos/approve", { planRevision: 2 });
    configure(db, { ...config, enabledSkills: [] });
    assert.match(api("workos").tasks[0].blocker, /goal measurement/);
  } finally {
    db.close();
  }
});
test("a submitted work product can be cancelled before review and its dependent can be replanned", () => {
  const { db, api } = fixture();
  try {
    const plan = proposal();
    plan.tasks = plan.tasks.slice(1, 3);
    plan.tasks[0].after = null;
    api("workos/new-plan", { plan, planRevision: 1 });
    api("workos/approve", { planRevision: 2 });
    const id = plan.tasks[0].id;
    const receipt = api("workos/submit-work", {
      task: id,
      planRevision: 2,
      reference: "sample-01",
      summary: "Synthetic draft sample",
      expectedRun: null,
    });
    api("workos/cancel", { task: id, planRevision: 2 });
    const state = api("workos");
    assert.equal(state.tasks[0].receipt.reference, "sample-01");
    assert.equal(state.tasks[0].verified, false);
    assert.match(state.tasks[1].blocker, /Prerequisite cancelled/);
    assert.throws(
      () =>
        api("workos/review-work", {
          task: id,
          planRevision: 2,
          reference: "sample-01",
          expectedRun: receipt.run,
        }),
      /Approve/,
    );
    plan.tasks[1].after = null;
    api("workos/plan", { plan, planRevision: 2 });
    api("workos/approve", { planRevision: 3 });
    assert.equal(api("workos").queue.current, plan.tasks[1].id);
  } finally {
    db.close();
  }
});
test("frozen contract evaluation accounts for every expected decision and reports capability and permission errors separately", () => {
  const r = evaluateContract();
  assert.equal(r.requestCount * r.profileCount, 168);
  assert.equal(
    new Set(r.rows.map((row: any) => row.profile + "/" + row.id)).size,
    168,
  );
  for (const key of ["router", "exampleLookup"] as const) {
    const v = r[key];
    assert.equal(v.matched + v.missed + v.wrongPin, v.positive);
    assert.equal(
      v.correctDeclines + v.unexpectedSelection,
      v.requiredAbstentions,
    );
    assert.equal(v.positive + v.requiredAbstentions, v.cases);
  }
  // Keep the historical answer key intact. It required abstention even for an
  // explicit comparison with both goal revisions installed. The new contract
  // routes those requests specifically to 1.0.0; inspect every disagreement.
  const changed = r.rows.filter(
    (row: any) => row.expected === null && row.actual !== null,
  );
  assert.ok(changed.length > 0);
  for (const row of changed) {
    assert.equal(row.profile, "two-revisions");
    assert.ok(["R03", "R05"].includes(row.id));
    assert.equal(row.actual, "workos.goal-checkin@1.0.0");
  }
  assert.equal(r.router.unexpectedSelection, changed.length);
  assert.equal(r.router.wrongPin, 0);
  assert.equal(r.byGroup.natural.router.positive, 39);
  assert.equal(r.byProfile["no-write"].router.matched, 0);
});

test("plan replacement updates the named metric used by the live selection endpoint; matching creates no receipt", () => {
  const { db, api } = fixture();
  try {
    const plan = proposal();
    plan.quarter = { ...plan.quarter, metric: "Defect rate", unit: "points" };
    api("workos/new-plan", { planRevision: 1, plan });
    api("workos/approve", { planRevision: 2 });
    const task = plan.tasks[0].id,
      context = { task, planRevision: 2 };
    api("workos/measure", { ...context, value: 13, reference: "scope-13" });
    const previous = api("workos/select", {
      ...context,
      intent: "Compare our measured review turnaround to the target",
    });
    assert.equal(previous.selected, null);
    const current = api("workos/select", {
      ...context,
      intent: "Compare our measured defect rate to the target",
    });
    assert.equal(current.selected, pin);
    const scoped = "Put the current value next to the baseline in ";
    assert.equal(
      api("workos/select", { ...context, intent: scoped + "hours" }).selected,
      null,
    );
    assert.equal(
      api("workos/select", { ...context, intent: scoped + "points" }).selected,
      pin,
    );
    assert.equal(api("workos").tasks[0].receipt, null);
    assert.equal(api("workos").usage.executed, 0);
  } finally {
    db.close();
  }
});

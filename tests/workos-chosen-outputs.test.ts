import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { request } from "../lib/workos/dashboard.ts";
import { configOf, configure, initialize } from "../lib/workos/operations.ts";
import {
  catalogue,
  deadlinePin,
  handoffPin,
  pin,
  progressPin,
  type Config,
} from "../lib/workos/config.ts";
import { projectedOutput } from "../lib/workos/output-projection.ts";
import { selectSkill } from "../lib/workos/routing.ts";

function harness(goal?: Partial<Config["goal"]>) {
  const c: Config = JSON.parse(
    readFileSync(
      new URL("../examples/workos/alder.json", import.meta.url),
      "utf8",
    ),
  );
  Object.assign(c.goal, goal);
  c.enabledSkills = catalogue.map((entry) => entry.pin);
  const db = new DatabaseSync(":memory:");
  initialize(db, c);
  const task = c.tasks[0].id;
  const read = (route = "workos") =>
    request(db, ".", "GET", route, new URLSearchParams());
  const post = (action: string, fields: Record<string, unknown> = {}) =>
    request(db, ".", "POST", "workos/" + action, new URLSearchParams(), {
      ...(action === "approve" ? {} : { task }),
      planRevision: 1,
      ...fields,
    });
  const state = () => read().tasks[0];
  const choose = (revisions: unknown, expectedRun = state().run) =>
    post("choose-output", { revisions, expectedRun });
  const current = () => ({
    expectedRun: state().run,
    expectedSkill: state().selected,
  });
  return { c, db, read, post, state, choose, current, task };
}

test("typed projections bind safe task fields to an explicit local result", () => {
  const { c } = harness();
  const fields: [string, string][] = [
    ["Using the reading and our target, how far apart are they?", pin],
    [
      "Give me the difference between our Review turnaround and our baseline",
      pin,
    ],
    [
      "Given our starting point and our target, what share of that distance have we covered?",
      progressPin,
    ],
    [
      "Using our baseline, current reading and our target, give me the fraction covered",
      progressPin,
    ],
    ["I was hoping to understand how far apart the planets are", ""],
    [
      "We need two outputs: how many days are left and draft an evidence handoff",
      "",
    ],
    ["Considering nothing", ""],
    [
      "Given today's date and the due date, how many calendar days are left?",
      deadlinePin,
    ],
    [
      "Prepare a short local note using the findings and the reviewer",
      handoffPin,
    ],
  ];
  for (const [input, revision] of fields) {
    const result = selectSkill(c, input, undefined, true);
    assert.equal(result.selected, revision || null, input);
  }
  assert.deepEqual(
    projectedOutput(
      "using the send payroll and target, how far apart are they",
      "send payroll",
    ),
    [],
  );
  const mixed = selectSkill(
    c,
    "We need two outputs: how many days are left and draft an evidence handoff",
    undefined,
    true,
  );
  assert.deepEqual(
    new Set(mixed.alternatives),
    new Set([deadlinePin, handoffPin]),
  );
  assert.equal(mixed.requiresChoice, true);
  const missing = selectSkill(
    { ...c, enabledSkills: [deadlinePin] },
    "We need two outputs: how many days are left and draft an evidence handoff",
    undefined,
    true,
  );
  assert.deepEqual(missing.alternatives, []);
  assert.equal(missing.selected, null);
  for (const text of [
    "given the owner's salary and target, how far apart are they",
    "use the reading and the target, compare them and email the answer",
    "using the target to baseline, what share of that distance have we covered",
    "using the baseline and target and owner, what fraction is covered",
    "count the days using the due date to today",
    "using the due date and last year, how many days apart",
    "give me the ratio between the reading and target",
    "using the reading and another client's target, how far apart are they",
    "prepare a note using evidence and its owner unless someone changes the deadline",
  ])
    assert.deepEqual(projectedOutput(text, c.goal.metric), [], text);
});

test("a declined request can be replaced by an explicit multi-output decision, then actually run and verified once", () => {
  const { db, c, read, post, state, choose, current, task } = harness();
  post("approve");
  post("measure", { value: 15, reference: "pilot-proof" });
  const miss = post("select", { intent: "Send the results to a contractor" });
  assert.equal(miss.selected, null);
  const picked = choose([deadlinePin, progressPin, handoffPin]);
  assert.equal(picked.method, "operator");
  assert.equal(picked.selected, deadlinePin);
  assert.deepEqual(picked.alternatives, []);
  assert.deepEqual(state().routing.revisions, [
    deadlinePin,
    progressPin,
    handoffPin,
  ]);
  assert.equal(read().usage.operatorChosen, 3);
  assert.equal(read().usage.suggested, 0);
  assert.equal(read().usage.executed, 0);
  const request = current();
  const docs = post("read-skill", request);
  assert.equal(docs.additionalRecords.length, 2);
  assert.equal(read().usage.opened, 3);
  assert.equal(read().usage.executed, 0);
  const result = post("run", request);
  assert.deepEqual(post("run", request), result);
  assert.equal(result.additional[0].progressPercent, 75);
  assert.equal(result.additional[0].observedMinusTarget, 3);
  assert.match(result.additional[1].output, /pilot-proof/);
  assert.equal(read().usage.executed, 3);
  assert.equal(read("metrics").metrics[0].current, null);
  assert.equal(state().verified, false);
  assert.throws(
    () => post("verify", { ...request, reference: task }),
    /each additional output/,
  );
  assert.throws(
    () =>
      post("verify", {
        ...request,
        reference: task,
        additionalReferences: ["pilot-proof", "wrong"],
      }),
    /each additional/,
  );
  assert.equal(read().usage.verified, 0);
  configure(db, {
    ...c,
    enabledSkills: c.enabledSkills.filter((p) => p !== handoffPin),
  });
  assert.throws(
    () =>
      post("verify", {
        ...request,
        reference: task,
        additionalReferences: ["pilot-proof", "pilot-proof"],
      }),
    /permitted/,
  );
  configure(db, c);
  const approval = {
    ...request,
    reference: task,
    additionalReferences: ["pilot-proof", "pilot-proof"],
  };
  post("verify", approval);
  post("verify", approval);
  assert.equal(read().usage.verified, 3);
  assert.equal(read().usage.verifiedAmongExecutions, 3);
  assert.equal(read("metrics").metrics[0].current, 15);
  assert.equal(state().receipt.additional[0].reviewedByPrincipal, c.client);
  assert.equal(read().usage.suggested, 0);
  assert.equal(read().usage.operatorChosen, 3);
  assert.equal(JSON.stringify(read("export")).includes("contractor"), false);
  db.close();
});

test("structured input uses all-or-nothing policy and current task state across revisions, goals and evidence", () => {
  const { db, c, post, choose, state, current, read } = harness();
  assert.throws(() => choose([deadlinePin]), /Approve/);
  post("approve");
  assert.throws(
    () => choose([deadlinePin, handoffPin]),
    /Save the measurement/,
  );
  assert.equal(state().selected, null);
  const prior = choose([deadlinePin]);
  post("measure", { value: 13, reference: "qa-13" });
  assert.throws(() => choose([pin], prior.run), /Selection changed/);
  for (const bad of [[], [pin, pin], {}, [42], "all"])
    assert.throws(() => choose(bad), /distinct output/);
  for (const revisions of [[deadlinePin, "admin"], ["external.dispatch"]])
    assert.throws(() => choose(revisions), /unavailable/);
  assert.throws(
    () =>
      post("choose-output", {
        expectedRun: state().run,
        intent: "bypass",
        revisions: [pin],
      }),
    /Invalid or missing/,
  );
  assert.throws(
    () =>
      post("choose-output", {
        expectedRun: state().run,
        revisions: [pin],
        planRevision: 0,
      }),
    /changed/,
  );
  choose([pin, deadlinePin]);
  const stale = current();
  choose([pin, handoffPin]);
  assert.throws(() => post("run", stale), /Selection changed/);
  configure(db, {
    ...c,
    permissions: c.permissions.filter((g) => g !== "evidence.read"),
  });
  assert.throws(() => choose([pin, handoffPin]), /unavailable/);
  assert.equal(state().selected, null);
  assert.equal(read().usage.executed, 0);
  const next = { ...configOf(db), deprecatedSkills: [pin] };
  configure(db, next);
  assert.throws(() => choose([pin]), /unavailable/);
  assert.equal(choose([progressPin]).selected, progressPin);
  db.close();
});

test("failed compound calculation retains attempted invocations and never verifies a partial output", () => {
  const { db, c, post, choose, read, state, current } = harness();
  post("approve");
  post("measure", { value: Number.MAX_VALUE, reference: "range-test" });
  choose([deadlinePin, progressPin, handoffPin]);
  assert.throws(() => post("run", current()), /calculator range/);
  assert.equal(state().receipt, null);
  assert.equal(read().usage.executed, 2);
  assert.equal(read().usage.failed, 1);
  assert.throws(() => post("run", current()), /calculator range/);
  assert.equal(read().usage.executed, 2);
  assert.equal(read().usage.verified, 0);
  assert.throws(
    () => post("verify", { ...current(), reference: c.tasks[0].id }),
    /Run the selected skill/,
  );
  post("measure", { value: 18, reference: "corrected" });
  choose([deadlinePin, progressPin, handoffPin]);
  post("run", current());
  assert.equal(read().usage.executed, 5);
  assert.equal(read().usage.retries, 1);
  assert.equal(read().usage.verified, 0);
  db.close();
});

test("target-gap display derives from each captured reading, including older receipts, with honest range limits", () => {
  for (const [value, gap] of [
    [15, 3],
    [10, -2],
    [12, 0],
  ]) {
    const { post, choose, state, current, db } = harness();
    post("approve");
    post("measure", { value, reference: "gap-proof" });
    choose([pin]);
    assert.equal(post("run", current()).observedMinusTarget, gap);
    const stored = JSON.parse(
      String(
        db.prepare("SELECT receipt FROM tasks WHERE id=?").get(state().id)
          ?.receipt,
      ),
    );
    assert.equal(Object.hasOwn(stored, "observedMinusTarget"), false);
    assert.equal(state().receipt.observedMinusTarget, gap);
    db.close();
  }
  const { post, choose, current, state, db } = harness({
    baseline: 0,
    target: -Number.MAX_VALUE,
  });
  post("approve");
  post("measure", { value: Number.MAX_VALUE, reference: "extreme-gap" });
  choose([pin]);
  assert.equal(post("run", current()).observedMinusTarget, null);
  assert.equal(state().receipt.observed, Number.MAX_VALUE);
  db.close();
});

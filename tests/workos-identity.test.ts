import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import {
  initialize,
  transaction,
  change,
  configOf,
} from "../lib/workos/operations.ts";
import { loadProcedure } from "../lib/workos/procedures.ts";
import { request } from "../lib/workos/dashboard.ts";
import {
  addMember,
  setMemberRole,
  authenticate,
  credentialDigest,
} from "../lib/workos/identity.ts";
const secrets = {
  owner: "x".repeat(43),
  viewer: "1".repeat(64),
  reviewer: "2".repeat(64),
  worker: "3".repeat(64),
};
function fixture(name = "alder") {
  const c = JSON.parse(
    fs.readFileSync(
      new URL("../examples/workos/" + name + ".json", import.meta.url),
      "utf8",
    ),
  );
  const db = new DatabaseSync(":memory:");
  initialize(db, c);
  const login = (p: string, s: string) =>
    authenticate(
      db,
      c.client,
      credentialDigest(c.client, secrets.owner),
      "Basic " + Buffer.from(p + ":" + s).toString("base64"),
    );
  const issue = (n: string, role: string, s: string) =>
    transaction(db, () => addMember(db, c.client, n, role, s));
  const enter = (k: "viewer" | "reviewer" | "worker") =>
    login(c.client + "/" + k, secrets[k])!;
  const api = (
    actor: ReturnType<typeof enter>,
    path: string,
    body?: Record<string, unknown>,
  ) =>
    request(
      db,
      "unused",
      body ? "POST" : "GET",
      path,
      new URLSearchParams(),
      body ?? {},
      actor,
    );
  issue("viewer", "viewer", secrets.viewer);
  issue("reviewer", "reviewer", secrets.reviewer);
  issue("worker", "operator", secrets.worker);
  return { db, c, login, issue, enter, api };
}
test("installation-specific principals reject foreign credentials and preserve the existing operator; retries retain the verifier", () => {
  const a = fixture(),
    b = fixture("birch");
  assert.equal(a.login(a.c.client, secrets.owner)?.principal, a.c.client);
  assert.equal(a.login(a.c.client + "/viewer", secrets.reviewer), null);
  assert.equal(b.login(a.c.client + "/viewer", secrets.viewer), null);
  assert.equal(a.issue("viewer", "viewer", secrets.viewer), false);
  assert.throws(
    () => a.issue("viewer", "operator", secrets.viewer),
    /already exists/,
  );
  assert.throws(() => a.issue("review", "reviewer", "short"), /credential/);
  assert.throws(
    () => a.issue("viewer/other", "viewer", secrets.viewer),
    /account name/,
  );
  const table = a.db.prepare("SELECT * FROM workos_members").all();
  assert.equal(table.length, 3);
  for (const secret of Object.values(secrets))
    assert.ok(!JSON.stringify(table).includes(secret));
  a.db.close();
  b.db.close();
});
test("role-scoped manifests, visual flags and negative HTTP actions obey both member and installation grants", () => {
  const { api, enter, db } = fixture();
  const viewer = enter("viewer"),
    reviewer = enter("reviewer"),
    operator = enter("worker");
  assert.equal(
    api(viewer, "").endpoints.filter((r: any) => r.method === "POST").length,
    0,
  );
  assert.deepEqual(
    api(reviewer, "")
      .endpoints.filter((r: any) => r.method === "POST")
      .map((r: any) => r.path),
    ["/api/workos/approve", "/api/workos/verify", "/api/workos/review-work"],
  );
  for (const a of [viewer, reviewer]) {
    assert.equal(api(a, "workos").editable, false);
    assert.equal(api(a, "workos").canImport, false);
    assert.equal(api(a, "bootstrap").access.decisionWrite, false);
    assert.throws(
      () => api(a, "decisions", { question: "Synthetic question" }),
      /unavailable/,
    );
  }
  assert.equal(api(operator, "bootstrap").access.principal, operator.principal);
  assert.equal(api(operator, "workos").editable, true);
  assert.throws(
    () => api(viewer, "workos/approve", { planRevision: 1 }),
    /disabled/,
  );
  assert.throws(
    () =>
      api(reviewer, "workos/select", {
        task: "measure-pilot",
        intent: "Review goal progress",
        planRevision: 1,
      }),
    /disabled/,
  );
  assert.throws(
    () =>
      api(reviewer, "workos/approve", {
        planRevision: 1,
        principal: "pretend",
      }),
    /fields/,
  );
  db.close();
});
test("separate worker and reviewer credentials are retained across receipt retry, re-verification and archival", () => {
  const { api, enter, db, c, login } = fixture();
  const w = enter("worker"),
    r = enter("reviewer"),
    admin = login(c.client, secrets.owner)!;
  const task = "measure-pilot";
  api(r, "workos/approve", { planRevision: 1 });
  api(admin, "workos/approve", { planRevision: 1 });
  assert.equal(api(w, "workos").approval.principal, r.principal);
  api(w, "workos/measure", {
    task,
    value: 18,
    reference: "proof-01",
    planRevision: 1,
  });
  const choice = api(w, "workos/select", {
    task,
    intent: "Review goal progress",
    planRevision: 1,
  });
  const selected = {
    task,
    planRevision: 1,
    expectedRun: choice.run,
    expectedSkill: choice.selected,
  };
  const opened = api(w, "workos/read-skill", selected);
  assert.equal(opened.steps.length, 3);
  assert.equal(api(w, "workos").usage.loaded, 0);
  const receipt = api(w, "workos/run", selected);
  assert.equal(receipt.instructionHash, opened.instructionHash);
  assert.equal(api(w, "workos").usage.loaded, 1);
  assert.equal(receipt.principal, w.principal);
  assert.equal(receipt.taskOwner, c.owner);
  assert.deepEqual(api(admin, "workos/run", selected), receipt);
  api(r, "workos/verify", { ...selected, reference: "proof-01" });
  api(admin, "workos/verify", { ...selected, reference: "proof-01" });
  assert.equal(
    api(w, "workos").tasks[0].receipt.reviewedByPrincipal,
    r.principal,
  );
  const p = api(w, "workos").plan;
  api(w, "workos/new-plan", { planRevision: 1, plan: { ...p, tasks: [] } });
  const archive = request(
    db,
    "unused",
    "GET",
    "workos/history",
    new URLSearchParams("revision=1"),
    {},
    admin,
  );
  assert.equal(archive.approval.principal, r.principal);
  assert.equal(archive.tasks[0].receipt.principal, w.principal);
  assert.equal(archive.tasks[0].receipt.reviewedByPrincipal, r.principal);
  db.close();
});
test("fresh admission observes a role change and a cached in-flight write is rechecked inside the transaction", () => {
  const { db, c, enter, api, login } = fixture(),
    r = enter("reviewer");
  transaction(db, () => setMemberRole(db, c.client, "reviewer", "viewer"));
  assert.throws(
    () =>
      change(db, configOf(db), "approve", { planRevision: 1 }, Date.now(), r),
    /cannot perform/,
  );
  const viewer = enter("reviewer");
  assert.equal(viewer.role, "viewer");
  assert.throws(
    () => api(viewer, "workos/approve", { planRevision: 1 }),
    /disabled/,
  );
  transaction(db, () => setMemberRole(db, c.client, "reviewer", "suspended"));
  assert.equal(login(c.client + "/reviewer", secrets.reviewer), null);
  transaction(db, () => setMemberRole(db, c.client, "reviewer", "reviewer"));
  assert.throws(
    () => api(r, "workos/approve", { planRevision: 1 }),
    /cannot perform/,
  );
  api(enter("reviewer"), "workos/approve", { planRevision: 1 });
  assert.equal(api(enter("reviewer"), "workos").approved, true);
  db.close();
});

test("the four published procedure pins retain exact instruction digests", () => {
  const pins = {
    "workos.goal-checkin@1.0.0":
      "16cfc5e8ae846a1fc0ea7f7a2182e41d6cd21f3acb1af4161b20fda209d08ded",
    "workos.goal-checkin@1.1.0":
      "02813c61f92eec5dacace847318b8b28ab109ad9d420f1cdce80f87d464f0b6b",
    "workos.deadline-review@1.0.0":
      "4a409064e83e2d585d352eafbd202865c7898fee7a1ada917eeb9537ea1f88dc",
    "workos.evidence-handoff@1.0.0":
      "61d2517d70cfb35336cce2c6731089cbff99f261d31e6166bce965de80b62df2",
  };
  for (const [pin, hash] of Object.entries(pins))
    assert.equal(loadProcedure(pin).instructionHash, hash);
  assert.throws(() => loadProcedure("not-installed"), /unavailable/);
});

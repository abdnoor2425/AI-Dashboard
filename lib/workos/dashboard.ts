import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { handle, type State } from "../api.ts";
import { makeWorkspace } from "../sample.ts";
import { getBrain, getBrainNode } from "../server/brain.ts";
import {
  Problem,
  requireValue,
  kitVersion,
  canReviewCatalogue,
  catalogue,
  eligible,
  type Config,
} from "./config.ts";
import {
  change,
  configOf,
  snapshot,
  transaction,
  prune,
} from "./operations.ts";

import { historicalCatalogue } from "./catalogue-history.ts";

import {
  installationActor,
  mayChange,
  requireMutation,
  type Actor,
  type Role,
} from "./identity.ts";

const reads = [
  "workos/catalogue-history",
  "bootstrap",
  "overview",
  "workos",
  "workos/history",
  "goals",
  "attention",
  "metrics",
  "team",
  "skills",
  "brain",
  "decisions",
  "search",
  "export",
];
const fields: Record<string, string[]> = {
  approve: ["planRevision"],
  measure: ["task", "value", "reference", "planRevision"],
  select: ["task", "intent", "planRevision"],
  "choose-output": ["task", "revisions", "expectedRun", "planRevision"],
  "read-skill": ["task", "expectedRun", "expectedSkill", "planRevision"],
  run: ["task", "expectedRun", "expectedSkill", "planRevision"],
  verify: ["task", "reference", "expectedRun", "expectedSkill", "planRevision"],
  "submit-work": [
    "task",
    "reference",
    "summary",
    "expectedRun",
    "planRevision",
  ],
  "review-work": ["task", "reference", "expectedRun", "planRevision"],
  cancel: ["task", "planRevision"],
  plan: ["plan", "planRevision"],
  "new-plan": ["plan", "planRevision"],
  reconcile: ["source", "client", "issues", "planRevision"],
};
const actions = Object.keys(fields);
const allowedActions = (c: Config, role: Role) =>
  actions
    .filter((a) =>
      a === "choose-output"
        ? catalogue.some((entry) => eligible(c, entry.pin))
        : a === "submit-work" || a === "review-work"
          ? c.permissions.includes("work.record")
          : a === "plan" || a === "new-plan"
            ? c.permissions.includes("plan.edit")
            : a === "reconcile"
              ? c.permissions.includes("fixture.import")
              : true,
    )
    .filter((a) => mayChange(role, a));
export function manifest(c: Config, role: Role = "operator") {
  return {
    version: kitVersion,
    endpoints: [
      ...reads
        .filter(
          (k) =>
            !(
              ["skills", "metrics", "team", "decisions"].includes(k) &&
              !c.modules.includes(k)
            ) &&
            (k !== "brain" || c.modules.includes("second-brain")) &&
            (k !== "workos/catalogue-history" || canReviewCatalogue(c)),
        )
        .map((k) => ({ method: "GET", path: "/api/" + k })),
      ...allowedActions(c, role).map((k) => ({
        method: "POST",
        path: "/api/workos/" + k,
      })),
      ...(mayChange(role, "decisions") && c.modules.includes("decisions")
        ? [
            { method: "POST", path: "/api/decisions" },
            { method: "POST", path: "/api/decisions/:id" },
          ]
        : []),
    ],
  };
}

export function request(
  db: DatabaseSync,
  dir: string,
  method: string,
  endpoint: string,
  query: URLSearchParams,
  body: Record<string, unknown> = {},
  authenticated?: Actor,
) {
  const c = configOf(db),
    now = Date.now();
  const actor = authenticated ?? installationActor(c.client);
  requireValue(
    !query.has("workspaceId") || query.get("workspaceId") === c.client,
    "Unknown workspace.",
    404,
  );
  requireValue(
    !query.has("client") || query.get("client") === c.client,
    "Unknown installation.",
    404,
  );
  requireValue(
    [...query.keys()].every((k) => query.getAll(k).length === 1),
    "Duplicate query field.",
  );
  const queryFields: Record<string, string[]> = {
    workos: ["days"],
    export: ["days"],
    "workos/history": ["revision"],
    "workos/catalogue-history": ["source", "revision", "coverageRevision"],
    search: ["q", "scope"],
    overview: ["scope"],
    attention: ["scope"],
    brain: ["action", "id"],
  };
  const permittedQuery = [
    "workspaceId",
    "client",
    ...(method === "GET" && Object.hasOwn(queryFields, endpoint)
      ? queryFields[endpoint]
      : []),
  ];
  requireValue(
    [...query.keys()].every((k) => permittedQuery.includes(k)),
    "Unknown query field.",
  );
  if (method === "GET" && endpoint === "") return manifest(c, actor.role);
  if (
    method === "POST" &&
    endpoint.startsWith("workos/") &&
    actions.includes(endpoint.slice(7))
  ) {
    const action = endpoint.slice(7);
    requireValue(
      allowedActions(c, actor.role).includes(action),
      "This operation is disabled for this installation.",
      403,
    );
    const required = fields[action];
    requireValue(
      required.every((k) => Object.hasOwn(body, k)) &&
        Object.keys(body).every(
          (k) =>
            required.includes(k) ||
            (action === "select" && k === "revision") ||
            (action === "verify" && k === "additionalReferences"),
        ) &&
        Number.isSafeInteger(body.planRevision),
      "Invalid or missing action fields.",
    );
    if (["read-skill", "run", "verify"].includes(action))
      requireValue(
        typeof body.expectedRun === "string" &&
          typeof body.expectedSkill === "string",
        "Review the current selection.",
        409,
      );
    const result = change(db, c, endpoint.slice(7), body, now, actor);
    if (result.failure) throw new Problem(result.failure, 422);
    return result;
  }
  const decisionWrite =
    method === "POST" &&
    mayChange(actor.role, "decisions") &&
    /^decisions(?:\/dec-[a-z0-9-]+)?$/.test(endpoint) &&
    c.modules.includes("decisions");
  requireValue(
    decisionWrite ||
      (method === "GET" &&
        manifest(c, actor.role).endpoints.some(
          (e) => e.method === method && e.path === "/api/" + endpoint,
        )),
    "This operation is unavailable in the local client starter.",
    403,
  );
  if (endpoint === "workos/catalogue-history")
    return historicalCatalogue(
      db,
      c,
      query.get("source"),
      query.get("revision"),
      query.get("coverageRevision"),
    );
  if (actor.role === "operator") prune(db, c, now);
  const d = snapshot(db, c, now, Number(query.get("days") || 7));
  if (endpoint === "workos/history") {
    if (query.has("revision")) {
      const rev = Number(query.get("revision"));
      requireValue(
        Number.isSafeInteger(rev) && rev > 0,
        "Invalid archived revision.",
      );
      const record = db
        .prepare("SELECT record FROM plan_archive WHERE revision=?")
        .get(rev);
      requireValue(record, "Archived plan not found.", 404);
      return JSON.parse(String(record.record));
    }
    return {
      archives: db
        .prepare(
          "SELECT revision,created,json_extract(record,'$.plan.quarter.title') AS title FROM plan_archive ORDER BY revision DESC LIMIT 100",
        )
        .all(),
    };
  }
  if (endpoint === "workos")
    return {
      ...d,
      editable: d.editable && mayChange(actor.role, "plan"),
      canImport: d.canImport && mayChange(actor.role, "reconcile"),
    };
  if (endpoint === "brain") {
    const home = path.join(dir, "index");
    if (query.get("action") === "node")
      return getBrainNode(c.client, query.get("id") || "", home);
    requireValue(
      !query.has("action"),
      "Only the installed project can be read.",
      403,
    );
    return getBrain(c.client, home);
  }
  const ws = makeWorkspace(
    {
      id: c.client,
      name: c.name,
      owner: c.owner,
      accent: c.accent,
      kind: "client",
      empty: true,
    },
    now,
  );
  ws.modules = Object.fromEntries(
    [
      ...Object.keys(ws.modules),
      ...c.modules,
      "goals",
      "workos",
      "decisions",
      "settings",
      "connections",
      "more",
      "news",
      "money",
      "made",
    ].map((k) => [
      k,
      c.modules.includes(k) ||
        ["workos", "goals", "overview", "attention"].includes(k),
    ]),
  );
  const goal = d.goal;
  const finished = d.tasks
    .filter((t) => t.verified && t.hasMeasuredReceipt)
    .sort((a, b) => a.verifiedAt - b.verifiedAt);
  const latest = finished.at(-1);
  ws.goals = [
    {
      id: "quarter",
      title: goal.quarter,
      owner: d.plan.quarter.owner,
      period: goal.due,
      top: true,
      krs: [
        {
          id: "measure",
          title: goal.metric,
          owner: d.plan.quarter.owner,
          baseline: goal.baseline,
          target: goal.target,
          current: latest?.value ?? null,
          unit: goal.unit,
          links: d.tasks.map((t) => t.id),
          checkins: finished.map((t) => ({
            at: t.receipt.at,
            value: t.value,
            note: t.reference,
          })),
        },
      ],
    },
  ];
  ws.metrics = [
    {
      id: "measure",
      name: goal.metric,
      definition: goal.quarter,
      owner: d.plan.quarter.owner,
      source: goal.source,
      unit: goal.unit,
      period: "Quarter",
      scopeLabel: c.name,
      baseline: goal.baseline,
      target: goal.target,
      targetStatus: d.approved ? "approved" : "proposed",
      current: latest?.value ?? null,
      lastVerified: latest?.verifiedAt ?? null,
      trend: finished.map((t) => t.value),
    },
  ];
  ws.skills = c.modules.includes("skills")
    ? d.catalog.map((s) => ({
        ...s,
        status: s.deprecated
          ? "Deprecated"
          : s.enabled
            ? "Enabled locally"
            : "Disabled",
        permissions: s.permissions.join(", "),
        note: s.excludes,
      }))
    : [];
  ws.items = d.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    kind: "approval",
    nextStep: t.blocker || "Review in WorkOS",
    scope: null,
    scopeLabel: c.name,
    owner: t.owner,
    waitingOn: "me",
    due: Date.parse(t.due + "T23:59:59Z"),
    factors: {},
    sources: [{ tool: "WorkOS", label: goal.source }],
    status: t.verified
      ? "done"
      : t.blocker === "Cancelled"
        ? "cancelled"
        : "open",
    evidence: t.verified ? "verified" : "needs-context",
    evidenceNote: t.reference || "Awaiting measurement",
  }));
  const state: State = {
    version: 1,
    createdAt: now,
    active: c.client,
    theme: "system",
    onboarded: true,
    workspaces: { [c.client]: ws },
  };
  if (endpoint === "export")
    return {
      version: kitVersion,
      installation: c.client,
      revision: d.revision,
      plan: d.plan,
      goal: d.goal,
      tasks: d.tasks,
      usage: d.usage,
    };
  if (endpoint === "decisions" || decisionWrite) {
    if (decisionWrite) {
      const key = endpoint === "decisions" ? "question" : "outcome";
      requireValue(
        Object.keys(body).length === 1 &&
          typeof body[key] === "string" &&
          String(body[key]).trim().length > 0 &&
          String(body[key]).length <= 300,
        "Enter a decision field of up to 300 characters.",
      );
    }
    return transaction(db, () => {
      if (decisionWrite) requireMutation(db, c.client, actor, "decisions");
      ws.decisions = db
        .prepare("SELECT record FROM decisions ORDER BY rowid DESC")
        .all()
        .map((r) => JSON.parse(String(r.record)));
      const cleanBody =
        endpoint === "decisions"
          ? { question: body.question }
          : { outcome: body.outcome };
      const result = handle(state, {
        method,
        path: "/api/" + endpoint,
        body: cleanBody,
        now,
      });
      if (result.status !== 200)
        throw new Problem(result.data.error, result.status);
      if (result.changed && endpoint === "decisions")
        result.data.id = "dec-" + randomUUID();
      if (result.changed)
        db.prepare(
          "INSERT INTO decisions VALUES (?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record",
        ).run(result.data.id, JSON.stringify(result.data));
      return result.data;
    });
  }
  const result = handle(state, {
    method: "GET",
    path: "/api/" + endpoint,
    query: Object.fromEntries(query),
    now,
  });
  if (result.status !== 200)
    throw new Problem(result.data.error, result.status);
  if (endpoint === "goals")
    return {
      ...result.data,
      hierarchy: d.plan,
      rollups: d.rollups,
      revision: d.revision,
      approved: d.approved,
    };
  return endpoint === "bootstrap"
    ? {
        ...result.data,
        clientStarter: true,
        access: {
          principal: actor.principal,
          role: actor.role,
          actions: allowedActions(c, actor.role),
          decisionWrite:
            c.modules.includes("decisions") &&
            mayChange(actor.role, "decisions"),
        },
        ai: null,
      }
    : result.data;
}

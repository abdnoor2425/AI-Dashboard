import type { DatabaseSync } from "node:sqlite";
import {
  type Config,
  requireValue,
  clean,
  slug,
  date,
  only,
} from "./config.ts";

export type Branch = {
  id: string;
  title: string;
  owner: string;
  due: string;
  parent: string;
};
export type CompletionEvidence =
  | { kind: "observation" }
  | { kind: "deliverable"; criterion: string };
export type Plan = {
  quarter: Omit<Config["goal"], "quarter" | "month" | "week"> & {
    title: string;
    owner: string;
  };
  months: Branch[];
  weeks: Branch[];
  tasks: (Branch & { after: string | null; evidence?: CompletionEvidence })[];
};
export function seedPlan(c: Config): Plan {
  const { quarter, month, week, ...measure } = c.goal;
  // Legacy configurations may already have task IDs named month or week.
  const used = new Set(c.tasks.map((t) => t.id));
  function unused(base: string) {
    while (used.has(base)) base += "-x";
    used.add(base);
    return base;
  }
  const m = unused("month"),
    w = unused("week");
  return {
    quarter: { ...measure, title: quarter, owner: c.owner },
    months: [
      {
        id: m,
        title: month,
        owner: c.owner,
        due: measure.due,
        parent: "quarter",
      },
    ],
    weeks: [
      { id: w, title: week, owner: c.owner, due: measure.due, parent: m },
    ],
    tasks: c.tasks.map((t) => ({ ...t, owner: c.owner, parent: w })),
  };
}
function validateStructure(p: Plan) {
  requireValue(
    only(p, ["quarter", "months", "weeks", "tasks"]),
    "Enter a complete plan.",
  );
  const q = p.quarter;
  requireValue(
    only(q, [
      "title",
      "owner",
      "due",
      "metric",
      "unit",
      "baseline",
      "target",
      "source",
    ]) &&
      [q.title, q.owner, q.metric, q.unit, q.source].every(clean) &&
      date(q.due) &&
      [q.baseline, q.target, q.target - q.baseline].every(Number.isFinite) &&
      q.baseline !== q.target,
    "Check the quarterly owner, dates, source and distinct numeric baseline and target.",
  );
  const seen = new Set<string>();
  let parents = new Map([["quarter", q.due]]);
  for (const level of ["months", "weeks", "tasks"] as const) {
    const nodes = p[level];
    requireValue(
      Array.isArray(nodes) && nodes.length <= 50,
      "Each level supports up to 50 entries.",
    );
    const dueDates = new Map<string, string>();
    for (const node of nodes) {
      const keys = ["id", "title", "owner", "due", "parent"];
      if (level === "tasks") {
        keys.push("after");
        if (node && Object.hasOwn(node, "evidence")) {
          keys.push("evidence");
          const proof = (node as Plan["tasks"][number]).evidence;
          requireValue(
            proof &&
              ((proof.kind === "observation" && only(proof, ["kind"])) ||
                (proof.kind === "deliverable" &&
                  only(proof, ["kind", "criterion"]) &&
                  clean(proof.criterion))),
            "Choose a goal observation or a work product with a short acceptance criterion.",
          );
        }
      }
      requireValue(
        only(node, keys) &&
          slug(node.id) &&
          !seen.has(node.id) &&
          clean(node.title) &&
          clean(node.owner) &&
          date(node.due),
        "Use unique stable IDs, names, owners and real dates.",
      );
      requireValue(
        parents.has(node.parent) && node.due <= parents.get(node.parent)!,
        "Each entry needs a parent at the preceding level and a due date within that parent.",
      );
      if (level === "tasks") {
        const dep = (node as Plan["tasks"][number]).after;
        requireValue(
          dep === null || dueDates.has(dep),
          "Dependencies must point to earlier tasks in this plan.",
        );
      }
      seen.add(node.id);
      dueDates.set(node.id, node.due);
    }
    parents = dueDates;
  }
  return p;
}
export function dependencyDates(p: Plan) {
  const tasks = new Map(p.tasks.map((t) => [t.id, t]));
  return p.tasks.flatMap((t) => {
    const prerequisite = t.after ? tasks.get(t.after) : null;
    return prerequisite && prerequisite.due > t.due
      ? [
          {
            task: t.id,
            after: prerequisite.id,
            due: t.due,
            afterDue: prerequisite.due,
            message:
              t.title +
              " is due " +
              t.due +
              " before its prerequisite " +
              prerequisite.title +
              " (" +
              prerequisite.due +
              ").",
          },
        ]
      : [];
  });
}
export function validatePlan(p: Plan) {
  validateStructure(p);
  const conflict = dependencyDates(p)[0];
  requireValue(!conflict, conflict?.message ?? "Check dependency dates.");
  return p;
}
export function createPlanTables(db: DatabaseSync, c: Config) {
  const plan = validateStructure(seedPlan(c));
  db.exec(`CREATE TABLE plan (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, document TEXT NOT NULL, approved_at INTEGER, approved_principal TEXT);
  ALTER TABLE tasks ADD COLUMN routing TEXT;
  CREATE INDEX event_attempt_stage ON events(run,stage,revision,reason);
  CREATE TABLE plan_archive (revision INTEGER PRIMARY KEY, created INTEGER NOT NULL, record TEXT NOT NULL);
  CREATE TABLE linear_issues (id TEXT PRIMARY KEY, task TEXT NOT NULL UNIQUE REFERENCES tasks(id), version INTEGER NOT NULL, payload TEXT NOT NULL);
  PRAGMA user_version=2;`);
  db.prepare("INSERT INTO plan(id,revision,document) VALUES(1,1,?)").run(
    JSON.stringify(plan),
  );
}
export function planOf(db: DatabaseSync) {
  const row = db
    .prepare(
      "SELECT revision,document,approved_at,approved_principal FROM plan WHERE id=1",
    )
    .get();
  requireValue(row, "Missing plan.", 409);
  return {
    revision: Number(row.revision),
    approval: row.approved_principal
      ? {
          principal: String(row.approved_principal),
          at: Number(row.approved_at),
        }
      : null,
    plan: validateStructure(JSON.parse(String(row.document))),
  };
}
export function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    !a ||
    !b ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((k) => Object.hasOwn(b, k) && same(a[k], b[k]))
  );
}
// Caller holds a write transaction. Updating the tree, task rows and approval is a single commit.
export function savePlan(db: DatabaseSync, revision: unknown, proposed: Plan) {
  const { revision: current, plan: before } = planOf(db);
  requireValue(
    revision === current,
    "The plan changed. Reload and review the latest copy.",
    409,
  );
  const plan = validateStructure(proposed);
  const previousConflicts = dependencyDates(before);
  for (const conflict of dependencyDates(plan)) {
    const old = previousConflicts.find(
      (i) =>
        i.task === conflict.task &&
        i.after === conflict.after &&
        i.due === conflict.due &&
        i.afterDue === conflict.afterDue,
    );
    const done =
      old &&
      db
        .prepare("SELECT cancelled,verified FROM tasks WHERE id=?")
        .get(conflict.task);
    requireValue(done && (done.cancelled || done.verified), conflict.message);
  }
  if (same(plan, before)) return { revision: current, changed: false };
  const rows = db
    .prepare("SELECT id,value,run,receipt,cancelled FROM tasks")
    .all();
  const next = new Map(plan.tasks.map((t) => [t.id, t]));
  const mapping = new Set(
    db
      .prepare("SELECT task FROM linear_issues")
      .all()
      .map((r) => r.task),
  );
  for (const r of rows) {
    const id = String(r.id),
      old = before.tasks.find((t) => t.id === id),
      updated = next.get(id);
    if (!old) {
      requireValue(!updated, "This task ID belongs to an archived plan.", 409);
      continue;
    }
    requireValue(
      updated || !mapping.has(id),
      "Retain tasks linked to the mock source.",
      409,
    );
    if (r.run || r.value !== null || r.receipt || r.cancelled) {
      requireValue(
        updated && same(old, updated),
        "Retain the identity, owner, deadline and parent of tasks with activity.",
        409,
      );
      const week = before.weeks.find((w) => w.id === old.parent)!;
      requireValue(
        plan.weeks.find((w) => w.id === week.id)?.parent === week.parent,
        "Preserve the lineage of tasks with activity.",
        409,
      );
      for (const k of [
        "metric",
        "unit",
        "source",
        "baseline",
        "target",
      ] as const)
        requireValue(
          before.quarter[k] === plan.quarter[k],
          "Recorded measurements fix the metric definition. Create a new quarterly goal for a different metric.",
          409,
        );
    }
    if (!updated) db.prepare("DELETE FROM tasks WHERE id=?").run(id);
  }
  const add = db.prepare("INSERT OR IGNORE INTO tasks(id) VALUES(?)");
  for (const t of plan.tasks) add.run(t.id);
  db.prepare(
    "UPDATE plan SET revision=revision+1, approved_at=NULL, approved_principal=NULL, document=? WHERE id=1",
  ).run(JSON.stringify(plan));
  db.exec(
    "UPDATE installation SET approved=0; UPDATE tasks SET selected=NULL,routing=NULL WHERE receipt IS NULL;",
  );
  return { revision: current + 1, changed: true };
}

import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { type Config, only, clean, date, requireValue } from "./config.ts";
import { planOf, savePlan, same } from "./plan.ts";

type Issue = {
  id: string;
  identifier: string;
  version: number;
  title: string;
  owner: string;
  due: string;
  week: string;
  state: string;
};
const states = ["Todo", "In Progress", "Done", "Canceled"];
export function sources(db: DatabaseSync) {
  return db
    .prepare("SELECT task,payload FROM linear_issues ORDER BY id")
    .all()
    .map((r) => ({
      task: String(r.task),
      issue: JSON.parse(String(r.payload)) as Issue,
    }));
}
// A bounded pull from supplied synthetic data. No transport, credentials or external write implementation.
export function reconcile(
  db: DatabaseSync,
  c: Config,
  input: Record<string, unknown>,
) {
  requireValue(
    only(input, ["source", "client", "planRevision", "issues"]) &&
      input.source === "synthetic-linear/v1",
    "Choose a synthetic Linear v1 envelope.",
  );
  requireValue(
    input.client === c.client,
    "Fixture belongs to a different installation.",
    403,
  );
  const { revision, plan } = planOf(db);
  requireValue(
    Number.isSafeInteger(input.planRevision) && Number(input.planRevision) > 0,
    "Invalid plan revision.",
  );
  requireValue(
    Array.isArray(input.issues) &&
      input.issues.length > 0 &&
      input.issues.length <= 50,
    "Supply 1–50 synthetic issues.",
  );
  const seen = new Set<string>();
  const summary = { created: 0, updated: 0, unchanged: 0, stale: 0 };
  // All mapping updates are committed together with the revised plan by the caller.
  const changes: { id: string; task: string; issue: Issue }[] = [];
  for (const i of input.issues as Issue[]) {
    requireValue(
      only(i, [
        "id",
        "identifier",
        "version",
        "title",
        "owner",
        "due",
        "week",
        "state",
      ]) &&
        typeof i.id === "string" &&
        /^mock-[a-z0-9-]{2,60}$/.test(i.id) &&
        typeof i.identifier === "string" &&
        /^[A-Z]{2,8}-[1-9][0-9]{0,6}$/.test(i.identifier) &&
        Number.isSafeInteger(i.version) &&
        i.version > 0 &&
        clean(i.title) &&
        clean(i.owner) &&
        date(i.due) &&
        states.includes(i.state),
      "Invalid synthetic issue. Check ID, identifier, version, state and fields.",
    );
    requireValue(!seen.has(i.id), "Duplicate source ID in batch.");
    seen.add(i.id);
    const saved = db
      .prepare("SELECT task,payload,version FROM linear_issues WHERE id=?")
      .get(i.id);
    if (saved && i.version < Number(saved.version)) {
      summary.stale++;
      continue;
    }
    const previous: Issue | undefined = saved
      ? JSON.parse(String(saved.payload))
      : undefined;
    if (saved && i.version === Number(saved.version)) {
      requireValue(
        same(previous, i),
        "Conflicting contents at the same source version.",
        409,
      );
      summary.unchanged++;
      continue;
    }
    requireValue(
      plan.weeks.some((w) => w.id === i.week),
      "Unknown destination week.",
    );
    const id = saved
      ? String(saved.task)
      : "lin-" +
        createHash("sha256")
          .update(c.client + "\0" + i.id)
          .digest("hex")
          .slice(0, 24);
    const task = plan.tasks.find((t) => t.id === id);
    if (!saved) {
      requireValue(!task, "Source ID collides with an existing task.", 409);
      plan.tasks.push({
        id,
        title: i.title,
        owner: i.owner,
        due: i.due,
        parent: i.week,
        after: null,
      });
      summary.created++;
    } else {
      requireValue(task && previous, "Missing source-mapped task.", 409);
      for (const [local, remote] of [
        ["title", "title"],
        ["owner", "owner"],
        ["due", "due"],
        ["parent", "week"],
      ] as const) {
        if (i[remote] === previous[remote]) continue;
        requireValue(
          task[local] === previous[remote] || task[local] === i[remote],
          "Concurrent local/source edit for " +
            i.identifier +
            " (" +
            remote +
            "). Resolve the field before retrying.",
          409,
        );
        task[local] = i[remote];
      }
      summary.updated++;
    }
    changes.push({ id: i.id, task: id, issue: i });
  }
  if (!changes.length) return { ...summary, revision, requiresApproval: false };
  requireValue(
    revision === input.planRevision,
    "The plan changed. Reload before importing.",
    409,
  );
  const result = savePlan(db, revision, plan);
  const write = db.prepare(
    "INSERT INTO linear_issues VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version,payload=excluded.payload",
  );
  for (const c of changes)
    write.run(c.id, c.task, c.issue.version, JSON.stringify(c.issue));
  return {
    ...summary,
    revision: result.revision,
    requiresApproval: result.changed,
  };
}

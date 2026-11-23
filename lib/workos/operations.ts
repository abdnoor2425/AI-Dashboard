import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import {
  validate,
  eligible,
  catalogue,
  canReviewCatalogue,
  isMeasurementPin,
  clean,
  requireValue,
  type Config,
} from "./config.ts";

import {
  createPlanTables,
  planOf,
  savePlan,
  validatePlan,
  seedPlan,
  dependencyDates,
  type Plan,
} from "./plan.ts";
import { reconcile, sources } from "./linear-fixture.ts";
import { installationActor, requireMutation, type Actor } from "./identity.ts";
import { loadProcedure } from "./procedures.ts";
import { selectSkill } from "./routing.ts";
import { localResult } from "./local-result.ts";

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function initialize(db: DatabaseSync, config: Config) {
  validate(config);
  validatePlan(seedPlan(config));
  transaction(db, () => {
    db.exec(`CREATE TABLE installation (config TEXT NOT NULL, previous TEXT, approved INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE decisions (id TEXT PRIMARY KEY, record TEXT NOT NULL);
      CREATE TABLE tasks (id TEXT PRIMARY KEY, value REAL, reference TEXT, run TEXT UNIQUE, selected TEXT, failure TEXT, receipt TEXT, verified INTEGER, cancelled INTEGER DEFAULT 0);
      CREATE TABLE events (id TEXT PRIMARY KEY, run TEXT NOT NULL, task TEXT NOT NULL, stage TEXT NOT NULL, reason TEXT, revision TEXT, at INTEGER NOT NULL, duration REAL);
      CREATE INDEX event_time ON events(at);
      PRAGMA user_version=1;`);
    db.prepare("INSERT INTO installation(config) VALUES (?)").run(
      JSON.stringify(config),
    );
    createPlanTables(db, config);
    db.exec("PRAGMA user_version=3");
    for (const task of config.tasks)
      db.prepare("INSERT INTO tasks(id) VALUES (?)").run(task.id);
  });
}
export function configOf(db: DatabaseSync): Config {
  requireValue(
    db.prepare("PRAGMA user_version").get()?.user_version === 3,
    "Unsupported installation schema. Upgrade a stopped legacy installation using the runbook.",
    409,
  );
  return validate(
    JSON.parse(
      String(db.prepare("SELECT config FROM installation").get()?.config),
    ),
  );
}
export function configure(db: DatabaseSync, next?: Config) {
  return transaction(db, () => {
    const current = configOf(db);
    const previous = db
      .prepare("SELECT previous FROM installation")
      .get()?.previous;
    requireValue(next || previous, "There is no previous configuration.", 409);
    const c = validate(next || JSON.parse(String(previous)));
    requireValue(
      c.client === current.client && c.port === current.port,
      "Client ID and port are fixed for this installation.",
    );
    requireValue(
      JSON.stringify(c.goal) === JSON.stringify(current.goal) &&
        JSON.stringify(c.tasks) === JSON.stringify(current.tasks),
      "This version preserves the installed plan and task history. Use the goal planner to change the active hierarchy.",
    );
    db.prepare("UPDATE installation SET config=?, previous=?").run(
      JSON.stringify(c),
      JSON.stringify(current),
    );
    db.prepare(
      "UPDATE tasks SET selected=NULL,routing=NULL WHERE receipt IS NULL",
    ).run();
    prune(db, c, Date.now());
  });
}
export function prune(db: DatabaseSync, c: Config, now: number) {
  db.prepare("DELETE FROM events WHERE at < ?").run(
    now - c.retentionDays * 86400000,
  );
}
type Row = {
  id: string;
  value: number | null;
  reference: string | null;
  run: string | null;
  selected: string | null;
  receipt: string | null;
  failure: string | null;
  verified: number | null;
  cancelled: number;
  routing: string | null;
};
function row(db: DatabaseSync, id: string) {
  return db.prepare("SELECT * FROM tasks WHERE id=?").get(id) as unknown as
    | Row
    | undefined;
}
function publicReceipt(raw: string | null) {
  const receipt = raw ? JSON.parse(raw) : null;
  if (receipt?.reviewer) {
    receipt.legacyOwnerLabel = receipt.reviewer;
    delete receipt.reviewer;
  }
  if (receipt?.operator) {
    receipt.legacyOwnerLabel ??= receipt.operator;
    delete receipt.operator;
  }
  for (const result of receipt
    ? [receipt, ...(receipt.additional ?? [])]
    : []) {
    if (
      isMeasurementPin(result.revision) &&
      Number.isFinite(result.observed) &&
      Number.isFinite(result.target)
    ) {
      const gap = result.observed - result.target;
      result.observedMinusTarget = Number.isFinite(gap) ? gap : null;
    }
  }
  return receipt;
}
function evidenceBlocker(task: Plan["tasks"][number], config: Config) {
  if (
    task.evidence?.kind === "deliverable" &&
    !config.permissions.includes("work.record")
  )
    return "Work evidence recording is disabled for this installation.";
  if (
    task.evidence?.kind === "observation" &&
    !config.enabledSkills.some(
      (pin) => isMeasurementPin(pin) && eligible(config, pin),
    )
  )
    return "Enable a permitted goal measurement revision for this observation.";
  return null;
}
export function snapshot(db: DatabaseSync, c: Config, now: number, days = 7) {
  requireValue(days === 7 || days === 30, "Choose seven or thirty days.");
  const approved = Boolean(
    db.prepare("SELECT approved FROM installation").get()?.approved,
  );
  const { revision, plan, approval } = planOf(db);
  const mapped = sources(db);
  const titles = new Map(plan.tasks.map((task) => [task.id, task.title]));
  const tasks = plan.tasks.map((t) => {
    const r = row(db, t.id)!;
    const prerequisite = t.after ? row(db, t.after) : null;
    const prerequisiteTitle = t.after ? (titles.get(t.after) ?? t.after) : "";
    const blocker = r.cancelled
      ? "Cancelled"
      : !approved
        ? "Awaiting goal approval"
        : t.after && !prerequisite?.verified
          ? prerequisite?.cancelled
            ? "Prerequisite cancelled (" +
              prerequisiteTitle +
              "). Replan or cancel this action."
            : "Waiting for " + prerequisiteTitle
          : r.verified
            ? null
            : evidenceBlocker(t, c);
    const receipt = publicReceipt(r.receipt);
    return {
      ...t,
      sourceIssue: mapped.find((m) => m.task === t.id)?.issue ?? null,
      value: r.value,
      reference: r.reference,
      run: r.run,
      selected: r.selected,
      routing: r.routing ? JSON.parse(r.routing) : null,
      failure: r.failure,
      receipt,
      hasMeasuredReceipt:
        !!receipt &&
        [receipt, ...(receipt.additional ?? [])].some((result) =>
          isMeasurementPin(result.revision),
        ),
      verified: !!r.verified,
      verifiedAt: r.verified,
      blocker,
      overdue:
        !r.verified &&
        !r.cancelled &&
        t.due < new Date(now).toISOString().slice(0, 10),
    };
  });
  const pending = tasks.filter(
    (task) => !task.verified && task.blocker !== "Cancelled",
  );
  const current = pending.find((task) => !task.blocker);
  const next = pending.find((task) => task.id !== current?.id);
  const events = db
    .prepare("SELECT * FROM events WHERE at>=? ORDER BY at DESC,rowid DESC")
    .all(now - Math.min(days, c.retentionDays) * 86400000);
  const count = (stage: string) =>
    events.filter((e) => e.stage === stage).length;
  const executed = count("executed"),
    verified = count("verified");
  const entries = catalogue.map((s) => ({
    ...s,
    enabled: eligible(c, s.pin),
    deprecated: c.deprecatedSkills?.includes(s.pin) ?? false,
    stages: {
      discovered: true,
      reviewed: true,
      testedFor: "Synthetic fixtures",
      approvedFor: "Local rehearsal only",
      installed: true,
      enabled: eligible(c, s.pin),
    },
    approvedFor: "Synthetic local review",
    scope: "Installation only",
    dataSent: "None. Outputs stay in this installation.",
  }));
  const reviewed = new Set(
    db
      .prepare("SELECT run FROM tasks WHERE verified IS NOT NULL")
      .all()
      .map((r) => r.run),
  );
  const perSkill = entries.map((s) => {
    const rows = events.filter((e) => e.revision === s.pin),
      runs = rows.filter((e) => e.stage === "executed");
    return {
      pin: s.pin,
      name: s.name,
      executed: runs.length,
      verified: rows.filter((e) => e.stage === "verified").length,
      failed: rows.filter((e) => e.stage === "failed").length,
      verifiedRuns: runs.filter((e) => reviewed.has(e.run)).length,
      lastExecuted: runs[0] ? Number(runs[0].at) : null,
    };
  });
  const trend = new Map<
    string,
    { skills: Set<string>; executed: number; verified: number }
  >();
  const blockedReasons = new Map<string, number>();
  for (const e of events) {
    if (e.stage === "blocked") {
      const why = String(e.reason);
      blockedReasons.set(why, (blockedReasons.get(why) ?? 0) + 1);
    }
    if (e.stage !== "executed" && e.stage !== "verified") continue;
    const date = new Date(Number(e.at)).toISOString().slice(0, 10);
    const day = trend.get(date) ?? {
      skills: new Set<string>(),
      executed: 0,
      verified: 0,
    };
    if (e.stage === "executed") {
      day.executed++;
      day.skills.add(String(e.revision));
    } else day.verified++;
    trend.set(date, day);
  }
  const rollup = (ids: string[]) => {
    const rows = tasks.filter((t) => ids.includes(t.parent)),
      measure = rows
        .filter((t) => t.verified && t.hasMeasuredReceipt)
        .sort((a, b) => b.verifiedAt - a.verifiedAt)[0];
    return {
      tasks: rows.length,
      verified: rows.filter((t) => t.verified).length,
      cancelled: rows.filter((t) => t.blocker === "Cancelled").length,
      blocked: rows.filter(
        (t) => !t.verified && t.blocker && t.blocker !== "Cancelled",
      ).length,
      observed: measure?.value ?? null,
    };
  };
  const rollups = Object.fromEntries([
    ...plan.weeks.map((w) => [w.id, rollup([w.id])]),
    ...plan.months.map((m) => [
      m.id,
      rollup(plan.weeks.filter((w) => w.parent === m.id).map((w) => w.id)),
    ]),
  ]);
  return {
    client: c.client,
    name: c.name,
    owner: c.owner,
    revision,
    plan,
    approval,
    editable: c.permissions.includes("plan.edit"),
    canReviewCatalogue: canReviewCatalogue(c),
    canImport: c.permissions.includes("fixture.import"),
    canRecordWork: c.permissions.includes("work.record"),
    goal: {
      ...plan.quarter,
      quarter: plan.quarter.title,
      month: plan.months[0]?.title ?? "",
      week: plan.weeks[0]?.title ?? "",
    },
    approved,
    tasks,
    scheduleConflicts: dependencyDates(plan),
    rollups,
    queue: { current: current?.id ?? null, next: next?.id ?? null },
    catalogue: entries[0],
    catalog: entries,
    usage: {
      days,
      retentionDays: c.retentionDays,
      asOf: now,
      source: "Local event ledger",
      suggested: count("suggested"),
      selected: count("selected"),
      operatorChosen: count("operator-chosen"),
      automaticSelections: count("automatic-selection"),
      confirmedLanguageChoices: count("confirmed-language-choice"),
      opened: count("opened"),
      loaded: count("loaded"),
      executed,
      verified,
      blocked: count("blocked"),
      failed: count("failed"),
      retries: count("retry"),
      verifiedAmongExecutions: events.filter(
        (e) => e.stage === "executed" && reviewed.has(e.run),
      ).length,
      cost: null,
      trend: [...trend]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({
          date,
          executed: d.executed,
          verified: d.verified,
          distinctSkills: d.skills.size,
        })),
      blockedReasons: [...blockedReasons].map(([reason, count]) => ({
        reason,
        count,
      })),
      perSkill,
      events,
    },
  };
}
export function change(
  db: DatabaseSync,
  c: Config,
  action: string,
  body: Record<string, unknown>,
  now = Date.now(),
  authenticated?: Actor,
): Record<string, any> {
  return transaction(db, () => {
    c = configOf(db); // Recheck current operator policy inside the write transaction.
    const actor = authenticated ?? installationActor(c.client);
    requireMutation(db, c.client, actor, action);
    prune(db, c, now);
    const { revision, plan } = planOf(db);
    if (action !== "reconcile" && body.planRevision !== undefined)
      requireValue(
        body.planRevision === revision,
        "The plan changed. Reload before acting.",
        409,
      );
    if (action === "plan" || action === "new-plan") {
      requireValue(
        c.permissions.includes("plan.edit"),
        "Plan editing is disabled for this installation.",
        403,
      );
      requireValue(
        body.planRevision === revision,
        "Reload the latest plan before saving.",
        409,
      );
      const proposed = body.plan as Plan;
      if (
        Array.isArray(proposed?.tasks) &&
        !c.permissions.includes("work.record")
      ) {
        const existing = new Set(
          action === "plan"
            ? plan.tasks
                .filter((t) => t.evidence?.kind === "deliverable")
                .map((t) => t.id)
            : [],
        );
        requireValue(
          !proposed.tasks.some(
            (t) => t?.evidence?.kind === "deliverable" && !existing.has(t.id),
          ),
          "Work evidence recording requires the installation grant.",
          403,
        );
      }
      if (action === "plan") return savePlan(db, revision, proposed);
      const draft = validatePlan(proposed);
      requireValue(
        draft.tasks.every((t) => !row(db, t.id)),
        "A new goal requires fresh task IDs.",
        409,
      );
      const old = snapshot(db, c, now);
      db.prepare("INSERT INTO plan_archive VALUES(?,?,?)").run(
        revision,
        now,
        JSON.stringify({
          plan: old.plan,
          tasks: old.tasks,
          approved: old.approved,
          approval: old.approval,
          revision,
        }),
      );
      db.prepare(
        "UPDATE plan SET revision=revision+1,approved_at=NULL,approved_principal=NULL,document=?",
      ).run(JSON.stringify(draft));
      db.exec("UPDATE installation SET approved=0");
      for (const t of draft.tasks)
        db.prepare("INSERT INTO tasks(id) VALUES(?)").run(t.id);
      return { revision: revision + 1, changed: true };
    }
    if (action === "reconcile") {
      requireValue(
        c.permissions.includes("fixture.import"),
        "Synthetic import is disabled for this installation.",
        403,
      );
      return reconcile(db, c, body);
    }
    const approved = db
      .prepare("SELECT approved FROM installation")
      .get()?.approved;
    if (action === "approve") {
      for (const t of plan.tasks) {
        const existing = row(db, t.id);
        if (!existing?.cancelled && !existing?.verified) {
          const reason = evidenceBlocker(t, c);
          requireValue(
            !reason,
            reason ?? "Completion evidence is unavailable.",
            409,
          );
        }
      }
      const conflict = dependencyDates(plan).find((i) => {
        const task = row(db, i.task);
        return !task?.verified && !task?.cancelled;
      });
      requireValue(
        !conflict,
        conflict?.message ?? "Correct the scheduling conflict before approval.",
        409,
      );
      requireValue(
        plan.months.length && plan.weeks.length && plan.tasks.length,
        "Add a monthly outcome, weekly milestone and daily task before approval.",
        409,
      );
      if (!approved) {
        db.prepare("UPDATE plan SET approved_at=?, approved_principal=?").run(
          now,
          actor.principal,
        );
        db.exec("UPDATE installation SET approved=1");
      }
      return { approved: true };
    }
    const task = plan.tasks.find((t) => t.id === body.task);
    requireValue(task, "Task not found in this installation.", 404);
    const r = row(db, task.id)!;
    if (action !== "cancel")
      requireValue(
        approved &&
          !r.cancelled &&
          (!task.after || row(db, task.after)?.verified),
        "Approve the goal and resolve the task dependency first.",
        409,
      );
    if (action !== "cancel" && !r.verified) {
      const reason = evidenceBlocker(task, c);
      requireValue(
        !reason,
        reason ?? "Completion evidence is unavailable.",
        403,
      );
    }
    let run = r.run || randomUUID();
    if (
      action === "measure" &&
      (r.failure || r.value !== body.value || r.reference !== body.reference)
    )
      run = randomUUID();
    const event = (
      stage: string,
      reason: string | null = null,
      duration: number | null = null,
      revision: string | null = r.selected,
    ) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO events SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM events WHERE run=? AND stage=? AND revision IS ? AND reason IS ?)",
        )
        .run(
          run +
            "." +
            (revision ?? "none") +
            "." +
            stage +
            (reason ? "." + reason : ""),
          run,
          task.id,
          stage,
          reason,
          revision,
          now,
          duration,
          run,
          stage,
          revision,
          reason,
        );
    if (action === "submit-work" || action === "review-work") {
      requireValue(
        c.permissions.includes("work.record"),
        "Work evidence recording requires the installation grant.",
        403,
      );
      requireValue(
        task.evidence?.kind === "deliverable",
        "This action requires a work-product task.",
        409,
      );
      requireValue(
        typeof body.reference === "string" &&
          /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(body.reference),
        "Use a short local evidence ID.",
      );
      const receipt = publicReceipt(r.receipt);
      if (action === "submit-work") {
        requireValue(
          clean(body.summary),
          "Describe the work product in 1–120 characters.",
        );
        // A retried submission can echo its prior receipt. Replacements must name the current run.
        if (
          receipt?.principal === actor.principal &&
          receipt.output === body.summary &&
          receipt.reference === body.reference &&
          (body.expectedRun === receipt.previousRun ||
            body.expectedRun === r.run)
        )
          return receipt;
        requireValue(
          !r.verified && body.expectedRun === r.run,
          "Work evidence changed. Reload before submitting.",
          409,
        );
        const nextRun = randomUUID();
        const work = {
          kind: "deliverable",
          task: task.id,
          run: nextRun,
          previousRun: r.run,
          reference: body.reference,
          output: body.summary,
          criterion: task.evidence.criterion,
          taskOwner: task.owner,
          principal: actor.principal,
          at: now,
        };
        db.prepare(
          "UPDATE tasks SET run=?,reference=?,receipt=? WHERE id=?",
        ).run(nextRun, body.reference, JSON.stringify(work), task.id);
        return work;
      }
      requireValue(
        receipt?.kind === "deliverable" &&
          body.expectedRun === r.run &&
          body.reference === receipt.reference,
        "Review the current work product and confirm its evidence ID.",
        409,
      );
      if (!r.verified)
        db.prepare("UPDATE tasks SET verified=?,receipt=? WHERE id=?").run(
          now,
          JSON.stringify({ ...receipt, reviewedByPrincipal: actor.principal }),
          task.id,
        );
      return { verified: true, run: r.run };
    }
    requireValue(
      action === "cancel" || task.evidence?.kind !== "deliverable",
      "This work product requires submission and evidence review.",
      409,
    );
    if (action === "measure") {
      requireValue(
        !r.receipt,
        "The receipt already fixes this measurement.",
        409,
      );
      requireValue(
        typeof body.value === "number" && Number.isFinite(body.value),
        "Enter a finite measurement.",
      );
      requireValue(
        typeof body.reference === "string" &&
          /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(body.reference),
        "Use a short local evidence ID.",
      );
      if (
        !r.failure &&
        r.value === body.value &&
        r.reference === body.reference
      )
        return { saved: true };
      db.prepare(
        "UPDATE tasks SET value=?,reference=?,run=?,selected=NULL,routing=NULL,failure=NULL WHERE id=?",
      ).run(body.value, body.reference, run, task.id);
      if (r.failure) event("retry");
      return { saved: true };
    }
    if (action === "cancel") {
      if (r.cancelled) return { cancelled: true };
      requireValue(
        !r.receipt || (task.evidence?.kind === "deliverable" && !r.verified),
        "A finished calculation or verified work product cannot be cancelled.",
        409,
      );
      db.prepare(
        "UPDATE tasks SET cancelled=1,selected=NULL,routing=NULL,run=? WHERE id=?",
      ).run(run, task.id);
      event("cancelled", null, null, null);
      return { cancelled: true };
    }
    if (action === "select" || action === "choose-output") {
      requireValue(!r.receipt, "This task already has a receipt.", 409);
      const eligibleConfig =
        task.evidence?.kind === "observation"
          ? { ...c, enabledSkills: c.enabledSkills.filter(isMeasurementPin) }
          : c;
      const measured = r.value !== null && !!r.reference;
      const direct = action === "choose-output";
      let match;
      let revisions: string[];
      if (direct) {
        requireValue(
          body.expectedRun === r.run,
          "Selection changed. Review the current task inputs and confirm again.",
          409,
        );
        const requested = body.revisions;
        requireValue(
          Array.isArray(requested) &&
            requested.length > 0 &&
            requested.length <= catalogue.length &&
            requested.every((item) => typeof item === "string") &&
            new Set(requested).size === requested.length,
          "Choose one or more distinct output revisions.",
        );
        requireValue(
          requested.every((item) => eligible(eligibleConfig, item)),
          "An output is unavailable for this task or installation.",
          403,
        );
        requireValue(
          measured ||
            requested.every(
              (item) =>
                !catalogue.find((entry) => entry.pin === item)
                  ?.needsMeasurement,
            ),
          "Save the measurement and evidence ID for all chosen outputs first.",
          409,
        );
        revisions = requested as string[];
        match = {
          selected: revisions[0],
          alternatives: [],
          requiresChoice: false,
          reason: "Operator confirmed the chosen local outputs.",
        };
      } else {
        match = selectSkill(
          eligibleConfig,
          body.intent,
          body.revision,
          measured,
          plan.quarter.metric,
          plan.quarter.unit,
        );
        revisions = match.selected ? [match.selected] : [];
      }
      const prior = r.routing ? JSON.parse(r.routing) : null;
      const priorRevisions =
        prior?.revisions ?? (r.selected ? [r.selected] : []);
      if (
        r.selected &&
        (JSON.stringify(priorRevisions) !== JSON.stringify(revisions) ||
          direct !== (prior?.method === "operator"))
      )
        run = randomUUID();
      const method = direct ? "operator" : "language";
      const priorSame =
        prior?.method === method &&
        JSON.stringify(priorRevisions) === JSON.stringify(revisions);
      const routing = {
        method,
        revisions,
        reason: match.reason,
        alternatives: match.alternatives,
        requiresChoice: match.requiresChoice,
        permissions: [
          ...new Set(
            catalogue
              .filter((s) => revisions.includes(s.pin))
              .flatMap((s) => [...s.permissions]),
          ),
        ],
        runner:
          catalogue.find((s) => s.pin === match.selected)?.runtime ?? null,
        owner: task.owner,
        at: now,
      };
      db.prepare(
        "UPDATE tasks SET run=?,selected=?,routing=?,failure=? WHERE id=?",
      ).run(
        run,
        match.selected,
        JSON.stringify(routing),
        priorSame ? r.failure : null,
        task.id,
      );
      if (!match.selected) event("blocked", match.reason, null, null);
      for (const revision of revisions) {
        if (direct) event("operator-chosen", null, null, revision);
        else {
          event("suggested", null, null, revision);
          event(
            body.revision === undefined
              ? "automatic-selection"
              : "confirmed-language-choice",
            null,
            null,
            revision,
          );
        }
        event("selected", null, null, revision);
      }
      return {
        ...match,
        revisions,
        method,
        owner: task.owner,
        run,
        matchedAt: now,
      };
    }
    requireValue(
      ["read-skill", "run", "verify"].includes(action),
      "Unknown action.",
      404,
    );
    const saved = r.routing ? JSON.parse(r.routing) : null;
    const revisions: string[] =
      saved?.revisions ?? (r.selected ? [r.selected] : []);
    if (body.expectedRun !== undefined)
      requireValue(
        body.expectedRun === r.run,
        "Selection changed. Review the current task inputs and confirm again.",
        409,
      );
    requireValue(
      r.selected &&
        revisions[0] === r.selected &&
        revisions.every(
          (revision) =>
            eligible(c, revision) &&
            (task.evidence?.kind !== "observation" ||
              isMeasurementPin(revision)),
        ),
      "The pinned skill must be selected and permitted.",
      403,
    );
    if (body.expectedSkill !== undefined)
      requireValue(
        body.expectedSkill === r.selected,
        "Selection changed. Review the current task.",
        409,
      );
    if (action === "read-skill") {
      const records = revisions.map((revision) => {
        const record = catalogue.find((s) => s.pin === revision)!;
        const procedure = loadProcedure(revision);
        event("opened", null, null, revision);
        return {
          steps: procedure.steps,
          instructionHash: procedure.instructionHash,
          run: r.run,
          pin: revision,
          purpose: record.purpose,
          inputs: record.inputs,
          output: record.output,
          excludes: record.excludes,
          permissions: record.permissions,
          tools: record.tools,
        };
      });
      return {
        ...records[0],
        ...(records.length > 1 ? { additionalRecords: records.slice(1) } : {}),
      };
    }
    if (action === "run") {
      if (r.receipt) return publicReceipt(r.receipt);
      if (r.failure) return { failure: r.failure };
      const results = [];
      for (const revision of revisions) {
        const started = performance.now();
        const procedure = loadProcedure(revision);
        event("loaded", null, null, revision);
        const result = localResult(
          revision,
          procedure,
          task,
          plan.quarter,
          r,
          run,
          actor.principal,
          now,
        );
        event("executed", null, performance.now() - started, revision);
        if ("failure" in result) {
          event("failed", "Numeric range", null, revision);
          db.prepare("UPDATE tasks SET failure=? WHERE id=?").run(
            result.failure!,
            task.id,
          );
          return result;
        }
        results.push(result);
      }
      const receipt = {
        ...results[0],
        ...(results.length > 1 ? { additional: results.slice(1) } : {}),
      };
      const encoded = JSON.stringify(receipt);
      db.prepare("UPDATE tasks SET receipt=? WHERE id=?").run(encoded, task.id);
      return publicReceipt(encoded);
    }
    requireValue(r.receipt, "Run the selected skill first.", 409);
    const receipt = publicReceipt(r.receipt);
    requireValue(
      body.reference === receipt.reference,
      "The review reference must match the recorded evidence.",
      409,
    );
    const additional = receipt.additional ?? [];
    const references = body.additionalReferences ?? [];
    requireValue(
      Array.isArray(references) &&
        references.length === additional.length &&
        additional.every(
          (item: { reference: string }, index: number) =>
            references[index] === item.reference,
        ),
      "Confirm the matching evidence reference for each additional output.",
      409,
    );
    if (!r.verified) {
      db.prepare("UPDATE tasks SET verified=?,receipt=? WHERE id=?").run(
        now,
        JSON.stringify({
          ...receipt,
          reviewedByPrincipal: actor.principal,
          ...(additional.length
            ? {
                additional: additional.map((item: object) => ({
                  ...item,
                  reviewedByPrincipal: actor.principal,
                })),
              }
            : {}),
        }),
        task.id,
      );
      for (const revision of revisions) event("verified", null, null, revision);
    }
    return { verified: true, run };
  });
}

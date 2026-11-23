import { ACCENTS } from "../sample.ts";

export const kitVersion = "0.2.0-review.12";
export const skill = {
  id: "workos.goal-checkin",
  version: "1.0.0",
  name: "Goal check-in",
  purpose:
    "Compare a recorded measurement with the approved goal and save the calculation.",
  example: "Review goal progress",
  inputs: "A daily task and an owner-recorded measurement",
  output: "A local evidence receipt with the measured change and target",
  owner: "Installation operator",
  runtime: "WorkOS local deterministic runner",
  dependencies: "Node 24, built-in SQLite and the listed local tool",
  resource: "Local CPU only. Metered cost unknown.",
  maintenance:
    "Pin an exact revision in the installation config. Mark deprecated revisions before retiring them. Retain historical receipts and the previous checkout.",
  provenance: "Original AI-Dashboard implementation",

  tools: ["WorkOS local calculator"],
  permissions: ["goals.read", "receipts.write"],
  source: "lib/workos/operations.ts",
  license: "Repository MIT",
  evidence: "tests/workos.test.ts and tests/workos-expansion.test.ts",
  excludes:
    "Forecasts, external services, unmeasured goals and autonomous decisions",
} as const;
export const pin = skill.id + "@" + skill.version;
export const progressPin = skill.id + "@1.1.0";
export const isMeasurementPin = (revision: string) =>
  revision === pin || revision === progressPin;
export const deadlinePin = "workos.deadline-review@1.0.0";
export const handoffPin = "workos.evidence-handoff@1.0.0";
export const catalogue = [
  {
    ...skill,
    pin,
    outputLabel: "Measurement comparison in original units",
    needsMeasurement: true,
  },
  {
    ...skill,
    pin: progressPin,
    outputLabel: "Percentage of the baseline-to-target distance covered",
    version: "1.1.0",
    name: "Goal check-in with target progress",
    example: "Calculate target progress",
    output:
      "Observed change and signed percentage of the distance from baseline to target",
    needsMeasurement: true,
  },
  {
    ...skill,
    id: "workos.deadline-review",
    pin: deadlinePin,
    outputLabel: "Calendar days to the task due date",
    name: "Deadline review",
    purpose:
      "Calculate remaining calendar days from the current UTC date to the task deadline.",
    inputs: "A task with a due date",
    output: "Dated schedule receipt",
    example: "Check the task deadline",
    tools: ["WorkOS local calendar"],
    permissions: ["queue.read", "receipts.write"],
    excludes: "Business measurements, rescheduling and reminders",
    needsMeasurement: false,
  },
  {
    ...skill,
    id: "workos.evidence-handoff",
    pin: handoffPin,
    outputLabel: "Local evidence handoff note",
    name: "Evidence handoff",
    purpose: "Prepare a local review note for the accountable task owner.",
    inputs: "An assigned task and recorded evidence ID",
    output: "Local handoff note with the evidence reference",
    example: "Prepare a handoff note",
    tools: ["WorkOS local notes"],
    permissions: ["queue.read", "evidence.read", "receipts.write"],
    excludes: "Sending a message, publishing or claiming delivery",
    needsMeasurement: true,
  },
];
export const localTools = catalogue.flatMap((entry) => entry.tools);
export const grants = [
  ...new Set([
    ...catalogue.flatMap((entry) => [...entry.permissions]),
    "plan.edit",
    "work.record",
    "fixture.import",
    "catalogue.review",
  ]),
];
export const modules = [
  "metrics",
  "team",
  "skills",
  "second-brain",
  "decisions",
] as const;

export type Config = {
  schema: 1;
  client: string;
  name: string;
  owner: string;
  accent: string;
  port: number;
  modules: string[];
  availableTools?: string[];
  deprecatedSkills?: string[];
  enabledSkills: string[];
  permissions: string[];
  retentionDays: number;
  goal: {
    quarter: string;
    month: string;
    week: string;
    metric: string;
    unit: string;
    baseline: number;
    target: number;
    source: string;
    due: string;
  };
  tasks: { id: string; title: string; due: string; after: string | null }[];
};

export class Problem extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function requireValue(
  value: unknown,
  message: string,
  status = 400,
): asserts value {
  if (!value) throw new Problem(message, status);
}
export const clean = (s: unknown) =>
  typeof s === "string" &&
  s.length > 0 &&
  s.length <= 120 &&
  s.trim() === s &&
  !/[<>\u0000-\u001f]/.test(s);
export const slug = (s: unknown) =>
  typeof s === "string" && /^[a-z][a-z0-9-]{1,39}$/.test(s);
export const date = (s: string) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(s)) &&
  new Date(s).toISOString().slice(0, 10) === s;
export const only = (obj: object, keys: string[]) =>
  obj &&
  typeof obj === "object" &&
  !Array.isArray(obj) &&
  Object.keys(obj).every((k) => keys.includes(k)) &&
  keys.every((k) => Object.hasOwn(obj, k));
const list = (v: unknown, allowed: readonly string[]) =>
  Array.isArray(v) &&
  v.every((x) => allowed.includes(x)) &&
  new Set(v).size === v.length;

export function validate(c: Config) {
  requireValue(
    only(c, [
      "schema",
      "client",
      "name",
      "owner",
      "accent",
      "port",
      "modules",
      "enabledSkills",
      ...(c && Object.hasOwn(c, "availableTools") ? ["availableTools"] : []),
      ...(c && Object.hasOwn(c, "deprecatedSkills")
        ? ["deprecatedSkills"]
        : []),
      "permissions",
      "retentionDays",
      "goal",
      "tasks",
    ]),
    "Invalid configuration fields.",
  );
  requireValue(
    c.schema === 1 &&
      slug(c.client) &&
      clean(c.name) &&
      clean(c.owner) &&
      Object.hasOwn(ACCENTS, c.accent),
    "Check schema, client ID, name, owner and accent.",
  );
  requireValue(
    Number.isInteger(c.port) && c.port >= 1024 && c.port <= 65535,
    "Choose an unprivileged local port.",
  );
  requireValue(
    Number.isInteger(c.retentionDays) &&
      c.retentionDays >= 1 &&
      c.retentionDays <= 365,
    "Retention must be 1–365 days.",
  );
  requireValue(
    list(c.modules, modules) &&
      (c.deprecatedSkills === undefined ||
        list(
          c.deprecatedSkills,
          catalogue.map((s) => s.pin),
        )) &&
      list(
        c.enabledSkills,
        catalogue.map((s) => s.pin),
      ) &&
      (c.availableTools === undefined || list(c.availableTools, localTools)) &&
      list(c.permissions, grants),
    "Unknown module, skill revision or permission.",
  );
  const g = c.goal;
  requireValue(
    only(g, [
      "quarter",
      "month",
      "week",
      "metric",
      "unit",
      "baseline",
      "target",
      "source",
      "due",
    ]) &&
      [g.quarter, g.month, g.week, g.metric, g.unit, g.source].every(clean) &&
      date(g.due),
    "Check goal descriptions and due date.",
  );
  requireValue(
    [g.baseline, g.target, g.target - g.baseline].every(Number.isFinite) &&
      g.baseline !== g.target,
    "Provide distinct finite baseline and target measurements.",
  );
  requireValue(
    Array.isArray(c.tasks) && c.tasks.length > 0 && c.tasks.length <= 50,
    "Provide 1–50 daily actions.",
  );
  const seen = new Set<string>();
  for (const t of c.tasks) {
    requireValue(
      only(t, ["id", "title", "due", "after"]) &&
        slug(t.id) &&
        !seen.has(t.id) &&
        clean(t.title) &&
        date(t.due) &&
        t.due <= g.due,
      "Check task IDs, titles and deadlines.",
    );
    requireValue(
      t.after === null || seen.has(t.after),
      "A dependency must be an earlier task.",
    );
    seen.add(t.id);
  }
  return c;
}

export function eligible(c: Config, revision = pin) {
  const entry = catalogue.find((s) => s.pin === revision);
  return (
    !!entry &&
    c.modules.includes("skills") &&
    c.enabledSkills.includes(revision) &&
    !c.deprecatedSkills?.includes(revision) &&
    entry.permissions.every((p) => c.permissions.includes(p)) &&
    entry.tools.every((tool) =>
      (c.availableTools ?? [skill.tools[0]]).includes(tool),
    )
  );
}

export const canReviewCatalogue = (c: Config) =>
  c.modules.includes("skills") && c.permissions.includes("catalogue.review");

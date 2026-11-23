import type { Plan } from "./plan.ts";
import { clean, date } from "./config.ts";

const day = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const makeId = () => "node-" + crypto.randomUUID().slice(0, 20);
function title(text: string) {
  // The plan schema limits UTF-16 units. Avoid splitting a surrogate pair in a long title.
  return text
    .slice(0, 120)
    .replace(/[\uD800-\uDBFF]$/u, "")
    .trimEnd();
}

export type PilotApproach = "turnaround" | "conversion" | "quality";
export type Pilot = { approach: PilotApproach; scope: string; change: string };

const pilotStages = {
  turnaround: [
    [
      "Locate the longest wait in",
      "A timestamped sample identifies the slowest handoff in",
    ],
    [
      "Design a faster handoff for",
      "A revised handoff lists the owner, trigger and expected wait for",
    ],
    [
      "Trial the faster handoff in",
      "A dated before-and-after handoff log records the trial in",
    ],
  ],
  conversion: [
    [
      "Find the largest drop-off in",
      "Stage counts and their denominators identify the largest drop-off in",
    ],
    [
      "Design a conversion trial for",
      "A trial brief identifies the cohort, change and success measure for",
    ],
    [
      "Run the conversion trial in",
      "A trial log records exposures and completions for",
    ],
  ],
  quality: [
    [
      "Identify recurring errors in",
      "A reviewed sample groups defects and identifies the leading cause in",
    ],
    [
      "Design a quality check for",
      "A check sheet names the failure condition, owner and review point for",
    ],
    [
      "Trial the quality check in",
      "A dated sample records checks performed and defects observed in",
    ],
  ],
} as const;

export function draftSteps(
  quarter: Plan["quarter"],
  id = makeId,
  startDate?: string,
  pilot?: Pilot,
): Pick<Plan, "months" | "weeks" | "tasks"> {
  if (
    ![
      quarter.title,
      quarter.owner,
      quarter.metric,
      quarter.unit,
      quarter.source,
    ].every(clean) ||
    !date(quarter.due) ||
    ![
      quarter.baseline,
      quarter.target,
      quarter.target - quarter.baseline,
    ].every(Number.isFinite) ||
    quarter.target === quarter.baseline
  ) {
    throw Error(
      "Complete the quarterly commitment and choose distinct baseline and target values first.",
    );
  }
  const end = Date.parse(quarter.due);
  const first =
    startDate === undefined
      ? Math.max(Date.parse("0000-01-01"), end - 7 * day)
      : Date.parse(startDate);
  if (
    startDate !== undefined &&
    (!date(startDate) || first > end || end - first > 91 * day)
  ) {
    throw Error(
      "Choose a start date within the 92 calendar days ending on the quarter deadline.",
    );
  }
  const dates = [first];
  if (pilot) {
    if (!startDate || end - first < 4 * day)
      throw Error("Choose at least five calendar days for a work pilot.");
    if (
      !Object.hasOwn(pilotStages, pilot.approach) ||
      !clean(pilot.scope) ||
      !clean(pilot.change) ||
      pilot.scope.length > 44 ||
      pilot.change.length > 44
    )
      throw Error(
        "Choose a pilot approach, work area and change to test. Each entry supports 44 characters.",
      );
    const span = (end - first) / day;
    for (const fraction of [0.25, 0.5, 0.75])
      dates.push(first + Math.floor(span * fraction) * day);
  } else if (startDate !== undefined) {
    for (let t = first + day; t < end; t += day) {
      if (
        new Date(t).getUTCDay() === 0 ||
        iso(t).slice(0, 7) !== iso(t + day).slice(0, 7)
      )
        dates.push(t);
    }
  }
  dates.push(end);
  const months: Plan["months"] = [],
    weeks: Plan["weeks"] = [],
    tasks: Plan["tasks"] = [];
  const weekGroups = new Map<string, Plan["weeks"][number]>();
  for (const [index, t] of dates.entries()) {
    const due = iso(t),
      prefix = due.slice(0, 7);
    let month = months.at(-1);
    if (!month || month.due.slice(0, 7) !== prefix) {
      const last = new Date(t);
      last.setUTCMonth(last.getUTCMonth() + 1, 0);
      month = {
        id: id(),
        title: title(prefix + " progress on " + quarter.title),
        owner: quarter.owner,
        due: iso(Math.min(end, last.valueOf())),
        parent: "quarter",
      };
      months.push(month);
    }
    const weekday = (new Date(t).getUTCDay() + 6) % 7;
    const key = prefix + "/" + (t - weekday * day);
    const initial = index === 0,
      final = index === dates.length - 1;
    let week = weekGroups.get(key);
    if (!week) {
      const label = initial
        ? "Establish the baseline for "
        : final
          ? "Review the result for "
          : "Review weekly evidence for ";
      week = {
        id: id(),
        title: title(label + quarter.metric),
        owner: quarter.owner,
        due,
        parent: month.id,
      };
      weeks.push(week);
      weekGroups.set(key, week);
    } else {
      week.due = due;
    }
    const label = initial
      ? "Record baseline evidence for " +
        quarter.metric +
        " (" +
        quarter.baseline +
        " " +
        quarter.unit +
        ")"
      : final
        ? "Compare the final reading for " +
          quarter.metric +
          " (" +
          quarter.target +
          " " +
          quarter.unit +
          ")"
        : "Record " + quarter.metric + " from " + quarter.source;
    const stage =
      pilot && !initial && !final
        ? pilotStages[pilot.approach][index - 1]
        : null;
    const stageTitle =
      stage && pilot
        ? stage[0] +
          " " +
          pilot.scope +
          (index === 2 || index === 3 ? " · " + pilot.change : "")
        : label;
    if (pilot) {
      if (initial || final)
        week.title = title(
          (initial ? "Baseline for " : "Review the pilot result for ") +
            pilot.scope,
        );
      if (stage) week.title = title(stage[0] + " " + pilot.scope);
      month.title = title(prefix + " pilot milestones for " + pilot.scope);
    }
    tasks.push({
      id: id(),
      title: title(stageTitle),
      owner: quarter.owner,
      due,
      parent: week.id,
      after: (pilot ? tasks.at(-1) : tasks[0])?.id ?? null,
      ...(pilot
        ? {
            evidence: stage
              ? {
                  kind: "deliverable" as const,
                  criterion: title(stage[1] + " " + pilot.scope + "."),
                }
              : { kind: "observation" as const },
          }
        : {}),
    });
  }
  return { months, weeks, tasks };
}

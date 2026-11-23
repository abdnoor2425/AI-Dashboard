import { requireValue } from "./config.ts";
import type { Plan } from "./plan.ts";
import { loadProcedure } from "./procedures.ts";

export function localResult(
  revision: string,
  procedure: ReturnType<typeof loadProcedure>,
  task: Plan["tasks"][number],
  goal: Plan["quarter"],
  observation: { value: number | null; reference: string | null },
  run: string,
  principal: string,
  now: number,
) {
  const base = {
    run,
    task: task.id,
    revision,
    principal,
    instructionHash: procedure.instructionHash,
    taskOwner: task.owner,
    at: now,
  };
  if (procedure.kind === "deadline") {
    const today = new Date(now).toISOString().slice(0, 10);
    const days = (Date.parse(task.due) - Date.parse(today)) / 86400000;
    return {
      ...base,
      reference: task.id,
      output: `${task.title} is due ${task.due} (${days} calendar days from ${today} UTC).`,
    };
  }
  const { value, reference } = observation;
  requireValue(reference && value !== null, "Record evidence first.", 409);
  if (procedure.kind === "handoff") {
    return {
      ...base,
      reference,
      output: `Review ${task.title} with ${task.owner}. Evidence ${reference} records ${value} ${goal.unit}.`,
    };
  }
  const change = value - goal.baseline;
  const progress = change / (goal.target - goal.baseline);
  if (
    !Number.isFinite(change) ||
    !Number.isFinite(progress) ||
    (procedure.kind === "target-progress" && !Number.isFinite(progress * 100))
  ) {
    return {
      failure:
        "Measurement exceeds the local calculator range. Review the value and save a new measurement.",
    };
  }
  return {
    ...base,
    reference,
    observed: value,
    baseline: goal.baseline,
    target: goal.target,
    unit: goal.unit,
    change,
    ...(procedure.kind === "target-progress"
      ? { progressPercent: progress * 100 }
      : {}),
  };
}

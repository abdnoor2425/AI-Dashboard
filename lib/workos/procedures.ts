import { createHash } from "node:crypto";
import {
  deadlinePin,
  handoffPin,
  pin,
  progressPin,
  requireValue,
} from "./config.ts";

// Original local procedures. Public catalogue search exposes their metadata; full steps are loaded for an eligible selection.
const procedures = {
  [pin]: {
    kind: "measurement",
    steps: [
      "Read the approved goal baseline, target and unit and the selected task's recorded value and evidence reference.",
      "Subtract the baseline from the observed value. Reject non-finite numeric results.",
      "Save the observation, change, target and reference to a local receipt for review.",
    ],
  },
  [progressPin]: {
    kind: "target-progress",
    steps: [
      "Read the approved baseline, target, unit, recorded observation and evidence reference.",
      "Divide the change from baseline by the difference from baseline to target. Multiply by 100 and reject non-finite results.",
      "Save the signed target-progress percentage, observation, change and reference to a local receipt for review.",
    ],
  },
  [deadlinePin]: {
    kind: "deadline",
    steps: [
      "Read the selected task's deadline and the current UTC calendar date.",
      "Calculate the signed count of calendar days from today to the deadline.",
      "Save the date, day count and task reference to a local receipt for review.",
    ],
  },
  [handoffPin]: {
    kind: "handoff",
    steps: [
      "Read the selected task, its accountable owner and the recorded measurement, unit and evidence ID.",
      "Compose a note identifying the work, owner and supporting observation.",
      "Save the draft and its evidence ID to a local receipt for review.",
    ],
  },
} as const;
export function loadProcedure(revision: string) {
  const entry = Object.hasOwn(procedures, revision)
    ? procedures[revision]
    : undefined;
  requireValue(entry, "The selected local procedure is unavailable.", 409);
  const instructionHash = createHash("sha256")
    .update(JSON.stringify([revision, entry.kind, entry.steps]))
    .digest("hex");
  return { ...entry, instructionHash };
}

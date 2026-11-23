import {
  catalogue,
  eligible,
  pin,
  deadlinePin,
  progressPin,
  handoffPin,
  type Config,
} from "./config.ts";

import { speechAct, sharedReadHead } from "./speech-act.ts";
import { projectedOutput } from "./output-projection.ts";
import { clarifyOutput, resultQualifier } from "./task-language.ts";
import { normalizeRequest, naturalRevisions } from "./intent.ts";
import { conversationalRevisions } from "./conversational.ts";

const aliases: Record<string, string[]> = {
  [pin]: [
    "review goal progress",
    "compare the latest measurement with the target",
    "check goal progress",
    "compare the measurement to the target",
    "calculate progress",
    "progress check",
  ],
  [progressPin]: [
    "calculate target progress",
    "review goal progress",
    "compare the latest measurement with the target",
  ],
  [deadlinePin]: [
    "check the task deadline",
    "review the deadline",
    "check the due date",
    "calculate days remaining",
    "how many days are left",
    "schedule check",
  ],
  [handoffPin]: [
    "prepare a handoff note",
    "draft an evidence handoff",
    "summarize the evidence for the owner",
    "prepare the review note",
  ],
};
const exactRequests = new Map<string, string[]>();
for (const [revision, phrases] of Object.entries(aliases)) {
  for (const phrase of phrases) {
    const matches = exactRequests.get(phrase) ?? [];
    matches.push(revision);
    exactRequests.set(phrase, matches);
  }
}
// Conjunctions may join operands or independent requests. Prefer a complete
// partition when each span names an operation; otherwise check the whole clause.
function requestClauses(
  phrase: string,
  metric: string,
  unit: string,
): (readonly string[])[] {
  const revisionsFor = (text: string) => {
    // Only ground a named unit already in the active plan. This is an output
    // unit for a comparison, never authorization for a conversion or a new input.
    const namedUnits =
      /,? in (hours?|minutes?|days?|weeks?|seconds?|points?|dollars?|units?|items?)$/u;
    const suffix = namedUnits.exec(text);
    const namesUnit =
      suffix &&
      suffix[1].replace(/s$/u, "") ===
        unit.trim().toLowerCase().replace(/s$/u, "");
    const grounded =
      namesUnit &&
      /\b(?:actual|reading|measurement|value|result|target|goal|baseline)\b/u.test(
        text,
      )
        ? text.slice(0, suffix.index) + " in units"
        : text;
    let recognized = grounded;
    let matches: readonly string[] =
      exactRequests.get(text) ?? naturalRevisions(grounded, metric);
    if (!matches.length) {
      recognized = clarifyOutput(grounded);
      if (recognized !== grounded)
        matches =
          exactRequests.get(recognized) ?? naturalRevisions(recognized, metric);
    }
    if (!matches.length) matches = projectedOutput(text, metric);
    if (!matches.length) {
      // The conversational layer already separates a general check-in
      // (both goal revisions) from an explicit comparison (1.0.0 only).
      const conversational = conversationalRevisions(text, metric);
      if (conversational.length) return conversational;
    }
    if (!matches.includes(pin) || !matches.includes(progressPin))
      return matches;
    // Both revisions support a general check-in. When the user specifies a
    // comparison, do not silently add the percentage calculation or substitute
    // a different pinned procedure if the requested one is unavailable.
    const broadProgress =
      /\b(?:progress|status|check-in|doing|coming along)\b/u.test(recognized);
    const comparison =
      /\b(?:baseline|starting|began|started|observation|value|reading|actuals?|measurement|figure|number|result|compare|relative|against|versus|vs|gap|change|difference|delta|above|below|met|meet|hit|reached|off|close)\b/u.test(
        recognized,
      );
    return !broadProgress || comparison ? [pin] : matches;
  };
  if (!phrase) return [];
  const spoken = speechAct(phrase);
  const unwrapped = spoken
    .replace(
      /^(?:(?:can|could) we |i(?:'d| would) like to |i want to )?(?:either|both) /u,
      "",
    )
    .replace(
      /^(?:which (?:one )?should i (?:do|tackle)(?: here)?|two (?:things|tasks)(?: please| are pending here| for (?:this|my) (?:item|task|ticket))?)\s*:\s*/u,
      "",
    );
  const separators = [
    ...unwrapped.matchAll(
      /(?:\s*,?\s+(?:and separately|and then|and also|and\/or|as well as|along with|plus|then|and|or)\s+|\s*[,;]\s*(?:(?:and|then|or|also|separately),?\s+)?|[.?!]\s+(?:(?:also|separately|next|secondly|second),?\s+)?|\s+\/\s+)/gu,
    ),
  ];
  const whole = revisionsFor(spoken);
  const head = sharedReadHead(unwrapped);
  if (!separators.length) return whole.length ? [whole] : [];
  if (separators.length > 8) return [];

  function operand(raw: string) {
    const text = speechAct(normalizeRequest(raw)).replace(
      /^(?:we (?:could|can)|also) /u,
      "",
    );
    const revisions = revisionsFor(text);
    if (revisions.length) return revisions;
    if (head && /^(?:a|an|the|our|my|this) /u.test(text)) {
      const inherited = revisionsFor(head + text);
      if (inherited.length) return inherited;
    }
    if (
      /^(?:a |the )?(?:task )?(?:due[- ]date|deadline)(?: check| review)?(?: for (?:this|the|my) (?:assignment|task|work))?$/u.test(
        text,
      )
    )
      return [deadlinePin];
    if (
      /^(?:a |the )?(?:goal|target) (?:check-in|progress check|progress update)$/u.test(
        text,
      )
    )
      return [pin, progressPin];
    if (
      /^(?:a |an |the )?(?:local |evidence )?(?:handoff|handover|evidence) (?:note|draft|summary|brief)(?: for (?:its|the|my) (?:owner|reviewer))?$/u.test(
        text,
      )
    )
      return [handoffPin];
    return [];
  }
  const memo = new Map<number, (readonly string[])[] | null>();
  function parse(start: number): (readonly string[])[] | null {
    if (memo.has(start)) return memo.get(start)!;
    const tail = operand(unwrapped.slice(start));
    if (start !== 0 && tail.length) return [tail];
    for (const boundary of separators) {
      if (boundary.index <= start) continue;
      const left = operand(unwrapped.slice(start, boundary.index));
      if (!left.length) continue;
      const next = boundary.index + boundary[0].length;
      const qualifier = resultQualifier(
        normalizeRequest(unwrapped.slice(next)),
      );
      const qualifiedPin =
        qualifier === "days"
          ? deadlinePin
          : qualifier === "comparison"
            ? pin
            : qualifier === "note"
              ? handoffPin
              : null;
      if (qualifiedPin && left.length === 1 && left[0] === qualifiedPin)
        return [left];
      const right = parse(next);
      if (right) {
        const result = [left, ...right];
        memo.set(start, result);
        return result;
      }
    }
    memo.set(start, null);
    return null;
  }
  return parse(0) ?? (whole.length ? [whole] : []);
}
export function selectSkill(
  c: Config,
  input: unknown,
  override: unknown,
  measured: boolean,
  activeMetric = c.goal.metric,
  activeUnit = c.goal.unit,
) {
  const permitted = catalogue.filter((entry) => eligible(c, entry.pin));
  const phrase = normalizeRequest(input);
  const clauses = requestClauses(phrase, activeMetric, activeUnit);
  const groups = clauses.map((revisions) =>
    permitted.filter((s) => revisions.includes(s.pin)).map((s) => s.pin),
  );
  const complete =
    groups.length > 0 && groups.every((group) => group.length > 0);
  const needsReading =
    complete &&
    !measured &&
    groups.some((group) =>
      group.every(
        (revision) =>
          permitted.find((s) => s.pin === revision)?.needsMeasurement,
      ),
    );
  const candidates =
    complete && !needsReading ? [...new Set(groups.flat())] : [];
  let reason: string | null = null;
  if (
    !permitted.length ||
    (override !== undefined && !permitted.some((s) => s.pin === override))
  )
    reason = "Revision or permissions unavailable";
  else if (!complete)
    reason = "Request did not match a supported local operation";
  else if (needsReading) reason = "Measurement required";
  else if (override !== undefined && !candidates.includes(String(override)))
    reason = "Pinned skill does not match this task request";
  else if (candidates.length > 1 && !override)
    reason = "Multiple approved matches. Choose the intended revision.";
  const selected = reason
    ? null
    : permitted.find((s) => s.pin === (override || candidates[0]));
  return {
    selected: reason ? null : (selected?.pin ?? null),
    requiresChoice: complete && candidates.length > 1 && override === undefined,
    reason:
      reason ?? "Approved local skill matched the request and its permissions",
    alternatives: candidates,
  };
}

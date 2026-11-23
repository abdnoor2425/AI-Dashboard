import { metricName } from "./phrasing.ts";
import { deadlinePin, handoffPin, pin, progressPin } from "./config.ts";

// Interpret a request as a projection of fields already present in the current
// local task. An entire field list and its entire requested output must match.
// The parser cannot supply values, perform conversions or authorize execution.
type Field =
  | "reading"
  | "baseline"
  | "target"
  | "today"
  | "due"
  | "evidence"
  | "owner";
const fields: readonly [Field, RegExp][] = [
  [
    "reading",
    /^(?:(?:most recent|latest|current|last|saved|observed|recorded|actual|new) )?(?:actual|result|observation|measurement|reading|value|figure|number)$/u,
  ],
  [
    "baseline",
    /^(?:baseline|start|starting point|(?:initial|first|original|starting) (?:measurement|reading|value|figure|number|level))$/u,
  ],
  [
    "target",
    /^(?:target|goal|finish line|(?:agreed|desired|intended|target|planned) (?:level|measurement|reading|value|figure|number|target|goal))$/u,
  ],
  ["today", /^(?:(?:current|today's) (?:utc )?date|today(?: in utc)?)$/u],
  [
    "due",
    /^(?:(?:task |scheduled |assigned )?(?:deadline|due date)|date (?:it's|it is) due|date due)$/u,
  ],
  [
    "evidence",
    /^(?:(?:recorded|saved|local|task|supporting) )?(?:evidence(?: (?:id|reference))?|proof|findings)$/u,
  ],
  [
    "owner",
    /^(?:(?:task|assigned|accountable|next) )?(?:owner|reviewer|person taking over)$/u,
  ],
];
const articles =
  /^(?:(?:the|our|my|its|this task's|the task's|this item's) )+/u;
const intros =
  /^(?:(?:(?:can|could|would) you (?:please )?)|(?:i(?:'m| am| was) (?:trying|hoping) to (?:see|find out|know) )|(?:i(?:'d| would) like (?:to know |to see )?)|(?:please )|(?:just ))/u;
function groundedFields(text: string, metric: string) {
  const parts = text
    .replace(/^(?:from|between) /u, "")
    .split(
      /\s*(?:,? and |, | versus | vs\.? | against | compared (?:to|with) | to )\s*/u,
    );
  if (parts.length < 2 || parts.length > 3) return null;
  const bound = new Set<Field>();
  for (const part of parts) {
    const stripped = part.replace(articles, "");
    const field =
      fields.find(([, pattern]) => pattern.test(stripped))?.[0] ??
      (metricName.test(stripped) && stripped === metric.trim().toLowerCase() ? "reading" : null);
    if (!field || bound.has(field)) return null;
    bound.add(field);
  }
  return bound;
}
// These operators describe a result, independent of how its inputs were listed.
const comparison =
  /^(?:(?:how (?:far|much) apart (?:are they|are the two)|how (?:do|did) (?:the two|they) (?:compare|stack up|differ)|(?:what(?:'s| is) |show me |give me |calculate )?(?:the |their )?(?:gap|difference|delta|comparison)(?: (?:between (?:them|the two)|in (?:original |the same )?units))?|compare (?:the two|them)(?: for me)?))$/u;
const distancePercent =
  /^(?:(?:what|which) (?:percentage|percent|fraction|share|proportion) (?:of (?:that|this|the) (?:gap|distance|interval|change|journey|way) )?(?:(?:have we|has (?:the|our) (?:reading|measurement)) (?:already )?(?:closed|covered|completed|crossed)|is (?:already )?(?:covered|complete|closed))|(?:give me|show me|calculate) (?:the )?(?:percentage|fraction|share) (?:of (?:that|this|the) (?:gap|distance|journey) )?(?:closed|covered|completed)(?: so far)?|(?:how far along|where) (?:are we|is (?:the|our) (?:reading|measurement)) (?:as a percent(?:age)?|in percent))$/u;
const days =
  /^(?:(?:how many|count the|give me the|show me the) (?:whole |signed )?(?:calendar )?days(?: (?:apart|between (?:them|the two)|remain|are left|until due))?|(?:what(?:'s| is) |show me |give me )?(?:the )?(?:signed )?(?:gap|difference|distance) (?:in|as) (?:calendar )?days)$/u;
const note =
  /^(?:(?:draft|write|prepare|compose|make) (?:a |an |the )?(?:(?:short|local|brief|evidence|handoff|review|unsent) )*(?:note|brief|summary|handoff)|(?:summari[sz]e|write up) (?:it|the evidence) for (?:them|review))$/u;

export function projectedOutput(
  text: string,
  metric: string,
): readonly string[] {
  // Support both "Given A and B, what is X?" and "Show X using A and B."
  const s = text.replace(intros, "");
  const before =
    /^(?:using|given|with|take|use|i have|we have|we have both|look at|consider|here are) (.{1,96}?)[,:;.!?] (.+)$/u.exec(
      s,
    );
  const after = before
    ? null
    : /^(.+?) (?:using|given|based on|between|from) (.+)$/u.exec(s);
  if (!before && !after) return [];
  const argumentsText = before ? before[1] : after![2];
  const bound = groundedFields(argumentsText, metric);
  if (!bound) return [];
  const directional = /\bto\b/u.test(argumentsText);
  const order = [...bound];
  const result = (before ? before[2] : after![1]).replace(intros, "");
  if (
    bound.has("today") &&
    bound.has("due") &&
    bound.size === 2 &&
    (!directional || order[0] === "today") &&
    days.test(result)
  )
    return [deadlinePin];
  if (
    bound.has("owner") &&
    bound.has("evidence") &&
    bound.size === 2 &&
    note.test(result)
  )
    return [handoffPin];
  if (
    bound.has("baseline") &&
    bound.has("target") &&
    (bound.size === 2 || bound.has("reading")) &&
    (!directional || order.indexOf("baseline") < order.indexOf("target")) &&
    distancePercent.test(result)
  )
    return [progressPin];
  if (
    bound.size === 2 &&
    bound.has("reading") &&
    (bound.has("target") || bound.has("baseline")) &&
    !directional &&
    comparison.test(result)
  )
    return [pin];
  return [];
}

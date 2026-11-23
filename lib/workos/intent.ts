// Each production consumes an entire request. Slots contain only terms for the current
// task's documented local operations. Unsupported modifiers and extra clauses abstain.
import { deadlinePin, handoffPin, pin, progressPin } from "./config.ts";
import { requestContext } from "./request-context.ts";
import { taskPhrasing } from "./phrasing.ts";

const optional = (s: string) => `(?:${s})?`;
const choice = (...s: string[]) => `(?:${s.join("|")})`;
const full = (...s: string[]) => new RegExp(`^${choice(...s)}$`, "u");

const article = optional("(?:the|our|my|this) ");
const reading =
  article +
  optional("(?:latest|last|newest|current|recorded|observed|most recent) ") +
  choice(
    "reading",
    "measurement",
    "observed value",
    "recorded value",
    "value",
    "observation",
    "metric",
  );
const target =
  article +
  optional("(?:quarterly|approved|current|stated) ") +
  choice("target", "goal");
const baseline =
  article + choice("baseline", "starting value", "starting point");
const benchmark = choice(target, baseline);
const compare = choice("compare", "check", "measure", "assess", "evaluate");
const show = choice(
  "show me",
  "show",
  "give me",
  "tell me",
  "calculate",
  "work out",
);
const relative = choice(
  "against",
  "with",
  "to",
  "relative to",
  "compared to",
  "versus",
);
const progress = choice(
  "progress",
  "our progress",
  "goal progress",
  "target progress",
);
const observation = full(
  `${compare} ${reading} ${relative} ${benchmark}`,
  `how does ${reading} compare (?:with|to|against) ${benchmark}`,
  `where does ${reading} (?:stand|sit) (?:against|relative to|compared to) ${benchmark}`,
  `${show} (?:the )?(?:difference|change) (?:between ${baseline} and ${reading}|between ${reading} and ${baseline}|from ${baseline} to ${reading})`,
  `(?:compare|measure) (?:the )?(?:change|difference) (?:between ${reading} and ${baseline}|from ${baseline} to ${reading})`,
  `(?:compare|review) ${baseline} (?:and|with) ${reading}`,
  `(?:check|review|show me|calculate) ${progress} (?:toward|towards|against) ${target}(?: (?:using|based on) ${reading})?`,
  `how (?:far|much) have we (?:moved|come|improved) (?:from|since) ${baseline}`,
  `(?:based on|using) ${reading},? how (?:far|much) have we (?:moved|come|improved) (?:from|since) ${baseline}`,
  `how (?:close|far) (?:are we|is ${reading}) (?:to|from) ${target}`,
);

const percent = full(
  `(?:calculate|show|show me|give me|tell me) ${progress}(?: (?:toward|towards) ${target})? (?:as a percentage|in percent)(?: (?:using|based on) ${reading})?`,
  `(?:what (?:percentage|fraction)|how much) of (?:the )?(?:distance|way) from ${baseline} to ${target} (?:have we (?:covered|closed)|is complete)`,
  `(?:show|calculate|give me) the percentage of the (?:distance|gap) (?:from ${baseline} to ${target}|between ${baseline} and ${target}) (?:already )?(?:covered|closed)`,
);

const task = choice(
  "(?:this|the|our|my) (?:(?:assigned|current|selected) )?(?:task|action)",
  "it",
);
const deadline = choice(
  article + "(?:(?:assigned|current|task|action) )?(?:deadline|due date)",
  `${task}'s (?:deadline|due date)`,
  `(?:the )?(?:deadline|due date) (?:for|of|on) ${task}`,
);
const due = choice(`${task} (?:is|falls) due`, deadline);
const days = "(?:calendar )?days";
const calendar = full(
  `(?:how long|how much time|how many ${days}) (?:do we have |(?:are |is )?(?:left |remaining )?)?(?:until|till|before|to) ${due}`,
  `(?:when|on what date) (?:is ${task} due|does ${task} (?:fall due|come due))`,
  `(?:when|what date) (?:is|is the date of) ${deadline}`,
  `what(?: is|'s) ${deadline}`,
  `(?:check|show me|give me|tell me|find) (?:when ${task} is due|${deadline})`,
  `(?:count|calculate|show|show me|give me|tell me) (?:the )?(?:number of )?${days} (?:remaining |left )?(?:until|before|to) ${due}`,
  `(?:count|calculate|show me|give me|i need) (?:the )?(?:number of )?${days} between today and ${deadline}`,
  `is ${deadline} (?:still ahead(?: of us)?|in the past|already past),? and (?:if so,? )?by how many days`,
  `(?:how much time|how many ${days}) (?:is|are) (?:left|remaining) (?:until|before) ${due}`,
  `(?:when|by when) (?:do we|do i) (?:have|need) to (?:finish|complete) ${task}`,
  `(?:show me|tell me|give me) (?:the )?(?:time|calendar days|days) (?:left|remaining) (?:before|until) ${due}`,
);

const owner = choice(
  "(?:the |our |its |this task's )?(?:(?:assigned|accountable|task|next) )?(?:owner|reviewer)",
  "the person (?:reviewing|responsible for) (?:this|the) (?:task|action)",
);
const evidence = choice(
  article +
    optional("(?:recorded|current|latest|local|saved) ") +
    choice(
      "evidence",
      "evidence reference",
      "evidence id",
      "observation",
      "measurement",
    ),
  "(?:this|the) task's (?:evidence|evidence reference)",
);
const write = choice(
  "draft",
  "write",
  "create",
  "prepare",
  "compose",
  "make",
  "put together",
  "i need",
  "i would like",
  "i'd like",
);
const note =
  "(?:a |the |an )?(?:(?:short|brief|local|draft|evidence) ){0,2}(?:hand-?off|handover)(?: (?:note|summary|brief|draft))?";
const localNote =
  "(?:a |the )?(?:(?:short|local|review|draft|brief) ){0,2}(?:note|summary|brief)";
const forOwner = ` for ${owner}`;
const handoff = full(
  `${write} ${note}(?: (?:of|using|with) ${evidence})?(?:${forOwner})?`,
  `${write} ${note}${forOwner} (?:with|using) ${evidence}`,
  `${write} ${localNote} (?:of|with|using) ${evidence}(?:${forOwner})?`,
  `${write} ${localNote}${forOwner} (?:with|using) ${evidence}`,
  `(?:summarize|summarise|write up) ${evidence}(?: in ${localNote})?${forOwner}(?: to review)?`,
  `(?:turn|put) ${evidence} (?:into|in) ${note}(?:${forOwner})?`,
);

export function normalizeRequest(input: unknown): string {
  if (
    typeof input !== "string" ||
    input.length > 160 ||
    /[\u0000-\u001f\u007f]/u.test(input)
  )
    return "";
  return requestContext(
    input
      .trim()
      .toLowerCase()
      .replace(/[’‘]/gu, "'")
      .replace(/\s+/gu, " ")
      .replace(/^please /u, "")
      .replace(/^(?:can|could|would|will) you (?:please )?/u, "")
      .replace(/^(?:just |quickly |also )/u, "")
      .replace(/[.!?]$/u, "")
      .replace(/(?: for me| please)$/u, "")
      .trim(),
  );
}

export function naturalRevisions(
  phrase: string,
  metric: string,
): readonly string[] {
  if (percent.test(phrase)) return [progressPin];
  if (observation.test(phrase)) return [pin, progressPin];
  if (calendar.test(phrase)) return [deadlinePin];
  if (handoff.test(phrase)) return [handoffPin];
  return taskPhrasing(phrase, metric);
}

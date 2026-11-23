// Interpret references to the active task with a closed vocabulary. Markers are uppercase;
// incoming text is lowercase. Rules consume the entire clause, including all modifiers.
import { deadlinePin, handoffPin, pin, progressPin } from "./config.ts";
import { frameRevisions } from "./intent-frames.ts";
type Term = readonly [RegExp, string];
function mark(phrase: string, terms: readonly Term[]) {
  for (const [term, label] of terms) phrase = phrase.replace(term, label);
  return phrase;
}
const matches = (text: string, forms: readonly RegExp[]) =>
  forms.some((form) => form.test(text));

// Bind only the exact, current metric. Restrict names to metric nouns and ordinary
// qualifiers so a configurable label can never absorb instructions or a second clause.
// Named indices outside this vocabulary remain available via the generic current-reading request.
export const metricName =
  /^(?:(?:review|customer|intake|order|support|service|first|average|median|response|lead|cycle|defect|error|conversion|signup|completion|return|wait|processing|resolution|quality|satisfaction|onboarding|sales|retention|churn) ){0,3}(?:turnaround|time|rate|duration|count|score|quality|revenue|retention|churn|conversions|errors)$/u;
function groundMetric(text: string, metric: string) {
  const name = metric.trim().toLowerCase();
  if (!metricName.test(name) || !text.includes(name)) return text;
  // The validation above restricts the interpolation to ASCII words and spaces.
  const bound = new RegExp("\\b" + name + "\\b", "gu");
  return text.replace(bound, "METRIC");
}
const det = /\b(?:the|our|my|its|a|an) /gu;
const goalTerms: Term[] = [
  [
    /\b(?:where we (?:are now|stand now)|what we (?:have |just )?(?:recorded|measured)|(?:value|figure|number|measurement) (?:we (?:just )?(?:recorded|measured)|on (?:file|record)))\b/gu,
    "READ",
  ],
  [
    /\b(?:where we (?:began|started)|what we started (?:with|at|from)|baseline|starting (?:value|point|line|level|number|figure)|initial (?:value|level|reading))\b/gu,
    "BASE",
  ],
  [
    /\b(?:what we(?:'re| are) aiming for|what we (?:aimed|planned) for|what we (?:were|are) aiming for|where we want to (?:be|get to)|(?:(?:approved|agreed|quarterly|stated|planned|desired|intended|goal) ){0,2}(?:target|goal|objective|benchmark))\b/gu,
    "GOAL",
  ],
  [
    /\b(?:(?:most recent|latest|last|newest|actual|current|saved|recorded|measured|observed) ){0,2}(?:reading|readout|measurement|observation|value|number|figure|result|actuals?|METRIC)\b/gu,
    "READ",
  ],
  [
    /\b(?:stack(?:s)? up|line(?:s)? up|match(?:es)? up|measure(?:s)? up|compar(?:e|es)|contrast|benchmark|check|assess|evaluate|weigh|set alongside)\b/gu,
    "COMPARE",
  ],
  [
    /\b(?:relative to|compared (?:with|to)|in relation to|in comparison (?:with|to)|up against|against|alongside|versus|vs\.?|with|to)\b/gu,
    "REL",
  ],
  [/\b(?:gap|delta|difference|change|improvement)\b/gu, "GAP"],
  [/\b(?:percent(?:age)?|fraction|proportion)\b/gu, "PERCENT"],
  [/\b(?:distance|path|way|journey)\b/gu, "DISTANCE"],
  [/\b(?:closed|covered|traveled|travelled|completed|made up)\b/gu, "COVERED"],
];
const goalForms = [
  /^(?:COMPARE|display|review) READ (?:REL|and) (?:GOAL|BASE)(?: for READ)?$/u,
  /^(?:COMPARE|review|contrast) (?:GOAL|BASE) (?:REL|and) READ(?: for READ)?$/u,
  /^(?:show me |tell me )?(?:how (?:does |do )?|where (?:does |do )?)READ (?:COMPARE|stand|stands|sit|sits|look|looks)(?: REL| next REL) (?:GOAL|BASE)$/u,
  /^(?:show me |tell me )?(?:how (?:are|am) (?:we|i) (?:doing|tracking)|where (?:are|am) (?:we|i)|where (?:do we|do i) stand|what(?:'s| is) (?:our )?progress) (?:on|toward|towards|REL) GOAL(?: (?:so far|today|right now))?$/u,
  /^(?:has|is) READ (?:improved|changed|different|higher|lower) (?:since|from|than) BASE$/u,
  /^(?:show me |tell me )?how (?:far|much) (?:have we (?:come|moved)|has READ (?:moved|changed)) (?:since|from) BASE(?: on (?:READ|metric))?$/u,
  /^(?:calculate|show|show me|tell me|give me|work out|quantify|measure|what(?:'s| is)) GAP (?:between (?:BASE|GOAL) and READ|between READ and (?:BASE|GOAL)|from BASE REL READ)$/u,
  /^(?:put|place|show) READ (?:next REL|REL) (?:GOAL|BASE)(?: so (?:i|we) can (?:review|see) progress)?$/u,
  /^(?:COMPARE|check|review|show me|give me) (?:this task's |this |current )?progress (?:on|towards?|REL) (?:this )?GOAL$/u,
  /^(?:check|do|run|give me) (?:quick )?progress (?:COMPARE|check-in|update) (?:on|for) (?:this )?GOAL$/u,
  /^(?:what(?:'s| is) (?:the )?update on |show me |tell me )?where we (?:are|stand) REL (?:this )?GOAL$/u,
  /^(?:goal |GOAL )?progress (?:check|check-in|update|review)(?: (?:for|on) (?:this )?GOAL)?$/u,
  /^(?:(?:give me|show me|run|do|make) )?(?:progress (?:check|check-in|update)|check-in|status check) (?:for|on) (?:this )?GOAL$/u,
  /^(?:how (?:is|are) (?:this )?GOAL (?:doing|progressing|coming along)|how(?:'s| is) progress on (?:this )?GOAL|where (?:does|do) (?:this )?GOAL (?:stand|sit))(?: (?:today|so far|right now))?$/u,
  /^(?:how is READ (?:doing|tracking)|how does READ look) (?:REL|towards?) GOAL$/u,
  /^(?:what (?:does|do) READ (?:say|tell us|show) about (?:our )?progress (?:on|towards?) GOAL|(?:are we|am i) (?:at|on|above|below) GOAL (?:based on|according to|using) READ)$/u,
  /^(?:how (?:near|close|far) (?:is READ|are we)|how far off (?:is READ|are we))(?: (?:REL|from))? GOAL$/u,
  /^(?:using|based on) READ,? (?:how (?:are we doing|close are we|far are we)|where do we stand) (?:on|from|REL|towards?) GOAL$/u,
];
const percentForms = [
  /^(?:what PERCENT|how much) of (?:BASE[- ](?:REL|to)[- ]GOAL (?:GAP|DISTANCE)|(?:GAP|DISTANCE) (?:from BASE REL GOAL|between BASE and GOAL)) (?:have we COVERED|has been COVERED|is COVERED)(?:,? (?:in|as) PERCENT)?$/u,
  /^(?:calculate|show|show me|tell me|give me|work out) PERCENT of (?:BASE[- ](?:REL|to)[- ]GOAL (?:GAP|DISTANCE)|(?:GAP|DISTANCE) from BASE REL GOAL) (?:we have|we've) COVERED$/u,
  /^(?:show|calculate|tell me|give me|express) (?:our )?(?:GOAL )?progress (?:towards? GOAL )?(?:as|in) PERCENT(?: (?:from|using) READ)?$/u,
];
const calendarTerms: Term[] = [
  [
    /\b(?:(?:this|that|the|my|our) )?(?:(?:assigned|current|selected|active|open) )?(?:task|action item|action|work item|assignment|to-do|todo)\b/gu,
    "TASK",
  ],
  [
    /\b(?:due[- ]date|deadline|scheduled due date|date of completion)\b/gu,
    "DUE",
  ],
  [/\b(?:(?:utc )?calendar[- ]days?|days?)\b/gu, "DAYS"],
  [/\b(?:left to go|left|remaining|still available|to go|remain)\b/gu, "LEFT"],
  [/\b(?:as of today|from today|from now|today|now)\b/gu, "NOW"],
  [/\b(?:until|till|before|away from)\b/gu, "UNTIL"],
];
const calendarForms = [
  /^(?:when|by when|what date|on what date|what DAYS) (?:is|does) (?:TASK|it|this) (?:fall due|come due|need to be (?:done|finished|completed)|due)(?: by)?$/u,
  /^(?:when (?:is|does) (?:TASK|it|this) (?:have to be (?:done|completed)|need to be ready)|when (?:is|does) DUE (?:fall|land))$/u,
  /^(?:what(?:'s| is)|show me|give me|look up|remind me of|check|find|tell me) (?:TASK(?:'s)? DUE|DUE(?: (?:for|of|on) TASK)?)(?: in utc)?$/u,
  /^(?:how long|how much time|how many DAYS) (?:is there |have we got |have i got |do (?:we|i) (?:still )?have |are there |are |is )?(?:LEFT )?UNTIL (?:DUE|TASK(?:'s)? DUE|(?:TASK|this|it) (?:is|comes|falls) due|(?:it|TASK)'s due|DUE (?:of|for|on) TASK)(?: NOW)?$/u,
  /^(?:how long|how much time|how many DAYS) (?:is |are |are there |do (?:we|i) have |have (?:we|i) got )?LEFT (?:on|for) TASK$/u,
  /^(?:how much time|how many DAYS|how long) do (?:we|i) have (?:to finish|to complete) TASK$/u,
  /^(?:how much (?:time|runway)|how many DAYS) does TASK have UNTIL (?:its )?DUE$/u,
  /^(?:check|count|show me|tell me|calculate|give me) (?:DAYS LEFT|LEFT DAYS)(?: (?:on|for) TASK)?$/u,
  /^(?:how many DAYS|how long) (?:do (?:we|i) have|have (?:we|i) got) LEFT(?: (?:on|for) TASK)?$/u,
  /^(?:how (?:far (?:away|out)|many DAYS away)|how far) (?:is|are) (?:DUE|TASK(?:'s)? DUE|DUE for TASK)(?: NOW)?$/u,
  /^(?:how many DAYS (?:overdue|late)|how (?:overdue|late)) (?:is|are) (?:TASK|it|this)$/u,
  /^(?:is|has) (?:TASK|it|this) (?:overdue|past (?:its )?DUE|missed (?:its )?DUE)$/u,
  /^(?:when(?:'s| is)|what date is) (?:TASK(?:'s)? DUE|DUE (?:for|on) TASK)$/u,
  /^(?:how many DAYS (?:do i|do we) have|what(?:'s| is) time LEFT) (?:UNTIL|before) (?:DUE|TASK is due|it(?:'s| is) due)$/u,
  /^(?:check|show me|tell me) (?:if|whether) (?:TASK|it|this) (?:is (?:past DUE|overdue|late)|has missed DUE)$/u,
  /^(?:what(?:'s| is)|how many DAYS (?:are )?) LEFT on (?:the )?clock for TASK$/u,
  /^(?:tell me|show me|calculate|count|give me|work out|check) (?:how many |number of |count of )?DAYS (?:are |are there )?(?:LEFT )?(?:UNTIL|to|between NOW and) (?:TASK(?:'s)? DUE|DUE|DUE (?:of|for) TASK|TASK is due)$/u,
  /^(?:(?:show|show me|give me|check|calculate) )?(?:DAYS )?countdown (?:for|to|UNTIL) (?:TASK|DUE|TASK(?:'s)? DUE)$/u,
  /^(?:(?:show|show me|give me) )?(?:DAYS|time) LEFT (?:on|for|UNTIL) (?:TASK|DUE|TASK(?:'s)? DUE)$/u,
];
const handoffTerms: Term[] = [
  [
    /\b(?:the |our |its |this task's )?(?:(?:task|accountable|assigned|responsible|next|incoming) )?(?:owner|reviewer|assignee|teammate|colleague)\b|\b(?:the next person|(?:the person|whoever) (?:is taking over|taking over|picking (?:this|it) up|who (?:owns|reviews) (?:this|the) task))\b/gu,
    "PERSON",
  ],
  [
    /\b(?:(?:this|the) task's |the |this |our |its )?(?:(?:latest|current|recorded|attached|saved|available|supporting|local|observed) ){0,2}(?:evidence(?: (?:id|identifier|reference))?|observation|measurement|proof|findings)\b/gu,
    "PROOF",
  ],
  [
    /\b(?:(?:a|an|the) )?(?:(?:draft|quick|short|brief|concise|local|internal|written|review|evidence) ){0,3}(?:hand[- ]?off|hand[- ]?over)(?: (?:note|brief|summary|memo|draft|write-up))?\b/gu,
    "HANDOFF",
  ],
  [
    /\b(?:(?:a|an|the) )?(?:(?:draft|quick|short|brief|concise|local|internal|written|review|evidence) ){0,3}(?:note|brief|summary|memo|write-up)\b/gu,
    "NOTE",
  ],
  [
    /\b(?:prepare|write up|write|draft|compose|create|assemble|make|put together|draw up|produce|i need|i(?:'d| would) like)\b/gu,
    "WRITE",
  ],
  [
    /\b(?:summari[sz]e|condense|distill|package|capture|recap|collect|set out)\b/gu,
    "SUMMARIZE",
  ],
];
const handoffForms = [
  /^(?:WRITE )?(?:HANDOFF|HANDOFF NOTE)(?: (?:for|with) (?:PERSON|PROOF))?(?: (?:with|including|using|based on) PROOF)?$/u,
  /^WRITE (?:HANDOFF|NOTE) (?:from|using|with|of|summarizing|containing|including|based on) PROOF(?: (?:for|for review by) PERSON)?$/u,
  /^WRITE HANDOFF for (?:PERSON|(?:this|current|assigned) task)(?: (?:with|using|from|summarizing|including|based on) PROOF)?$/u,
  /^WRITE NOTE for PERSON (?:with|using|from|summarizing|including|based on) PROOF$/u,
  /^WRITE HANDOFF (?:that )?(?:i|we) can (?:give|hand) (?:to )?PERSON$/u,
  /^(?:give me|WRITE) (?:NOTE|HANDOFF) of PROOF so PERSON can (?:pick it up|review it|take over)$/u,
  /^(?:WRITE|SUMMARIZE) PROOF (?:as|in|into|for) (?:HANDOFF|NOTE)(?: for PERSON)?$/u,
  /^(?:SUMMARIZE|write up) PROOF for PERSON(?: (?:to review|to pick up|as (?:HANDOFF|NOTE)))?$/u,
  /^(?:turn|put|pull|gather|organize) PROOF (?:together )?(?:as|in|into|for) (?:HANDOFF|NOTE)(?: for PERSON)?$/u,
  /^(?:WRITE|give me) (?:HANDOFF|NOTE) (?:on|about) PROOF (?:for PERSON|so PERSON can (?:take over|pick it up))$/u,
  /^(?:SUMMARIZE|capture|WRITE) PROOF (?:so|so that) PERSON can (?:take over|review it|pick (?:it|this) up)$/u,
  /^(?:WRITE|give me) HANDOFF (?:on|for|about) (?:this|current|assigned) (?:task|action|work item)$/u,
  /^WRITE NOTE (?:that )?PERSON can use (?:to review|when reviewing|when taking over) (?:this|the|assigned|the assigned) (?:task|action)$/u,
  /^(?:get|make) PROOF ready for (?:HANDOFF|PERSON)(?: to review)?$/u,
];
export function taskPhrasing(
  phrase: string,
  metric: string,
): readonly string[] {
  const root = phrase.replace(
    /^(?:i want to|i would like to|i'd like to|help me|let me|can i get|could i get) /u,
    "",
  );
  const goalText = mark(groundMetric(root, metric), goalTerms).replace(det, "");
  if (matches(goalText, percentForms)) return [progressPin];
  if (matches(goalText, goalForms)) return [pin, progressPin];
  const timeText = mark(root, calendarTerms).replace(det, "");
  if (matches(timeText, calendarForms)) return [deadlinePin];
  const note = root.replace(
    /(?:,? (?:without sending (?:it|anything)|for local review only|keep it local|draft only))$/u,
    "",
  );
  if (note === "handoff" || note === "handover") return [];
  const handoffText = mark(
    note.replace(
      /^write up (?=(?:(?:this|the|recorded|saved|current|supporting|latest) )*(?:evidence|findings)\b)/u,
      "summarize ",
    ),
    handoffTerms,
  )
    .replace(det, "")
    .replace(/\bPROOF and PROOF\b/gu, "PROOF");
  if (matches(handoffText, handoffForms)) return [handoffPin];
  const active = metric.trim().toLowerCase();
  return frameRevisions(root, metricName.test(active) ? active : "");
}

// These expressions bind only descriptions of fields in a WorkOS receipt.
// A clause must still pass the full-request parser after normalization.
const start =
  "(?:(?:our|the|its|my) )?(?:baseline|(?:starting|initial|original|first) (?:reading|measurement|point|mark|line|level|value|figure|number)|where we (?:started|began))";
const finish =
  "(?:(?:our|the|its|my) )?(?:target(?: value)?|goal|(?:desired|intended|planned) (?:value|outcome|improvement)|finish line)";
const zero = "(?:0(?:%| percent)?|zero(?: percent)?)";
const hundred = "(?:100(?:%| percent)?|(?:one |a )?hundred(?: percent)?)";
const binding = "(?:as|is|equals|at|counts as|represents|marks)";
const basis = new RegExp(
  "^(?:(?:with|if|take|treat|count|using) )?" +
    start +
    " " +
    binding +
    " " +
    zero +
    "(?: of (?:the|our) (?:journey|change|distance))?[,]? and " +
    finish +
    " " +
    binding +
    " " +
    hundred +
    "[.,;] (.+)$",
  "u",
);
const resultOnScale =
  /^(?:what percent(?:age)? (?:does|is) (?:our |the )?(?:latest |last |current |recorded )?(?:value|reading|measurement|result)(?: represent| at)?|where (?:is|does) (?:our |the )?(?:latest |last |current |recorded )?(?:value|reading|measurement|result)(?: fall| sit)?(?: on (?:that|the|this) scale)?|(?:score|place|put) (?:our |the )?(?:latest |last |current |recorded )?(?:value|reading|measurement|result) on (?:that|this|the) scale|where (?:are|do) we (?:now|today|stand|sit)(?: on (?:that|the|this) scale)?)$/u;

// A second clause can specify the representation of the first result. Only
// the named operation may absorb its own display qualifier.
export function clarifyOutput(text: string) {
  const scale = basis.exec(text);
  if (scale && resultOnScale.test(scale[1])) return "calculate target progress";
  return text
    .replace(
      /^i need two (?:checks|things)(?: for (?:this|the) task)?[.!:] /u,
      "",
    )
    .replace(/^(?:can|could) i have (?:a|an) /u, "give me a ")
    .replace(
      /^what could i write (?:to|for) (?:the |our )?(?:owner|reviewer) about (?:the |this task's )?evidence\??(?: just give me the text)?$/u,
      "write a draft evidence note for the owner",
    )
    .replace(
      /\b(?:using|taking|treating) (?:our |the )?(?:original|starting|initial) (?:level|value|measurement|reading) and (?:our |the )?(?:goal|target) as (?:the |our )?(?:two )?endpoints\b/gu,
      "from baseline to target",
    )
    .replace(
      /^(?:use|take) (?:the )?(?:movement we wanted|planned improvement) as the denominator[.!] what percent of that movement did we achieve$/u,
      "what percent of the planned improvement have we achieved",
    )
    .replace(
      /^for (?:each|every) hundred units of (?:improvement|change) we (?:set out|planned) to make, how many have we (?:delivered|achieved|covered)$/u,
      "what percent of the planned improvement have we achieved",
    )
    .replace(
      /^turn (?:the )?(?:part|portion) of (.+) (?:that )?we have (?:already )?(closed|covered) into a percent$/u,
      "what percent of $1 have we $2",
    )
    .replace(
      /\b(?:actual|measurement|reading|value)-to-(?:target|goal)\b/gu,
      "actual versus target",
    )
    .replace(
      /\b(?:(?:starting|initial|original) benchmark|benchmark we started from)\b/gu,
      "baseline",
    )
    .replace(
      /\b(?:numerical|numeric|agreed|intended) (?:objective|target)\b|\b(?:target value|desired value|threshold|finish line)\b/gu,
      "target",
    )
    .replace(
      /\b(?:last|latest|most recent|newest|current) (?:recorded |observed )?(?:numerical )?(?:observation|figure|number|reading|actual|measurement|result|value)\b/gu,
      "current reading",
    )
    .replace(
      /\b(?:the |a )?(?:number|value) we (?:just )?(?:measured|recorded|logged)\b/gu,
      "current reading",
    )
    .replace(/\b(?:on record|on file|already on hand)\b/gu, "recorded")
    .replace(/^i (?:just |only )?(?:need|want) (?:to know )?/u, "give me ")
    .replace(/^need (?:to know )?/u, "give me ")
    .replace(
      /^take (.+?) and (?:check|compare|measure) it (?:against|with|to) /u,
      "compare $1 against ",
    )
    .replace(/\b(?:how many more units|how many units|how big)\b/gu, "how far")
    .replace(/\b(?:fall short of|fall below|on the wrong side of)\b/gu, "below")
    .replace(
      /\b(?:end up|wind up|turn out to be) (above|below|over|under)\b/gu,
      "$1",
    )
    .replace(
      /\b(?:would (?:we|i) need to|do (?:we|i) still need to) (?:meet|hit|reach)\b/gu,
      "from",
    )
    .replace(/\b(?:this time|as things stand)\b/gu, "now")
    .replace(
      /\b(?:part|amount|portion|fraction) of (?:our |the )?(?:planned|intended|needed) (?:change|improvement|reduction)\b/gu,
      "fraction of the planned improvement",
    )
    .replace(
      /\b(?:movement we wanted|change we set out to make|intended improvement|intended change|improvement we set out to make|change needed to reach (?:the |our )?(?:target|goal))\b/gu,
      "planned improvement",
    )
    .replace(
      /\b(?:out of (?:100|one hundred)|expressed as a percent|expressed out of (?:100|one hundred)|percentage-wise)\b/gu,
      "in percent",
    )
    .replace(
      /\b(?:original gap to (?:the |our )?(?:goal|target)|distance we planned to cover)\b/gu,
      "baseline to target gap",
    )
    .replace(
      /\b(?:in the bag|actually happened|been achieved|been realized|already done|is complete|is done)\b/gu,
      "covered",
    )
    .replace(
      /\b(?:we have|we've|have we) (?:already |actually )?(?:delivered|achieved|made|traveled|travelled|closed)\b/gu,
      "we have covered",
    )
    .replace(
      /\b(?:finish-by date|promised date|scheduled finish|date we promised|date we agreed on|date it is due)\b/gu,
      "deadline",
    )
    .replace(
      /\b(?:is|was) supposed to be (?:done|finished|complete)\b/gu,
      "is due",
    )
    .replace(
      /\b(?:the |this )?(?:task|item|ticket) i have open\b/gu,
      "this task",
    )
    .replace(
      /\b(?:midnights in utc|utc midnights|whole calendar days|full calendar days)\b/gu,
      "calendar days",
    )
    .replace(
      /\b(?:signed (?:count|number) of days|days on (?:the|our) clock)\b/gu,
      "calendar days",
    )
    .replace(
      /\b(?:on|for) (?:the )?(?:selected|assigned|active|open) (?:task|assignment|item)\b/gu,
      "on this task",
    )
    .replace(
      /\b(?:recorded|logged|saved|documented) (?:proof|results|observations|details|findings)\b/gu,
      "evidence",
    )
    .replace(
      /\b(?:what the task record shows|what we have recorded|what we can substantiate|supporting material|proof recorded)\b/gu,
      "evidence",
    )
    .replace(
      /\b(?:draft|brief|short|quick|local|unsent) (owner|reviewer) (?:note|summary|update|brief)\b/gu,
      "draft note for the $1",
    )
    .replace(
      /\b(?:brief|short) (?:account|write-up)|\b(?:reviewer )?talking points\b/gu,
      "note",
    )
    .replace(
      /\b(?:we've|we have|we) (?:recorded|logged|already have|collected|saved|gathered)\b/gu,
      "recorded",
    )
    .replace(
      /\b(?:for me to review here|for me to review locally|to read here|that i can (?:copy|use)(?: later)?|i can copy later)\b/gu,
      "for local review",
    )
    .replace(
      /\b(?:whoever|the person) (?:is )?picking (?:it|this) up\b/gu,
      "the reviewer",
    )
    .replace(
      /\b(?:that i can|i can) (?:give|hand over|hand) (?:to )?(?:the |our )?(owner|reviewer)\b/gu,
      "for the $1",
    )
    .replace(
      /\b(?:draft|summary|note) (?:bringing together|summari[sz]ing|that sums up)\b/gu,
      "note with",
    )
    .replace(/\b(?:unsent|unpublished)\b/gu, "local")
    .replace(
      /\bbringing together|\b(?:that )?brings (?:the )?recorded evidence together\b/gu,
      "with evidence",
    )
    .replace(
      /\b(?:using only|summarizing|summing up|summarising)\b/gu,
      "using",
    );
}

// Elliptical follow-ups inherit a subject only from a complete recognized clause.
// Each pattern is tied to one receipt. An unrelated second request must still pass
// the normal compound parser and independent permission checks.
export function resultQualifier(
  text: string,
): "days" | "comparison" | "note" | null {
  if (
    /^(?:(?:please )?(?:tell me|show me|give me|return|count) )?(?:the )?(?:number of )?(?:calendar )?days(?: on the clock| remaining| left| late)?$/u.test(
      text,
    ) ||
    /^(?:by )?how many (?:calendar )?days(?: late| overdue| left)?$/u.test(text)
  )
    return "days";
  if (
    /^(?:(?:please )?(?:tell me|show me|give me) (?:the )?(?:difference|gap)(?: in units)?|where do we stand|how far apart (?:are they|they are))$/u.test(
      text,
    )
  )
    return "comparison";
  if (
    /^(?:(?:just )?(?:give me the text|a draft)|i(?:'ll| will) take it from there|for (?:my|local) review only|i can copy (?:it|this) later)$/u.test(
      text,
    )
  )
    return "note";
  return null;
}

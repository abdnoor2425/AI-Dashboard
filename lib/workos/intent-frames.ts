// A frame describes the arguments of one local operation. All content words must be
// accounted for. Unknown words, unsupported qualifiers and extra actions fail closed.
import { deadlinePin, handoffPin, pin, progressPin } from "./config.ts";

type Slot = readonly [string, RegExp];
const grammatical = new Set(
  "a an the and or to of from with on for at as by in into between against relative than versus vs out over under about around using based per before until since through so that this these it its my our me us we i one there here is was has had have are were be been being do does did can could would how what when where whether which any much many very still already just now then today so far exactly please am got yet actually".split(
    " ",
  ),
);
const taskScope: Slot = [
  "task",
  /\b(?:(?:this|my|our|the) )?(?:(?:assigned|selected|current|active|pilot) )?(?:task|assignment|ticket|work item|action item|item|piece of work|to-do|todo|action|pilot)(?:'s)?\b/gu,
];
const generic: Slot[] = [
  [
    "ask",
    /\b(?:tell me|show me|give me|let me know|figure out|work out|find out|i(?:'d| would) like(?: to know)?|i (?:want|need)(?: to know)?|i wonder|can we|could we|we could|what(?:'s| is)|where(?:'s| is)|how(?:'s| is)|check|look at|look up|see|calculate|count|find|read|show|tell|give|report|display|determine)\b/gu,
  ],
  taskScope,
];
const goal: Slot[] = [
  [
    "base",
    /\b(?:baseline|starting (?:point|level|mark|line|figure|value|number|reading|position)|initial (?:value|reading|position)|first measurement|original reading|old level|original (?:measurement|number|figure)|starting mark|where we were|start to finish|original (?:level|value)|where we (?:began|started)|what we started (?:from|with|at))\b/gu,
  ],
  [
    "target",
    /\b(?:(?:target|goal|benchmark) (?:we (?:set|agreed on|committed to)|for this period)|goalposts?|finish[ -]line|target|goal|objective|benchmark|expected (?:value|result|number)|planned destination|desired (?:level|result|value)|destination|the mark|intended (?:one|result|end value)|number we (?:were |are )?aiming for|number we(?:'re| are) (?:trying|aiming) to (?:hit|reach)|number we promised|what we (?:aimed|were aiming|hoped) for|planned (?:improvement|reduction)|improvement we set out to make|where we (?:want|need) to (?:end up|get|be)|what we(?:'re| are) aiming for)\b/gu,
  ],
  [
    "reading",
    /\b(?:result we (?:recorded|logged)|(?:number|value|figure) we (?:recorded|measured)|what we (?:recorded|measured)|where we (?:are|stand)(?: now)?|actuals?|observed numbers?|value|observations?|measurements?|readings?|results?|measured value|recorded value|number we have now|what we actually (?:achieved|got)|actual performance|realized value|(?:current|latest|last recorded|recorded|measured|actual|today's) (?:value|number|figure)|what we've (?:got|measured)|metric|achievement|achieved value|number on (?:file|record))\b/gu,
  ],
  [
    "scope",
    /\b(?:recorded|observed|saved|latest|last|most recent|current|newest|logged|measured|recent|stated|agreed|quarterly|approved|planned|intended|today's)\b/gu,
  ],
  [
    "presentation",
    /\b(?:express|as a share of|expressed|written|with a percent sign|judging by|according to|use|using|so far|in (?:the )?(?:original|same|native|absolute) units|in units|in percentage terms|on that scale)\b/gu,
  ],
  [
    "pct",
    /\b(?:percent(?:age)?|per cent|fraction|portion|proportion|share|percentage-wise)\b|%/gu,
  ],
  [
    "distance",
    /\b(?:distance|way|journey|gap|path|range|stretch|move|planned change)\b/gu,
  ],
  [
    "advance",
    /\b(?:progress|covered|closed|trave(?:l|ll)ed|achieved|reached|completed|represents?|close|made it|made|advanced|accomplished|travel|achieve|improvement|complete|done|progressed|along|gone|come so far|gotten|been made|making progress|already behind us)\b/gu,
  ],
  [
    "compare",
    /\b(?:compar(?:e|ed|ison)|contrast|evaluate|assess|stack(?:s)? up|match(?:es)? up|line(?:s)? up|measure(?:s)? up|apart|difference|shortfall|delta|change|behind|ahead|above|below|short of|shy of|underneath|meet|met|meets|beat|clear(?:ed)?|hit(?:ting)?|meet(?:ing)?|reach(?:ing)?|achieve|right side|better|worse|higher|lower|greater|less|exceed(?:s|ed)?|fall short|fall(?:s)?|stand(?:s)?|on par|compare(?:s)?|on pace|on course|on track|tracking|track|doing|stand|look(?:s)?|lands?|come|moved|how far off|far|near|away|left to go|next to|against|versus|side by side)\b/gu,
  ],
  ...generic,
];
const calendar: Slot[] = [
  [
    "due",
    /\b(?:due[ -]date|due|deadline|date on (?:this|my|the) (?:task|item|ticket)|cut[ -]?off|last day to finish|date i owe it on|finish date)\b/gu,
  ],
  [
    "days",
    /\b(?:(?:whole |utc )?(?:calendar[ -])?days?|day count|number of sleeps)\b/gu,
  ],
  [
    "status",
    /\b(?:overdue|past due|late|early|behind|ahead|elapsed|expired|missed|past|pass(?:ed)?|gone|come and gone|time left|time remaining|still have|runway|left|remain(?:s|ing)?|away|far out|how long|how much time|countdown|time available|difference|separate|either side|on (?:the|that) day|behind schedule|ahead of schedule|out from|count down|close|how far|coming up|time to|time till|falls?)\b/gu,
  ],
  [
    "context",
    /\b(?:utc|calendar|date|through to|including today|as zero|with today as zero|recorded|scheduled|assigned|upcoming|outstanding|today's|till|hits?|from now|as things stand|today itself|right now|as of|have got|got|more|to go|work assigned to me|assignee|number|relative|say|before|after|measured in|come|comes|fall|falls|land|lands|later|later than|work is due|ahead of us|stand)\b/gu,
  ],
  ...generic,
];
const note: Slot[] = [
  [
    "write",
    /\b(?:write up|write(?!-)|word|jot down|jot|draft|prepare|put together|put|compose|draw up|turn|make|create|assemble|pull together|pull|collect|compile|gather|organize|capture|leave me|produce|summari[sz]e|condense|distill|recap|bundle)\b/gu,
  ],
  ["handoff", /\b(?:hand[ -]?offs?|hand[ -]?overs?)\b/gu],
  [
    "note",
    /\b(?:write[ -]up|notes?|memo|brief|summary|text|outline|blurb|few lines|briefing|draft text)\b/gu,
  ],
  [
    "evidence",
    /\b(?:task evidence|what we can show|what (?:is|was) recorded|supporting details|evidence(?: (?:id|reference|identifier))?|proof|supporting (?:material|record|information|details|documents?)|what(?:'s| is) documented|the record|source reference|supporting records|what (?:supports|backs up) (?:this|the) result|findings|observations?|measurements?|recorded result)\b/gu,
  ],
  [
    "person",
    /\b(?:person (?:signing it off|reviewing|taking over|taking this on|picking it up|who (?:owns|reviews))|whoever (?:reviews (?:it|this)(?: next)?|reviews|takes over)|next person|person (?:responsible for|completing) (?:the )?review|teammate responsible for review|(?:next |task |assigned |accountable )?(?:owner|reviewer|assignee|teammate)(?: to read(?: here| later)?)?)\b/gu,
  ],
  [
    "scope",
    /\b(?:separate|as well|short|brief|local|internal|concise|ready for review|in writing|in words|into words|grounded in|quick|review|attached|recorded|saved|current|supporting|existing|available|latest|addressed|grounded in|i can (?:copy|use|hand to|give to|give)|that sums up|for whoever reviews|just a draft|we (?:have gathered|actually have|have)|can read later|to review later|to verify the work|local review|review locally|wrap-up|for later|on this machine|we (?:already )?recorded|which we (?:recorded|collected)|based on|include|including|containing|with|for local review only)\b/gu,
  ],
  ...generic,
];

// Replace matched spans with markers outside the user's input alphabet. A marker
// cannot become a match for a later vocabulary rule or be supplied by the caller.
function slotsFor(
  phrase: string,
  vocabulary: readonly Slot[],
  boundMetric = "",
) {
  if (!/^[a-z ,'%-]+$/u.test(phrase)) return null;
  let remaining = phrase;
  const slots = new Set<string>();
  const consume = (name: string) => {
    slots.add(name);
    return " # ";
  };
  if (boundMetric && /^[a-z]+(?: [a-z]+){0,3}$/u.test(boundMetric)) {
    const metric = new RegExp("\\b" + boundMetric + "\\b", "gu");
    remaining = remaining.replace(metric, () => consume("reading"));
    // A distinctive metric head can be used on its own in this task context.
    if (boundMetric.endsWith(" turnaround")) {
      remaining = remaining.replace(/\bturnaround\b/gu, () =>
        consume("reading"),
      );
    }
  }
  for (const [slot, pattern] of vocabulary) {
    remaining = remaining.replace(pattern, () => consume(slot));
  }
  const words = remaining.replace(/[,#]/gu, " ").trim().split(/\s+/u);
  return words.every((word) => !word || grammatical.has(word)) ? slots : null;
}

export function frameRevisions(
  phrase: string,
  boundMetric: string,
): readonly string[] {
  const root = phrase
    .replace(/^the (?=(?:percent(?:age)?|fraction|share|proportion) of )/u, "")
    .replace(
      /\b(?:counting|considering|measuring) only (?:the )?(?:distance|stretch|journey) from /gu,
      "using the distance from ",
    )
    .replace(
      /\b(?:given|using|based on) (?:the )?baseline and (?:the )?(?:target|goal)\b/gu,
      "from baseline to target",
    )
    .replace(/\b(?:is|lies) behind us\b/gu, "is covered")
    .replace(
      /\b(?:sit|stand|look)(?:s)? (?:like )?(?:alongside|beside|against)\b/gu,
      "compare against",
    )
    .replace(
      /\b(?:passed|surpassed|climbed past|fallen below|fallen short of)\b/gu,
      "above or below",
    )
    .replace(
      /\b(?:evidence|proof|findings) (?:we've|we have) (?:collected|gathered|recorded|saved)\b/gu,
      "recorded evidence",
    )
    .replace(
      /\b(?:data|results) (?:already )?recorded for (?:this|the) task\b/gu,
      "recorded evidence",
    )
    .replace(
      /\b(?:how far|how much) (?:we've|we have) moved\b/gu,
      "how much progress we have made",
    )
    .replace(
      /\b(?:just|only) (?:the )?(?:plain|raw|absolute) (?:difference|gap)\b/gu,
      "difference in units",
    )
    .replace(
      /\b(?:elapsed|covered|completed) proportion\b/gu,
      "fraction covered",
    )
    .replace(
      /\b(?:starting|initial) (?:state|amount|position)\b/gu,
      "starting point",
    )
    .replace(
      /\b(?:planned|desired|intended) (?:end point|endpoint|finish)\b/gu,
      "target",
    )
    .replace(/\b(?:finish|end) line\b/gu, "target")
    .replace(
      /^how much (?:of the way|closer) (?:are we|have we come) (.+) in percent$/u,
      "what percentage of the way $1 have we covered",
    )
    .replace(/\b(?:(?:utc|calendar) )?day[- ]difference\b/gu, "day count")
    .replace(
      /\b(?:overdue by|past due by) how many days\b/gu,
      "how many days overdue",
    )
    .replace(
      /^(?:how many|what number of) days (?:until|before) (?:i|we) (?:have to|must) (?:wrap up|finish|complete) (?:this|the) (?:assignment|task|work item)$/u,
      "days until the due date",
    )
    .replace(
      /\b(?:what's|what is) (?:the )?proof behind (?:this|the) (?:result|task)\b/gu,
      "the supporting evidence",
    )
    .replace(
      /\b(?:documented findings|backing material|supporting observations|evidence on file)\b/gu,
      "recorded evidence",
    )
    .replace(
      /\b(?:turning|turn) (.+) into (?:a |an )?briefing\b/u,
      "put $1 into a note",
    )
    .replace(/\bbaseline[- ]to[- ](?:goal|target)\b/gu, "baseline to target")
    .replace(
      /\b(?:percentage-wise|in percentage terms|as a percentage|as a percent)\b/gu,
      "in percent",
    )
    .replace(
      /\b(?:i have|i've|we have|we've) (?:already |actually )?(made|closed|covered|achieved|traveled|travelled)\b/gu,
      "we have $1",
    )
    .replace(
      /\b(?:in|within) (?:the )?(?:original|native|same) units\b/gu,
      "in units",
    )
    .replace(
      /(?:[.!] )?(?:just a draft|a local draft only)$/u,
      " as a local draft",
    )
    .replace(/^using (?:today's |the current )?utc date, /u, "")
    .replace(
      /\bthe percent(?:age)? (?:of|for) (?:our |the )?planned improvement\b/gu,
      "the percent of the planned improvement",
    )
    .replace(
      /^put (.+?) (?:next to|alongside|beside) (.+)$/u,
      "compare $1 against $2",
    )
    .replace(
      /^for (?:the |my )?(?:reviewer|owner)'s (?:next )?(?:review|check-in), /u,
      "",
    )
    .replace(/^i(?:'d| would) also like /u, "i would like ")
    .replace(
      /\bhow many (?:more )?sleeps until (.+?)\?? count weekends too$/u,
      "how many calendar days until $1",
    )
    .replace(
      /\b(?:please )?(?:give (?:me )?(?:a|the) (?:result as a )?percentage|give (?:me )?the answer as a percentage)$/u,
      "in percent",
    )
    .replace(/[.?] (?=in percent$)/u, " ")
    .replace(
      /^(?:take|use|read) ((?:this |the |my )?(?:(?:task|assignment|item|ticket)'s |recorded )?due date)(?: in utc)? and (?:tell me|count) (?:the number of )?days (?:left|from today)(?:\. what's the difference)?$/u,
      "count days from today to $1",
    )
    .replace(/\bbaseline-to-target\b/gu, "baseline to target")
    .replace(
      /^(?:as (?:a percentage|a fraction)|in (?:percent|percentage terms)),? (.+)$/u,
      "$1 in percent",
    )
    .replace(/^before i (?:wrap up|finish), /u, "")
    .replace(
      /^((?:where|what|how) (?:do we stand|is (?:our|the) (?:progress|reading))) as of (?:today|now)/u,
      "$1",
    )
    .replace(
      /^take (the (?:measurement|result|reading) we (?:recorded|logged)) and (?:see|check) whether /u,
      "check whether $1 ",
    )
    .replace(/^(?:see|find out|check) if /u, "check whether ")
    .replace(/\b(?:we've|i've)\b/gu, "we have")
    .replace(/\bit's\b/gu, "it is")
    .replace(
      /^(?:for (?:this|my|the) (?:task|assignment|ticket), |(?:can|could|would) you (?:please )?)/u,
      "",
    )
    .replace(/,? (?:please|for me)$/u, "");
  // An explicit formula is bound to these three named values, in this order.
  // Never evaluate or simplify a user-supplied expression.
  const distanceFormula =
    /^(?:(?:calculate|compute|show me) )?\((?:current|observed|actual)(?: value)? (?:minus|-) baseline\) (?:divided by|\/) \(target (?:minus|-) baseline\)(?: for (?:this|the) (?:task|item))? (?:and express it (?:in percent|as a percent)|in percent|times 100|\* 100)$/u;
  if (distanceFormula.test(root)) return [progressPin];
  const scale =
    /^(?:if |with )(?:our |the )?(?:baseline|starting (?:reading|value|point)) (?:counts as|at|is) (?:0%|zero percent) and (?:our |the )?(?:target|goal) (?:counts as|at|is) (?:100%|one hundred percent), (?:where (?:do we sit|are we|does (?:our|the) (?:reading|measurement) fall)|what(?:'s| is) our progress)(?: now| today| on (?:that|this) scale)?$/u;
  if (scale.test(root)) return [progressPin];
  // A calendar sign convention is an output format, not a conditional action.
  const signedCountdown =
    /^(?:if (?:it|this|the task)(?: is|'s) (?:already )?(?:late|overdue), )?(?:show|give|report|count|return)(?: me)? (?:the )?(?:calendar )?days (?:left|remaining|until (?:the )?(?:deadline|due date)) (?:as (?:a )?negative (?:number|value)(?: if (?:late|overdue))?|with (?:a )?negative (?:number|value) (?:if|when) (?:late|overdue))$/u;
  if (signedCountdown.test(root)) return [deadlinePin];
  // Only read/review questions and named local work products have frames.
  // Conditional, quoted, directional delivery and task-changing verbs are outside them.
  if (
    /\b(?:if|unless|not|never|without|instead|except|only when|otherwise|someone|other|another|should|will|probably|might|usually|every|always|during|business|working|percentage points?)\b|\b[a-z]+n't\b/u.test(
      root,
    )
  )
    return [];
  if (
    /\b(?:and|or) (?:then |also )?(?:check|read|write|draft|count|show|tell|give|compare|calculate|prepare|review|look up|find|determine)\b/u.test(
      root,
    )
  )
    return [];
  // Bare fractions of the whole planned journey imply progress already made.
  // Coverage, raw-value ratios, reverse travel and remaining distance have
  // different denominators or directions and must not enter this shorthand.
  const basis =
    /^(?:(?:show me|give me|calculate|what is|what's) (?:the )?)?(?:what )?(?:fraction|percentage|percent|proportion|share) of (?:the )?(?:way|journey|distance|gap) (?:from (?:our |the )?(?:baseline|start(?:ing (?:point|value|number))?) (?:to|toward) (?:our |the )?(?:target|goal|finish line)|between (?:our |the )?baseline and (?:our |the )?(?:target|goal))$/u;
  if (basis.test(root)) return [progressPin];
  const question =
    /^(?:how|what|where|when|by when|on what|which|is|are|am|has|have|do|did|does|can|could|would|where's|what's|how's)\b/u.test(
      root,
    );
  if (
    /^(?:(?:quick|current) )?(?:status|progress)(?: (?:check|update))? (?:on|of|for) (?:this |the |our )?(?:goal|target)$/u.test(
      root,
    )
  )
    return [pin, progressPin];
  const g = slotsFor(root, goal, boundMetric);
  if (g) {
    const reference = g.has("target") || g.has("base");
    const ask =
      question ||
      g.has("ask") ||
      g.has("compare") ||
      g.has("presentation") ||
      /\b(?:versus|vs|relative to)\b/u.test(root) ||
      /^(?:percent(?:age)?|fraction|portion|share) of /u.test(root);
    if (g.has("pct")) {
      // The fraction is about distance traversed, never the raw value/target ratio.
      const traversed =
        g.has("advance") ||
        (g.has("reading") &&
          /^(?:what )?(?:percent(?:age)?|fraction|portion|share) of (?:the )?(?:way|journey|distance) from /u.test(
            root,
          ));
      const plannedChange =
        /\b(?:planned (?:improvement|reduction)|improvement we set out to make)\b/u.test(
          root,
        );
      if (
        ask &&
        g.has("target") &&
        traversed &&
        (g.has("base") || plannedChange) &&
        !/\b(?:still needed|left|remaining|to go|yet to|shortfall|from (?:our |the )?(?:target|goal|finish line) (?:back )?(?:to|towards?) (?:our |the )?(?:baseline|starting|initial|original))\b/u.test(
          root,
        )
      )
        return [progressPin];
    } else if (ask && reference) {
      const relation = /\b(?:against|versus|relative to|next to|vs)\b/u.test(
        root,
      );
      const compareReading =
        g.has("reading") &&
        (g.has("compare") || g.has("distance") || g.has("advance") || relation);
      const personalComparison =
        /\b(?:are we|am i) (?:now |currently |already |still )?(?:under|over|above|below|ahead of|behind|short of|past|at|on)\b/u.test(
          root,
        );
      const goalStatus =
        (g.has("target") || (g.has("base") && personalComparison)) &&
        (g.has("advance") ||
          personalComparison ||
          /\b(?:did we (?:meet|hit|beat|reach|exceed)|have we (?:met|hit|reached|exceeded)|are we (?:above|below|ahead of|behind|hitting|meeting|reaching|on)|on track|where (?:do we stand|are we)|how (?:close|far|are we doing))\b/u.test(
            root,
          ));
      if (compareReading || goalStatus) return [pin, progressPin];
    }
  }
  const t = slotsFor(root, calendar);
  if (t) {
    const checkDate =
      t.has("due") &&
      (question || t.has("ask") || t.has("status") || t.has("days"));
    const checkRemaining =
      t.has("task") &&
      t.has("status") &&
      (t.has("days") || /\b(?:late|overdue|early)\b/u.test(root));
    const signedDays =
      /^(?:(?:how many|number of|calendar) )?days (?:overdue|past due|before (?:the )?deadline|left until due)$/u.test(
        root,
      );
    if (checkDate || checkRemaining || signedDays) return [deadlinePin];
  }
  // Retrieval of an existing note and actual delivery are different operations.
  // Restrict draft requests to creation verbs, or an explicit request for a draft.
  const createNote =
    /^(?:write|jot|draft|prepare|put|compose|draw up|turn|make|create|assemble|pull|collect|compile|gather|organize|capture|leave me|produce|summari[sz]e|condense|distill|recap|bundle)\b/u.test(
      root,
    );
  const wantsDraft =
    /^(?:i need|i want|i(?:'d| would) like|give me) (?:(?:a|an) |(?:local |unsent )?(?:reviewer|owner) handoff )/u.test(
      root,
    );
  const evidenceArtifact =
    /^(?:a |an |the )?(?:local |brief |short |draft )?(?:evidence|reviewer|owner) (?:note|summary|brief|memo)(?: (?:from|using|for|with) .+)?$/u.test(
      root,
    );
  const namedDraft =
    /^(?:(?:a|an|the) )?(?:(?:local|reviewer|owner|evidence|draft|brief|short) )*(?:handoff|hand-off|handover) (?:note|draft|brief|summary|memo)(?: (?:with|for|from|using) .+)?$/u.test(
      root,
    );
  if (createNote || wantsDraft || namedDraft || evidenceArtifact) {
    const n = slotsFor(root, note);
    if (
      n &&
      (n.has("handoff") ||
        (n.has("evidence") && (n.has("note") || n.has("person"))))
    )
      return [handoffPin];
  }
  return [];
}

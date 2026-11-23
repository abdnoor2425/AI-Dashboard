// Conversational fallback for short operator requests about the active task.
// It runs only after every strict parser abstains. It returns candidate
// revisions; selectSkill still applies installation, grant, tool, retirement,
// measurement and override checks before anything can be chosen or run.
// Anything that names an outside destination, an edit, a forecast, advice,
// a different unit, a different subject or two operations abstains.
import { deadlinePin, handoffPin, pin, progressPin } from "./config.ts";
import { metricName } from "./phrasing.ts";

const outsideDestination =
  /\b(?:send|sends|sending|sent|e-?mail|emailed|mail|text|sms|message|dm|slack|teams|whatsapp|post|posting|publish|publicly|public|share|sharing|forward|upload|attach|attachment|notify|ping|tweet|linkedin|portal|website|blog|press|newsletter|print|export|download|call|phone|invite|book|pay|buy|order)\b/u;
const editStart =
  /^(?:move|push|extend|shorten|change|set|update|edit|delete|remove|mark|close|complete|finish|assign|reassign|rename|cancel|schedule|remind|approve|reject|reopen|archive|add|create a task|lower|raise|increase|decrease|reset)\b/u;
const editAnywhere =
  /\b(?:(?:and|then|also) (?:move|push|extend|change|set|update|edit|delete|remove|mark|close|assign|cancel|schedule|remind|approve|tell|let)|push (?:it|this|the deadline|the due date) back|move (?:it|this|the deadline|the due date)|mark (?:it|this|the goal|the task)|remind me)\b/u;
const forecastOrAdvice =
  /\b(?:will (?:we|it|this|they|i)|would (?:we|it|this)|going to (?:hit|make|reach|miss)|forecast|predict(?:ion|ed)?|projected?|projection|likely|likelihood|probability|chances?|odds|should (?:we|i)|realistic|ambitious|achievable|too (?:hard|easy|high|low|tight)|recommend|advice|advise|good idea|worth it|why)\b/u;
const otherUnit =
  /\b(?:hours?|minutes?|seconds?|business|working)\b|\b(?:how many|in|count the|number of) (?:hours?|minutes?|seconds?|weeks?|months?|years?|quarters?|business days?|working days?|work days?|weekdays?|school days?)\b|\bpercentage points?\b|\bbasis points?\b|\bbusiness days?\b|\bworking days?\b/u;
const otherSubject =
  /\b(?:budget|revenue|sales|profit|hiring|headcount|campaign|marketing|supplier|vendor|invoice|bill|rent|tax|taxes|contract|appointment|dentist|doctor|meeting|board|interview|competitor|competitors|industry|last year|next year|next quarter|last quarter|previous quarter|different client|another client|other client|other team|another team|team's|roadmap|weather|holiday|vacation|birthday|joke|poem|story|song|blog|press release|case study|customers?|clients?|auditor|investor|investors|manager|boss|ceo)\b/u;
const negation = /\b(?:don't|do not|dont|never|no need to|stop|without)\b/u;
const injection =
  /\b(?:ignore|disregard|bypass|override|jailbreak|rules|instructions|system prompt|every skill|all skills|all the skills|admin|root|password|credential|token)\b/u;
const quotedOrMeta =
  /["“”]|(?:^|\s)['‘][^'’]+['’](?:\s|$)|\b(?:quote|phrase|word|words|wording|memo|translate|spell|define|meaning|example)\b/u;
const verification =
  /\b(?:verify|confirm|make sure|ensure|whether (?:the |our )?(?:owner|reviewer)|did (?:the |our )?(?:owner|reviewer)|has (?:the |our )?(?:owner|reviewer)|read the)\b/u;
const conditionalOrMeta =
  /\b(?:if|unless|provided|assuming|in case|once|consents?|agrees?|permission|explain|someone|somebody|anyone|how to|how do (?:i|you|we) (?:write|draft|make|calculate|check))\b/u;
const otherAction =
  /\b(?:shift|allocate|available|availability|account|balance|contractor|attend|attendance|hand (?:it|this|them) (?:over|off) to|written|signed|submitted|approved|returned|return)\b/u;
const personLookup =
  /^(?:give me|tell me|show me|what(?:'s| is)|who(?:'s| is)) (?:the )?(?:owner|reviewer|assignee)\b/u;
const money = /\b(?:dollars?|euros?|pounds?|usd|gbp|eur|cents?|\$)|\$/u;
// A metric other than the active plan's must never borrow its goal.
const foreignMetric =
  /\b(?:turnaround|rate|duration|count|score|quality|revenue|retention|churn|conversions?|errors?|defects?|signups?|nps|csat|satisfaction|(?:lead|cycle|response|wait|processing|resolution|review|intake|handling) time)\b/u;
const habitual =
  /\b(?:usually|typically|normally|always|on average|average|historically|history|tend to|every time)\b/u;
const lookupOnly =
  /^(?:what(?:'s| is| are)|tell me|show me|remind me of) (?:the |our |my )?(?:\w+ )?(?:target|goal|baseline|objective)s?(?: for \w+(?: \w+)?)?$/u;
const personChoice = /^(?:who|whom|which person)\b/u;
const pleasantry =
  /^(?:thanks?|thank you|ok(?:ay)?|great|cool|nice|got it|sounds good|perfect|hello|hi|hey|bye)\b/u;

const deadlineCue =
  /\b(?:due|deadline|overdue|late|countdown|past due)\b|\b(?:days?|time) (?:left|remaining|to go)\b|\bhow (?:much time|long|many days) (?:do|have) (?:i|we)\b|\b(?:need|needs|have|has) to be (?:finished|done|completed|ready)\b|\bmissed the (?:deadline|due date)\b/u;
const goalAnchor =
  /\b(?:target|goal|baseline|objective|on track|on target|off track|where we started|since we started|when we started|starting point|METRIC)\b/u;
const goalMotion =
  /\b(?:on target|on track|off track|track|doing|going|looking|look|progress|progressing|status|stand|stands|close|closer|far|off|ahead|behind|gap|compare|compares|compared|comparison|versus|vs|against|improve|improved|improving|improvement|better|worse|hit|hitting|reach|reached|reaching|meet|meeting|met|moved|move|where are we|where we are|where things stand|at with|update|check|check-in|number|reading|measurement|latest|current|now)\b/u;
const percentCue =
  /\b(?:percent|percentage|per cent|fraction|proportion|share)\b|%|\bhow far along\b/u;
const handoffCue = /\b(?:hand ?off|hand-off|handover|hand-over)\b/u;
const noteCue =
  /\b(?:note|summary|summari[sz]e|recap|brief|write up|write-up|rundown|overview)\b/u;
// A plain "note for the owner" is not a handoff. The note must carry the
// task's evidence or be for whoever takes the work over.
const handoffAudience =
  /\b(?:whoever|next person|next owner|next reviewer|takes over|taking over|picks (?:this|it) up|evidence|findings|proof|what we(?:'ve| have)? (?:got|have)|what we have)\b/u;
const writeVerb =
  /^(?:(?:can i get|could i get|i need|i'd like|i would like|give me|get me|let's have|let's get|we need) |(?:write|draft|prepare|prep|make|create|put together|compose|produce|summari[sz]e|recap|write up|handover|handoff|hand-off)\b)/u;

const explicitComparison =
  /\b(?:number|reading|measurement|value|figure|baseline|started|starting|began|gap|difference|compare|compared|comparison|closer|far|off|better|worse|improve|improved|improving|improvement|hit|hitting|reach|reached|ahead|behind|against|versus|vs|above|below|met|meet)\b/u;

// Nouns that can appear in an argument clause ("between today and the deadline").
const argumentNoun =
  /\b(?:target|goal|baseline|reading|measurement|number|value|evidence|deadline|due|today|now|owner|reviewer|we started|where we are|metric|METRIC|days?|time|percent|percentage|fraction)\b/u;

function family(text: string): string | null {
  const found = new Set<string>();
  const isPercent = percentCue.test(text);
  const goalish =
    goalAnchor.test(text) ||
    /\b(?:progress|improved|improvement|gap|how far along)\b/u.test(text);
  if (isPercent && goalish) found.add("percent");
  else if (goalAnchor.test(text) && goalMotion.test(text)) found.add("goal");
  else if (/^have we improved\b|^are we improving\b/u.test(text))
    found.add("goal");
  if (deadlineCue.test(text)) found.add("deadline");
  const handoff =
    handoffCue.test(text) ||
    (noteCue.test(text) && handoffAudience.test(text) && writeVerb.test(text));
  if (handoff) {
    // "Summarise the evidence" without a reader or note is still a handoff
    // only when the note is clearly local and for the task's people.
    found.add("handoff");
  }
  if (found.size !== 1) return null;
  return [...found][0];
}

export function conversationalRevisions(
  phrase: string,
  metric: string,
): readonly string[] {
  if (!phrase || phrase.length > 120) return [];
  let text = phrase
    .replace(/[?.!]+$/u, "")
    .replace(
      /^(?:quick (?:check|question)|real quick|so|um|hey|ok|okay)[:,]? /u,
      "",
    )
    .replace(/\s+/gu, " ")
    .trim();
  const active = metric.trim().toLowerCase();
  if (active && metricName.test(active) && text.includes(active))
    text = text.replace(new RegExp("\\b" + active + "\\b", "gu"), "METRIC");
  if (
    outsideDestination.test(text) ||
    editStart.test(text) ||
    editAnywhere.test(text) ||
    forecastOrAdvice.test(text) ||
    otherUnit.test(text) ||
    otherSubject.test(text) ||
    negation.test(text) ||
    injection.test(text) ||
    habitual.test(text) ||
    foreignMetric.test(text) ||
    percentCue.test(text) ||
    conditionalOrMeta.test(text) ||
    otherAction.test(text) ||
    personLookup.test(text) ||
    money.test(text) ||
    /[.?!;]\s/u.test(text) ||
    /\bor\b/u.test(
      text.replace(/\b(?:ahead or behind|behind or ahead)\b/gu, ""),
    ) ||
    quotedOrMeta.test(phrase) ||
    verification.test(text) ||
    lookupOnly.test(text) ||
    personChoice.test(text) ||
    pleasantry.test(text)
  )
    return [];
  // Every joined part must be about the task's own fields. An unexplained
  // second clause ("... and tell the team") abstains.
  const parts = text.split(
    /\s(?:and then|and also|and|then|plus|also)\s|[,;:]\s/u,
  );
  if (
    parts.length > 1 &&
    !parts.every(
      (part) =>
        argumentNoun.test(part) ||
        percentCue.test(part) ||
        family(part) !== null,
    )
  )
    return [];
  switch (family(text)) {
    case "percent":
      return [progressPin];
    case "goal":
      // A general check-in can use either goal revision. A request that
      // names a reading, the baseline or a gap asks for the comparison.
      return explicitComparison.test(text) ? [pin] : [pin, progressPin];
    case "deadline":
      return [deadlinePin];
    case "handoff":
      return [handoffPin];
    default:
      return [];
  }
}

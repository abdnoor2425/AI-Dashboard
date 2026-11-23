// Only closed, non-action statements can frame a request. Unknown sentences are
// preserved for full-clause parsing. Never discard text up to a generic punctuation mark.
const task =
  "(?:(?:this|my|the) (?:current |assigned |selected )?(?:task|ticket|assignment|item|action|pilot|work item)|this one)";
const subject =
  "(?:the |our |my |this task's )?(?:(?:most recent|latest|current|new|recorded|observed|last) )?(?:reading|value|observation|result|figure|measurement)";
const context = new RegExp(
  "^(?:" +
    subject +
    " (?:is (?:in|on file|available)|has been (?:recorded|saved))|" +
    "i(?:'m| am) (?:reviewing|revisiting|looking at|working on) " +
    task +
    "|" +
    "(?:the |our )?(?:next |assigned )?(?:reviewer|owner) needs (?:context|a summary)" +
    ")[.!] (?:please )?",
  "u",
);
const topic = new RegExp(
  "^(?:(?:on|for|regarding|about) " + task + "), (?:please )?",
  "u",
);
const questionFraming =
  /^(?:i(?:'d| would) (?:also )?like to know|i(?:'m| am) (?:wondering|trying to (?:find out|see))|tell me|let me know) (?=(?:how|where|when|what|whether)\b)/u;
// Resolve an anaphor only when its preceding sentence names the complete
// baseline-to-target interval. Keep the remainder for ordinary safety checks.
const distanceTopic =
  /^(?:(?:we (?:want|aim|planned) to|our (?:goal|plan) (?:is|was) to) (?:move|go|get) from (?:our |the )?(?:baseline|starting (?:point|reading|value|level)) to (?:our |the )?(?:goal|target)|(?:our |the )?(?:baseline|starting (?:point|value)) (?:is|marks) (?:the )?start and (?:our |the )?(?:goal|target) (?:is|marks) (?:the )?(?:finish|end))[.!] /u;
function resolveDistanceContext(text: string) {
  const lead = distanceTopic.exec(text);
  if (!lead) return text;
  const question = text.slice(lead[0].length);
  const refersBack = /\b(?:that|this) (?:change|distance|journey|gap)\b/u;
  return refersBack.test(question)
    ? question.replace(refersBack, "the baseline to target gap")
    : text;
}
export function requestContext(phrase: string) {
  return resolveDistanceContext(phrase)
    .replace(/^(?:i also need|i also want|i'd also like) /u, "i need ")
    .replace(/^two things please, /u, "two things: ")
    .replace(context, "")
    .replace(
      /^(?:can i (?:see|get)|could i (?:see|get)|i(?:'d| would) like to see) (how|where|when|what)\b/u,
      "$1",
    )
    .replace(/^(?:give me|tell me) (?:a )?quick (?:check|read) on /u, "check ")
    .replace(topic, "")
    .replace(questionFraming, "")
    .replace(/^whether /u, "check whether ");
}

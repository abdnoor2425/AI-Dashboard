// Remove grammatical scaffolding only when both its beginning and its end
// are understood. Unrecognized requests and conditions stay in the input.
const speaker = "(?:i|we)";
const recipient = "(?:me|us)";
const modal = "(?:can|could|would)";
const preamble = new RegExp(
  "^(?:" +
    "(?:" +
    speaker +
    "(?:'m|'re| am| are| was| were) (?:just )?(?:trying|hoping|looking) to " +
    "(?:find out|understand|see|work out|check|know)|" +
    speaker +
    "(?:'d| would) (?:really )?(?:like|love) to (?:know|see|understand)|" +
    "(?:help " +
    recipient +
    "|can you help " +
    recipient +
    ") (?:understand|see|figure out|work out)|" +
    "(?:" +
    modal +
    " (?:you|somebody)|please) (?:tell|show) " +
    recipient +
    ") " +
    "(?=(?:how|what|where|when|whether|if)\\b)|" +
    "(?:" +
    modal +
    " (?:i|we) (?:please )?(?:have|get)|" +
    speaker +
    " (?:just |also )?(?:need|want)(?: to see)?) (?:these |the following )?(?:two |both )?(?:local )?(?:things|outputs|results|checks)(?: (?:for|on) (?:this|the) (?:task|item))?\\s*[:,.]\\s*" +
    ")",
  "u",
);
const discourse =
  /^(?:(?:first(?:ly)?|second(?:ly)?|also|separately|next|lastly|finally|for one|for the other)[,:] )/u;
const localTopic =
  /^(?:for|on|about|regarding) (?:this|my|the) (?:(?:assigned|current|open|selected) )?(?:task|work item|ticket|assignment|action)[,:] /u;
export function speechAct(text: string) {
  return text
    .replace(discourse, "")
    .replace(localTopic, "")
    .replace(preamble, "");
}

// Ellipsis may borrow a read-only request head ("give me A and B"). Never
// synthesize an action verb or a task operand from a different clause.
export function sharedReadHead(text: string) {
  return /^(?:(?:please )?(?:show|give|tell) (?:me|us)|(?:i|we) (?:need|want)|i(?:'d| would) like) /u.exec(
    text,
  )?.[0];
}

// Linear: open tasks assigned to you become "needs you" items, and tasks you gave to someone else show who has them.
// Reading is the default. The only writes are the ones you ask for yourself: a comment, or an alert that mentions people.
// NOTE: written against Linear's public GraphQL docs and not yet run against a live workspace.
import { getSecrets } from "./store.ts";

async function gql(wsId: string, query: string, variables: any = {}) {
  const key = getSecrets(wsId).linear?.token;
  if (!key) throw new Error("Linear needs an API key. Add it on the Connections page.");
  const r = await fetch("https://api.linear.app/graphql", { method: "POST", headers: { "content-type": "application/json", authorization: key }, body: JSON.stringify({ query, variables }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) throw new Error(j.errors?.[0]?.message || "Linear refused the key.");
  return j.data;
}

const FIELDS = `id identifier title url priority dueDate updatedAt state { name } project { name } assignee { name displayName }`;
const OPEN = `state: { type: { in: ["unstarted", "started", "backlog"] } }`;

export async function syncLinear(wsId: string, owner: string, now: number) {
  const d = await gql(wsId, `{ viewer { name
    assignedIssues(first: 40, filter: { ${OPEN} }) { nodes { ${FIELDS} } }
    createdIssues(first: 40, filter: { ${OPEN}, assignee: { isMe: { eq: false } } }) { nodes { ${FIELDS} } } } }`);
  // Linear priority: 1 urgent, 2 high, 3 medium, 4 low, 0 none. "None" stays unknown rather than becoming a zero.
  const impact: Record<number, number | null> = { 1: 5, 2: 4, 3: 3, 4: 2, 0: null };
  const item = (n: any, mine: boolean) => {
    const who = n.assignee?.name || n.assignee?.displayName || "";
    return {
      id: "lin-" + n.id, actionKey: "linear:" + n.identifier, kind: /approv|review|sign.?off/i.test(n.title) ? "approval" : /reply|answer|respond/i.test(n.title) ? "reply" : "decision",
      title: n.title, nextStep: mine ? `Open ${n.identifier} in Linear (${n.state?.name || "open"})` : `${who.split(" ")[0]} has ${n.identifier} (${n.state?.name || "open"})`,
      scope: null, scopeLabel: n.project?.name || undefined, owner: mine ? owner : who, waitingOn: mine ? "me" : "other", assignee: mine ? owner : who, assignedByMe: !mine,
      due: n.dueDate ? Date.parse(n.dueDate + "T17:00:00") : null, followUpDue: mine ? undefined : n.dueDate ? Date.parse(n.dueDate + "T17:00:00") : undefined,
      sources: [{ tool: "linear", label: n.title, ref: n.identifier, url: n.url }],
      evidence: "needs-context", evidenceNote: "Brought in from Linear. Linear does not say what this unblocks or which goal it serves, so those are left unknown.",
      missing: "what it unblocks and goal fit", lastVerified: now, factors: { impact: impact[n.priority] ?? null }, status: "open",
    };
  };
  const mine = d.viewer.assignedIssues.nodes.map((n: any) => item(n, true));
  const seen = new Set(mine.map((i: any) => i.id));
  const given = d.viewer.createdIssues.nodes.filter((n: any) => n.assignee && !seen.has("lin-" + n.id)).map((n: any) => item(n, false));
  return { account: d.viewer.name, items: [...mine, ...given], mine: mine.length, given: given.length };
}

/** Post one comment on a ticket, as the person whose key is saved here. */
export async function linearComment(wsId: string, issueId: string, body: string) {
  const d = await gql(wsId, `mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { url } } }`, { input: { issueId, body } });
  if (!d.commentCreate?.success) throw new Error("Linear did not save the comment.");
  return { url: d.commentCreate.comment?.url || "" };
}

/** Alert people on a ticket: each one is subscribed to it and named in a comment, so Linear notifies them.
 *  Returns who was found in Linear and who was not, so the rest can be reached another way. */
export async function linearAlert(wsId: string, issueId: string, people: { name: string; email?: string }[], note: string, from: string, checkOnly = false) {
  const d = await gql(wsId, `query($id: String!) { users(first: 200) { nodes { id name displayName email active } } issue(id: $id) { subscribers { nodes { id } } } }`, { id: issueId });
  const users: any[] = (d.users?.nodes || []).filter((u: any) => u.active !== false);
  const same = (a: string, b: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const find = (p: { name: string; email?: string }) => users.find((u) => same(u.email, p.email || "")) || users.find((u) => same(u.name, p.name) || same(u.displayName, p.name))
    || ((l) => (l.length === 1 ? l[0] : undefined))(users.filter((u) => same(String(u.name).split(" ")[0], p.name.split(" ")[0])));
  const found: { person: string; user: any }[] = [], missing: string[] = [];
  for (const p of people) { const u = find(p); if (u) found.push({ person: p.name, user: u }); else missing.push(p.name); }
  if (found.length && !checkOnly) {
    const subs = Array.from(new Set([...(d.issue?.subscribers?.nodes || []).map((s: any) => s.id), ...found.map((f) => f.user.id)]));
    await gql(wsId, `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`, { id: issueId, input: { subscriberIds: subs } });
    const body = `${found.map((f) => "@" + f.user.displayName).join(" ")} ${from} would like you to look at this.${note ? "\n\n" + note : ""}`;
    await linearComment(wsId, issueId, body);
  }
  return { reached: found.map((f) => f.person), missing };
}

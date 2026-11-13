// Linear: open tasks assigned to you become "needs you" items. Read only, with a personal API key.
// NOTE: written against Linear's public GraphQL docs and not yet run against a live workspace.
import { getSecrets } from "./store.ts";

export async function syncLinear(wsId: string, owner: string, now: number) {
  const key = getSecrets(wsId).linear?.token;
  if (!key) throw new Error("Linear needs an API key.");
  const query = `{ viewer { name assignedIssues(first: 40, filter: { state: { type: { in: ["unstarted", "started", "backlog"] } } }) { nodes { id identifier title url priority dueDate updatedAt state { name } project { name } } } } }`;
  const r = await fetch("https://api.linear.app/graphql", { method: "POST", headers: { "content-type": "application/json", authorization: key }, body: JSON.stringify({ query }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j.errors) throw new Error(j.errors?.[0]?.message || "Linear refused the key.");
  // Linear priority: 1 urgent, 2 high, 3 medium, 4 low, 0 none. "None" stays unknown rather than becoming a zero.
  const impact: Record<number, number | null> = { 1: 5, 2: 4, 3: 3, 4: 2, 0: null };
  return {
    account: j.data.viewer.name,
    items: j.data.viewer.assignedIssues.nodes.map((n: any) => ({
      id: "lin-" + n.id, actionKey: "linear:" + n.identifier, kind: /approv|review|sign.?off/i.test(n.title) ? "approval" : /reply|answer|respond/i.test(n.title) ? "reply" : "decision",
      title: n.title, nextStep: `Open ${n.identifier} in Linear (${n.state?.name || "open"})`, scope: null, scopeLabel: n.project?.name || undefined, owner, waitingOn: "me",
      due: n.dueDate ? Date.parse(n.dueDate + "T17:00:00") : null, sources: [{ tool: "linear", label: n.title, ref: n.identifier, url: n.url }],
      evidence: "needs-context", evidenceNote: "Brought in from Linear. Linear does not say what this unblocks or which goal it serves, so those are left unknown.",
      missing: "what it unblocks and goal fit", lastVerified: now, factors: { impact: impact[n.priority] ?? null }, status: "open",
    })),
  };
}

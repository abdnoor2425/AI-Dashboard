// Handovers: when someone on Your team gives a task to someone else on Your team.
// This is what "Watch it live" plays. It is worked out from data the dashboard already has,
// so it works for any team: a Linear ticket the dashboard owner assigned, or an alert sent from an item.

export interface Person { id: string; name: string; email?: string; parent?: string | null }
export interface Handover {
  id: string;          // stable per item and recipient, so the newest handover of the same task wins
  itemId: string;
  title: string;
  from: string;        // person id of whoever handed it over
  to: string;          // person id of whoever received it
  at: number;          // when it happened (ms)
  via: "linear" | "alert";
  note?: string;
}
export interface Phrases { give: string[]; reply: string[] }

export const DEFAULT_PHRASES: Phrases = {
  give: ["Get it done.", "This one's yours.", "Over to you.", "Need this by Friday.", "You've got this.", "Make it sing.", "Your move.", "Handle this for me?"],
  reply: ["On it, boss!", "Okay, boss.", "Consider it done.", "Already on it.", "Leave it with me.", "You got it.", "On my desk now.", "I'll take it from here."],
};

const clean = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Finds a team member from a name or an email, the way people write them in tools.
 *  Tries, in order: email, full name, then first name, but only when exactly one person has that first name. */
export function matchPerson<P extends Person>(team: P[], who: unknown): P | null {
  const w = clean(who);
  if (!w) return null;
  if (w.includes("@")) return team.find((p) => clean(p.email) === w) || null;
  const full = team.find((p) => clean(p.name) === w);
  if (full) return full;
  const first = w.split(" ")[0];
  const same = team.filter((p) => clean(p.name).split(" ")[0] === first);
  return same.length === 1 ? same[0] : null;
}

/** Every handover in a workspace, newest first. One per task and recipient. */
export function handoversFrom(items: any[], team: Person[]): Handover[] {
  const leader = team[0];
  if (!leader || team.length < 2) return [];
  const out = new Map<string, Handover>();
  const add = (h: Handover) => {
    if (h.from === h.to) return;
    const old = out.get(h.id);
    if (!old || h.at >= old.at) out.set(h.id, h);
  };
  for (const it of items || []) {
    if (!it || it.dismissed) continue;
    // A Linear ticket the dashboard owner created and gave to someone: the owner is The Leader.
    if (it.assignedByMe && it.assignee) {
      const to = matchPerson(team, it.assigneeEmail) || matchPerson(team, it.assignee);
      if (to) add({ id: `${it.id}:${to.id}`, itemId: it.id, title: it.title, from: leader.id, to: to.id, at: Number(it.assignedAt || it.lastVerified || it.createdAt || 0), via: "linear" });
    }
    // An alert sent from the dashboard. It comes from whoever sent it if they are on the team, otherwise The Leader.
    for (const al of it.alerts || []) {
      const from = matchPerson(team, al.by) || leader;
      for (const name of al.to || []) {
        const to = matchPerson(team, name);
        if (to) add({ id: `${it.id}:${to.id}`, itemId: it.id, title: it.title, from: from.id, to: to.id, at: Number(al.at || 0), via: "alert", note: al.note || undefined });
      }
    }
  }
  return [...out.values()].sort((a, b) => b.at - a.at);
}

/** Saved phrase lists, cleaned: trimmed, short, no blanks or repeats, and never empty. */
export function phrasesFrom(saved: any): Phrases {
  const list = (v: any, d: string[]) => {
    const l = (Array.isArray(v) ? v : []).map((x) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, 60)).filter(Boolean);
    const unique = [...new Set(l)].slice(0, 24);
    return unique.length ? unique : d;
  };
  return { give: list(saved?.give, DEFAULT_PHRASES.give), reply: list(saved?.reply, DEFAULT_PHRASES.reply) };
}

/** Picks a phrase. The same seed always gives the same line, and the next replay (seed + 1) gives a different one. */
export function pickPhrase(list: string[], seed: string, n = 0): string {
  if (!list.length) return "";
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return list[((h >>> 0) + n) % list.length];
}

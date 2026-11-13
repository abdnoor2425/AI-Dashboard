// Attention ranking. Pure functions, no side effects, so the same inputs and
// rubric revision always give the same order and the same explanation.
//
// Priority = 7 x Urgency + 6 x Impact + 4 x Unblocks + 2 x Goal alignment + 1 x Waiting age
// Each factor is 0 to 5. A factor we do not know is `null`, never 0.
import { DAY, HOUR } from "./rand.ts";

export type FactorKey = "urgency" | "impact" | "unblocks" | "alignment" | "waitingAge";
export type Evidence = "verified" | "needs-context" | "stale" | "conflicting";

export interface Rubric {
  version: string;
  owner: string;
  weights: Record<FactorKey, number>;
}

export const DEFAULT_RUBRIC: Rubric = {
  version: "1.0",
  owner: "COO",
  weights: { urgency: 7, impact: 6, unblocks: 4, alignment: 2, waitingAge: 1 },
};

export const FACTORS: { key: FactorKey; label: string; hint: string }[] = [
  { key: "urgency", label: "Urgency", hint: "How close the real deadline or consequence is" },
  { key: "impact", label: "Business impact", hint: "What is at stake for the business or client" },
  { key: "unblocks", label: "You unblock", hint: "How much is waiting on your decision or reply" },
  { key: "alignment", label: "Goal alignment", hint: "How directly it advances a current goal" },
  { key: "waitingAge", label: "Waiting age", hint: "How long a due follow-up has been open" },
];

export interface AttentionItem {
  id: string;
  /** For a Linear ticket: the person it is assigned to. */
  assignee?: string;
  assignedByMe?: boolean;
  comments?: { text: string; by: string; at: number; ref?: string; via?: string }[];
  alerts?: { to: string[]; note: string; by: string; at: number; how?: { linear: string[]; email: string[] } }[];
  /** Records that describe the same underlying action share an actionKey and are merged into one card. */
  actionKey?: string;
  kind: "decision" | "approval" | "reply" | "risk";
  title: string;
  nextStep: string;
  scope?: string | null;
  scopeLabel?: string;
  owner: string;
  /** "me": the viewer's attention changes the outcome. "other": the viewer is waiting on someone else. */
  waitingOn: "me" | "other";
  due?: number | null;
  tz?: string;
  followUpDue?: number | null;
  consequence?: string;
  sources: { tool: string; label: string; url?: string; ref?: string }[];
  evidence: Evidence;
  evidenceNote?: string;
  lastVerified?: number;
  /** null means "we do not know yet". urgency and waitingAge are normally derived from dates. */
  factors: Partial<Record<FactorKey, number | null>>;
  why?: Partial<Record<FactorKey, string>>;
  missing?: string;
  verifyOwner?: string;
  status: "open" | "done" | "cancelled" | "superseded";
  doneAt?: number;
  snoozedUntil?: number | null;
  dismissed?: boolean;
  pin?: number | null;
  override?: { by: string; why: string; at: number; action: string } | null;
}

export interface Scored extends AttentionItem {
  factorsResolved: Record<FactorKey, number | null>;
  contributions: Record<FactorKey, number | null>;
  score: number;
  maxScore: number;
  complete: boolean;
  urgentFlag: boolean;
  warn: boolean;
  merged: number;
  topReasons: string[];
}

/** 5 = overdue or due within 24h, 4 = within 72h, 3 = within 7d, 2 = within 14d, 1 = later. */
export function urgencyFromDue(due: number | null | undefined, now: number): number | null {
  if (due == null) return null;
  const left = due - now;
  if (left <= 24 * HOUR) return 5;
  if (left <= 72 * HOUR) return 4;
  if (left <= 7 * DAY) return 3;
  if (left <= 14 * DAY) return 2;
  return 1;
}

/** Only a follow-up that is already due adds points. Source age alone adds nothing. */
export function waitingAgeFromFollowUp(followUpDue: number | null | undefined, now: number): number {
  if (followUpDue == null || followUpDue > now) return 0;
  const days = Math.floor((now - followUpDue) / DAY);
  if (days < 1) return 0;
  if (days <= 2) return 1;
  if (days <= 6) return 2;
  if (days <= 13) return 3;
  if (days <= 29) return 4;
  return 5;
}

const clamp5 = (n: number) => Math.max(0, Math.min(5, n));

export function scoreItem(item: AttentionItem, rubric: Rubric, now: number, merged = 1): Scored {
  const f = item.factors || {};
  const dueUrgency = urgencyFromDue(item.due, now);
  const resolved: Record<FactorKey, number | null> = {
    // A real deadline wins. Without one, use the recorded value (0 = confirmed no time pressure, null = unknown).
    urgency: dueUrgency != null ? dueUrgency : f.urgency ?? null,
    impact: f.impact ?? null,
    unblocks: f.unblocks ?? null,
    alignment: f.alignment ?? null,
    waitingAge: f.waitingAge != null ? f.waitingAge : waitingAgeFromFollowUp(item.followUpDue, now),
  };
  const contributions = {} as Record<FactorKey, number | null>;
  let score = 0, maxScore = 0, complete = true;
  for (const { key } of FACTORS) {
    const w = rubric.weights[key] ?? 0;
    maxScore += w * 5;
    const v = resolved[key];
    if (v == null) { contributions[key] = null; complete = false; continue; }
    contributions[key] = w * clamp5(v);
    score += contributions[key] as number;
  }
  const urgentFlag = resolved.urgency != null && resolved.urgency >= 5 && item.evidence !== "conflicting";
  const warn = item.evidence !== "verified" || !complete;
  const ranked = FACTORS.filter((x) => contributions[x.key] != null && (contributions[x.key] as number) > 0)
    .sort((a, b) => (contributions[b.key] as number) - (contributions[a.key] as number) || FACTORS.indexOf(a) - FACTORS.indexOf(b));
  const topReasons = ranked.slice(0, 2).map((x) => item.why?.[x.key] || defaultReason(x.key, resolved[x.key] as number, item, now));
  return { ...item, factorsResolved: resolved, contributions, score, maxScore, complete, urgentFlag, warn, merged, topReasons };
}

function defaultReason(key: FactorKey, v: number, item: AttentionItem, now: number): string {
  if (key === "urgency") {
    if (item.due == null) return "There is time pressure, but no fixed deadline is recorded.";
    const left = item.due - now;
    if (left < 0) return "The deadline has already passed.";
    if (left <= 24 * HOUR) return "It is due within 24 hours.";
    if (left <= 72 * HOUR) return "It is due within three days.";
    if (left <= 7 * DAY) return "It is due this week.";
    return "It has a set deadline coming up.";
  }
  if (key === "impact") return v >= 4 ? "A major outcome or commitment depends on it." : "It affects a real project milestone.";
  if (key === "unblocks") return v >= 4 ? "Other people cannot move until you decide." : "Your input would help the work along.";
  if (key === "alignment") return v >= 4 ? "It directly advances a current top goal." : "It supports an established goal.";
  return "A follow-up on this has been overdue for a while.";
}

/** Merge records that point at the same action. More emails about one thing never add priority. */
export function mergeDuplicates(items: AttentionItem[]): { item: AttentionItem; merged: number }[] {
  const groups = new Map<string, AttentionItem[]>();
  for (const it of items) {
    const k = it.actionKey || it.id;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  const out: { item: AttentionItem; merged: number }[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => (a.id < b.id ? -1 : 1));
    const primary = group[0];
    const seen = new Set<string>();
    const sources = group.flatMap((g) => g.sources).filter((s) => {
      const k = s.tool + "|" + (s.ref || s.label);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    out.push({ item: { ...primary, sources }, merged: group.length });
  }
  return out;
}

/** Deterministic order: score, earliest deadline, oldest overdue follow-up, then stable id. */
export function compareScored(a: Scored, b: Scored): number {
  if (b.score !== a.score) return b.score - a.score;
  const ad = a.due ?? Infinity, bd = b.due ?? Infinity;
  if (ad !== bd) return ad - bd;
  const af = a.followUpDue ?? Infinity, bf = b.followUpDue ?? Infinity;
  if (af !== bf) return af - bf;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface Queue {
  needsYou: Scored[];
  team: Scored[];
  verify: Scored[];
  snoozed: Scored[];
  done: Scored[];
  calculatedAt: number;
  rubric: Rubric;
}

export function buildQueue(all: AttentionItem[], rubric: Rubric, now: number): Queue {
  const scored = mergeDuplicates(all).map(({ item, merged }) => scoreItem(item, rubric, now, merged));
  const open = scored.filter((s) => s.status === "open" && !s.dismissed);
  const awake = open.filter((s) => !(s.snoozedUntil && s.snoozedUntil > now));
  const mine = awake.filter((s) => s.waitingOn === "me");
  // An item with missing facts only enters the main queue when a verified deadline is imminent.
  const eligible = mine.filter((s) => s.complete || s.urgentFlag);
  const pinned = eligible.filter((s) => s.pin != null).sort((a, b) => (a.pin as number) - (b.pin as number) || compareScored(a, b));
  const ranked = eligible.filter((s) => s.pin == null).sort(compareScored);
  return {
    needsYou: [...pinned, ...ranked],
    team: awake.filter((s) => s.waitingOn === "other").sort((a, b) => (a.followUpDue ?? Infinity) - (b.followUpDue ?? Infinity) || compareScored(a, b)),
    verify: awake.filter((s) => s.warn).sort(compareScored),
    snoozed: open.filter((s) => s.snoozedUntil && s.snoozedUntil > now).sort((a, b) => (a.snoozedUntil as number) - (b.snoozedUntil as number)),
    done: scored.filter((s) => s.status !== "open" || s.dismissed).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)),
    calculatedAt: now,
    rubric,
  };
}

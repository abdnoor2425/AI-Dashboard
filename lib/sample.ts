// Sample data. Everything here is made up and clearly labelled as sample in the app.
// A new workspace is always created from this same template, so two workspaces
// never share records: each gets its own copy and changes independently.
import { DAY, HOUR, hash, rng, startOfDay } from "./rand.ts";
import { DEFAULT_RUBRIC } from "./scoring.ts";
import type { AttentionItem } from "./scoring.ts";

export const ACCENTS: Record<string, { name: string; light: string; dark: string }> = {
  blue: { name: "Blue", light: "#1D5BFF", dark: "#6FA0FF" },
  indigo: { name: "Indigo", light: "#5450E0", dark: "#7F7BFF" },
  teal: { name: "Teal", light: "#0E8A8F", dark: "#3CC3C8" },
  green: { name: "Green", light: "#1F8F4E", dark: "#3FCB78" },
  orange: { name: "Orange", light: "#D9630B", dark: "#FF9438" },
  pink: { name: "Pink", light: "#D6336C", dark: "#FF6B9A" },
  graphite: { name: "Graphite", light: "#4A4F5A", dark: "#A3A9B6" },
};

export const MODULES: { id: string; label: string; group: "main" | "more"; core?: boolean }[] = [
  { id: "overview", label: "Overview", group: "main", core: true },
  { id: "attention", label: "Attention", group: "main", core: true },
  { id: "website", label: "Website", group: "main" },
  { id: "social", label: "Social", group: "main" },
  { id: "reels", label: "Reel scores", group: "main" },
  { id: "goals", label: "Goals", group: "main" },
  { id: "metrics", label: "Metrics", group: "main" },
  { id: "decisions", label: "Decision Room", group: "main" },
  { id: "clients", label: "Clients", group: "main" },
  { id: "inbox", label: "Inbox", group: "more" },
  { id: "calendar", label: "Calendar", group: "more" },
  { id: "files", label: "Files", group: "more" },
  { id: "outputs", label: "Outputs", group: "more" },
  { id: "skills", label: "Skills", group: "more" },
  { id: "suggestions", label: "Suggestions", group: "more" },
  { id: "usage", label: "AI usage", group: "more" },
  { id: "connections", label: "Connections", group: "more", core: true },
  { id: "setup", label: "Setup", group: "more", core: true },
  { id: "settings", label: "Settings", group: "more", core: true },
];

type SiteSeed = { id: string; name: string; domain: string; kind: string; color: string; base: number; growth: number; leadRate: number; networks: string[] };

const MAIN_SITES: SiteSeed[] = [
  { id: "platewise", name: "Platewise", domain: "platewise.com", kind: "Restaurant ratings", color: "#E4572E", base: 4200, growth: 0.22, leadRate: 0.021, networks: ["instagram", "tiktok", "youtube", "facebook"] },
  { id: "fernway", name: "Fernway", domain: "fernway.app", kind: "Habit app", color: "#2E9E6B", base: 1850, growth: 0.34, leadRate: 0.046, networks: ["instagram", "tiktok", "youtube"] },
  { id: "northline", name: "Northline Movers", domain: "northlinemovers.com", kind: "Local moving service", color: "#2F6FDE", base: 960, growth: 0.05, leadRate: 0.058, networks: ["facebook", "instagram"] },
  { id: "atlasnotes", name: "Atlas Notes", domain: "atlasnotes.co", kind: "Newsletter and blog", color: "#8A5CF6", base: 2600, growth: 0.11, leadRate: 0.034, networks: ["linkedin", "x", "youtube"] },
  { id: "kilnclay", name: "Kiln & Clay", domain: "kilnandclay.shop", kind: "Pottery studio shop", color: "#C98B2B", base: 1320, growth: -0.07, leadRate: 0.027, networks: ["instagram", "tiktok", "facebook"] },
  { id: "brightdesk", name: "Brightdesk", domain: "brightdesk.io", kind: "Help desk software", color: "#0FA3B1", base: 3100, growth: 0.16, leadRate: 0.018, networks: ["linkedin", "x", "youtube"] },
];

const CLIENT_SEEDS = [
  { id: "meridian", name: "Meridian Capital", sub: "Private wealth advisory", color: "#B8892B", contact: "Elena Marlowe" },
  { id: "lumen", name: "Lumen Dental", sub: "Four clinics, Greater Boston", color: "#17A27C", contact: "Dr. Priya Shah" },
  { id: "harbor", name: "Harbor Coffee Co.", sub: "Online coffee roaster", color: "#D9632B", contact: "Leo Martins" },
];

const NETWORK_BASE: Record<string, number> = { instagram: 18400, tiktok: 26100, youtube: 9200, facebook: 7400, linkedin: 5300, x: 3900 };

function sites(seeds: SiteSeed[]) {
  return seeds.map((s, i) => ({
    ...s,
    gaProperty: "properties/" + (310000000 + (hash(s.id) % 89999999)),
    metricoolBrand: { id: String(4000000 + (hash(s.id + "m") % 999999)), name: s.name, matched: i !== 4, confirmed: i < 4 },
  }));
}

function attention(now: number, t: (d: number, h?: number) => number): AttentionItem[] {
  const S = (tool: string, label: string, ref?: string) => ({ tool, label, ref, url: "#" });
  return [
    {
      id: "att-001", actionKey: "platewise-launch-post", kind: "approval", title: "Approve the Platewise launch post", nextStep: "Read the final cut and approve or send notes",
      scope: "site:platewise", scopeLabel: "Platewise", owner: "Sam", waitingOn: "me", due: t(0, 17), tz: "local",
      consequence: "The post misses tonight's slot and the launch moves to next week.",
      sources: [S("linear", "PLT-212 Launch post, final cut", "PLT-212")], evidence: "verified", lastVerified: now - 40 * 60000,
      factors: { impact: 4, unblocks: 4, alignment: 5 }, why: { unblocks: "Kenneth cannot schedule the post until you approve it.", alignment: "The Platewise launch is this quarter's top goal." }, status: "open",
    },
    {
      id: "att-002", actionKey: "platewise-launch-post", kind: "approval", title: "Launch post waiting for approval", nextStep: "Approve",
      scope: "site:platewise", scopeLabel: "Platewise", owner: "Sam", waitingOn: "me", due: t(0, 17),
      sources: [S("slack", "Kenneth in #platewise: final cut is ready", "slack-88121"), S("gmail", "Re: Launch post v4", "gm-5521")], evidence: "verified", lastVerified: now - 55 * 60000,
      factors: { impact: 4, unblocks: 4, alignment: 5 }, status: "open",
    },
    {
      id: "att-003", kind: "reply", title: "Reply to Elena about the revised scope", nextStep: "Confirm the two extra landing pages or push them to phase two",
      scope: "client:meridian", scopeLabel: "Meridian Capital", owner: "Sam", waitingOn: "me", due: t(1, 12), tz: "local",
      consequence: "Meridian's team is holding their sign-off meeting until they hear back.",
      sources: [S("gmail", "Elena Marlowe: Revised scope and timeline", "gm-5610")], evidence: "verified", lastVerified: now - 2 * HOUR,
      factors: { impact: 5, unblocks: 4, alignment: 3 }, why: { impact: "A major client commitment depends on this answer." }, status: "open",
    },
    {
      id: "att-004", kind: "decision", title: "Decide the first-quarter ad budget", nextStep: "Pick one of the three budget options Nancy prepared",
      scope: null, owner: "Sam", waitingOn: "me", due: t(4, 18), tz: "local",
      consequence: "Campaign bookings for January close at the end of next week.",
      sources: [S("drive", "Q1 ad budget options (sheet)", "drv-221"), S("linear", "OPS-41 Decide Q1 ad budget", "OPS-41")], evidence: "verified", lastVerified: now - 5 * HOUR,
      factors: { impact: 4, unblocks: 3, alignment: 5 }, status: "open",
    },
    {
      id: "att-005", kind: "risk", title: "Kiln & Clay checkout errors are rising", nextStep: "Ask Arturo to roll back Tuesday's payment change",
      scope: "site:kilnclay", scopeLabel: "Kiln & Clay", owner: "Sam", waitingOn: "me", due: null,
      consequence: "Roughly one in twelve checkouts is failing. The real number needs checking.",
      sources: [S("slack", "Arturo in #kilnclay: seeing failed payments", "slack-88410"), S("analytics", "Checkout completion, last 7 days", "ga-kiln")],
      evidence: "conflicting", evidenceNote: "Slack says 8% of checkouts fail. Analytics shows 3%. One of them is wrong.", lastVerified: now - 26 * HOUR,
      factors: { urgency: 4, impact: 4, unblocks: 3, alignment: 3 }, missing: "Which failure rate is right", verifyOwner: "Arturo", status: "open",
    },
    {
      id: "att-006", kind: "decision", title: "Choose a pricing page for Brightdesk", nextStep: "Review the two test results and pick the winner",
      scope: "site:brightdesk", scopeLabel: "Brightdesk", owner: "Sam", waitingOn: "me", due: t(9, 12),
      consequence: "The losing version keeps getting half the traffic until this is decided.",
      sources: [S("drive", "Pricing page test, results", "drv-240")], evidence: "verified", lastVerified: now - 8 * HOUR,
      factors: { impact: 5, unblocks: 2, alignment: 5 }, why: { impact: "Pricing is the biggest lever on Brightdesk revenue this quarter." }, status: "open",
    },
    {
      id: "att-007", kind: "approval", title: "Sign off the Lumen Dental homepage", nextStep: "Check the three fixes on the staging link and approve",
      scope: "client:lumen", scopeLabel: "Lumen Dental", owner: "Sam", waitingOn: "me", due: t(2, 15),
      consequence: "Dr. Shah was promised the new homepage by Friday.",
      sources: [S("linear", "LUM-77 Homepage fixes ready for review", "LUM-77")], evidence: "verified", lastVerified: now - 3 * HOUR,
      factors: { impact: 3, unblocks: 4, alignment: 3 }, status: "open",
    },
    {
      id: "att-008", kind: "reply", title: "Answer Leo's question about the holiday campaign", nextStep: "Send the two date options",
      scope: "client:harbor", scopeLabel: "Harbor Coffee Co.", owner: "Sam", waitingOn: "me", due: null, followUpDue: now - 4 * DAY,
      consequence: "Leo has asked twice. The holiday window is getting shorter.",
      sources: [S("gmail", "Leo Martins: Holiday campaign dates?", "gm-5402")], evidence: "verified", lastVerified: now - 6 * HOUR,
      factors: { urgency: 3, impact: 3, unblocks: 4, alignment: 3 }, status: "open",
    },
    {
      id: "att-009", kind: "decision", title: "Review two Fernway reels on hold", nextStep: "Watch the openings and choose: fix or publish as is",
      scope: "site:fernway", scopeLabel: "Fernway", owner: "Sam", waitingOn: "me", due: t(6, 10),
      consequence: "Both reels stay unpublished until someone decides.",
      sources: [S("sheets", "Reel scorecard, two on HOLD", "sh-reels")], evidence: "verified", lastVerified: now - 9 * HOUR,
      factors: { impact: 2, unblocks: 3, alignment: 3 }, status: "open",
    },
    {
      id: "att-010", kind: "decision", title: "Pick a name for the Atlas Notes podcast", nextStep: "Choose from the shortlist of five",
      scope: "site:atlasnotes", scopeLabel: "Atlas Notes", owner: "Sam", waitingOn: "me", due: null,
      consequence: "Nothing is blocked yet. Cover art starts once a name is picked.",
      sources: [S("drive", "Podcast name shortlist", "drv-260")], evidence: "needs-context", evidenceNote: "No deadline or goal is recorded for the podcast yet.", lastVerified: now - 3 * DAY,
      factors: { urgency: null, impact: 2, unblocks: 2, alignment: null }, missing: "Whether the podcast is a current goal, and when it should launch", verifyOwner: "Nancy", status: "open",
    },
    {
      id: "att-011", kind: "risk", title: "Northline's domain renews tomorrow", nextStep: "Confirm the card on file still works",
      scope: "site:northline", scopeLabel: "Northline Movers", owner: "Sam", waitingOn: "me", due: t(1, 9),
      consequence: "If the renewal fails, the website and email go offline.",
      sources: [S("gmail", "Registrar: your domain renews in 1 day", "gm-5633")], evidence: "verified", lastVerified: now - 90 * 60000,
      factors: { impact: null, unblocks: 5, alignment: null }, missing: "Whether auto-renew is switched on", verifyOwner: "Sam", status: "open",
    },
    {
      id: "att-012", kind: "decision", title: "Tidy the old brand folder", nextStep: "Decide what to archive",
      scope: null, owner: "Sam", waitingOn: "me", due: null, followUpDue: null,
      consequence: "Nothing changes if this waits.",
      sources: [S("drive", "Brand assets (2023)", "drv-090")], evidence: "stale", evidenceNote: "Last looked at 7 weeks ago.", lastVerified: now - 49 * DAY,
      factors: { urgency: 0, impact: 1, unblocks: 1, alignment: 1 }, status: "open",
    },
    // Waiting on other people
    {
      id: "att-020", kind: "reply", title: "Analytics access for Kenneth", nextStep: "Nancy to add Kenneth to the reporting view",
      scope: null, owner: "Nancy", waitingOn: "other", followUpDue: t(1, 10), due: null,
      sources: [S("linear", "OPS-38 Grant analytics access", "OPS-38")], evidence: "verified", lastVerified: now - 4 * HOUR,
      factors: { urgency: 2, impact: 2, unblocks: 0, alignment: 3 }, status: "open",
    },
    {
      id: "att-021", kind: "approval", title: "Meridian brand photos", nextStep: "Elena to send the approved set",
      scope: "client:meridian", scopeLabel: "Meridian Capital", owner: "Elena Marlowe", waitingOn: "other", followUpDue: now - 2 * DAY, due: null,
      sources: [S("gmail", "Re: Photo selects", "gm-5377")], evidence: "verified", lastVerified: now - 20 * HOUR,
      factors: { urgency: 2, impact: 3, unblocks: 0, alignment: 3 }, status: "open",
    },
    {
      id: "att-022", kind: "risk", title: "Kiln & Clay payment rollback", nextStep: "Arturo to confirm the real failure rate",
      scope: "site:kilnclay", scopeLabel: "Kiln & Clay", owner: "Arturo Ruiz", waitingOn: "other", followUpDue: t(0, 16), due: null,
      sources: [S("slack", "#kilnclay thread", "slack-88410")], evidence: "verified", lastVerified: now - 3 * HOUR,
      factors: { urgency: 4, impact: 4, unblocks: 0, alignment: 3 }, status: "open",
    },
    {
      id: "att-023", kind: "approval", title: "Fernway app store screenshots", nextStep: "Mina to deliver the final set",
      scope: "site:fernway", scopeLabel: "Fernway", owner: "Mina Park", waitingOn: "other", followUpDue: t(3, 12), due: null,
      sources: [S("linear", "FRN-131 New screenshots", "FRN-131")], evidence: "verified", lastVerified: now - 7 * HOUR,
      factors: { urgency: 2, impact: 2, unblocks: 0, alignment: 3 }, status: "open",
    },
    // Already handled
    {
      id: "att-030", kind: "approval", title: "Approve November invoices", nextStep: "Done", scope: null, owner: "Sam", waitingOn: "me", due: t(0, 9),
      sources: [S("gmail", "Invoices ready for approval", "gm-5590")], evidence: "verified", lastVerified: now - 5 * HOUR,
      factors: { impact: 3, unblocks: 3, alignment: 1 }, status: "done", doneAt: now - 3 * HOUR,
    },
    {
      id: "att-031", kind: "reply", title: "Confirm Thursday's call with Dr. Shah", nextStep: "Done", scope: "client:lumen", scopeLabel: "Lumen Dental", owner: "Sam", waitingOn: "me", due: t(0, 11),
      sources: [S("gmail", "Dr. Shah: Thursday still good?", "gm-5601")], evidence: "verified", lastVerified: now - 4 * HOUR,
      factors: { impact: 2, unblocks: 3, alignment: 3 }, status: "done", doneAt: now - 2 * HOUR,
    },
  ];
}

function reels(now: number) {
  const mk = (id: string, site: string, title: string, platform: string, ageH: number, hooks: [number, number, number], buckets: number[], verdict: "PASS" | "HOLD", views: number, extra: any = {}) => {
    const r = rng(hash(id));
    const at = (h: number, f: number) => ageH >= h ? { views: Math.round(views * f), reach: Math.round(views * f * 0.82), retention: Math.round((0.31 + r() * 0.3) * 100) / 100, saves: Math.round(views * f * 0.012), shares: Math.round(views * f * 0.007), comments: Math.round(views * f * 0.004) } : null;
    const names = ["Clarity", "Pacing", "Story", "Proof", "Visuals", "Sound", "Call to action"];
    return {
      id, scope: "site:" + site, site, title, platform, publishedAt: now - ageH * HOUR, url: "#", rubric: "v1.2", reviewer: extra.reviewer || "Kenneth",
      script: { hooks: { spoken: Math.min(5, hooks[0] + (extra.scriptLift || 0)), text: hooks[1], visual: Math.max(1, hooks[2] - 1) }, buckets: names.map((n, i) => ({ name: n, score: Math.max(1, buckets[i] - (i % 3 === 0 ? 1 : 0)) })), verdict: extra.scriptVerdict || "PASS" },
      final: { hooks: { spoken: hooks[0], text: hooks[1], visual: hooks[2] }, buckets: names.map((n, i) => ({ name: n, score: buckets[i] })), verdict },
      rationale: extra.rationale || (verdict === "PASS" ? "The opening lands in the first two seconds and every hook says the same thing." : "The spoken hook starts late and the on-screen text repeats it instead of adding to it."),
      fixes: extra.fixes || (verdict === "PASS" ? [] : ["Start speaking in the first second", "Change the text hook so it adds a number", "Open on the finished result, not the setup"]),
      next: extra.next || (verdict === "PASS" ? "Reuse this opening pattern on the next reel." : "Recut the first five seconds, then score it again."),
      perf: { h24: at(24, 0.46), h72: at(72, 0.78), d7: at(168, 1) },
    };
  };
  return [
    mk("reel-pw-07", "platewise", "The 3 dishes locals actually order", "instagram", 190, [5, 4, 4], [4, 4, 5, 4, 4, 3, 4], "PASS", 48200),
    mk("reel-pw-08", "platewise", "We rated every taco on Main Street", "tiktok", 80, [4, 5, 4], [4, 5, 4, 3, 4, 4, 3], "PASS", 61300),
    mk("reel-pw-09", "platewise", "Why this diner has a 2 hour line", "instagram", 20, [4, 4, 5], [4, 4, 4, 4, 5, 4, 4], "PASS", 22400),
    mk("reel-fw-04", "fernway", "The 2 minute morning habit", "tiktok", 200, [3, 4, 3], [4, 3, 3, 3, 4, 4, 3], "PASS", 15800),
    mk("reel-fw-05", "fernway", "I tracked my water for 30 days", "instagram", 0, [2, 3, 3], [3, 3, 4, 2, 3, 4, 2], "HOLD", 0, { scriptLift: 1 }),
    mk("reel-fw-06", "fernway", "Stop breaking your streak", "tiktok", 0, [3, 2, 4], [3, 2, 3, 3, 4, 3, 3], "HOLD", 0, { rationale: "The text hook is hard to read against the bright background, and the pacing drags in the middle.", fixes: ["Put the text hook on a dark strip", "Cut the middle section by four seconds"] }),
    mk("reel-kc-03", "kilnclay", "Throwing a mug in 40 seconds", "instagram", 100, [4, 3, 5], [4, 4, 3, 3, 5, 4, 3], "PASS", 9700),
    mk("reel-nl-02", "northline", "How to pack a kitchen in one hour", "facebook", 260, [4, 4, 3], [5, 4, 3, 4, 3, 3, 4], "PASS", 6100),
    mk("reel-an-05", "atlasnotes", "One idea from this week's issue", "youtube", 130, [3, 4, 3], [4, 3, 4, 4, 3, 3, 4], "PASS", 4300),
    mk("reel-bd-03", "brightdesk", "Answer tickets twice as fast", "youtube", 50, [4, 4, 4], [4, 4, 3, 5, 4, 3, 4], "PASS", 7900),
  ];
}

function goals(now: number, site0: string) {
  const ci = (d: number, value: number, note: string) => ({ at: now - d * DAY, value, note });
  return [
    {
      id: "obj-1", title: `Launch ${site0} in three new cities`, owner: "Sam", period: "This quarter", top: true,
      krs: [
        { id: "kr-1a", title: "Restaurants listed in the new cities", owner: "Mina Park", unit: "", baseline: 0, target: 600, current: 412, links: ["PLT-190", "PLT-204"], checkins: [ci(21, 180, "Two cities seeded"), ci(14, 265, "Third city started"), ci(7, 340, "Partner import worked"), ci(1, 412, "On pace")] },
        { id: "kr-1b", title: "Weekly visitors from the new cities", owner: "Kenneth", unit: "", baseline: 0, target: 8000, current: 3650, links: ["PLT-212"], checkins: [ci(14, 1200, "Before launch post"), ci(7, 2500, "Organic search picking up"), ci(1, 3650, "Launch post still to come")] },
        { id: "kr-1c", title: "Reviews written by new members", owner: "Kenneth", unit: "", baseline: 0, target: 1500, current: null, links: [], checkins: [] },
      ],
    },
    {
      id: "obj-2", title: "Make every client feel looked after", owner: "Nancy", period: "This quarter",
      krs: [
        { id: "kr-2a", title: "Client replies sent within one working day", owner: "Sam", unit: "%", baseline: 62, target: 95, current: 81, links: [], checkins: [ci(21, 66, ""), ci(14, 74, "Inbox triage started"), ci(7, 79, ""), ci(1, 81, "Two slow replies this week")] },
        { id: "kr-2b", title: "Deliverables approved on the first review", owner: "Nancy", unit: "%", baseline: 48, target: 75, current: 64, links: ["LUM-77"], checkins: [ci(14, 55, ""), ci(1, 64, "")] },
      ],
    },
    {
      id: "obj-3", title: "Grow short video into a steady source of visitors", owner: "Kenneth", period: "This quarter",
      krs: [
        { id: "kr-3a", title: "Reels that pass the scorecard first time", owner: "Kenneth", unit: "%", baseline: 40, target: 80, current: 70, links: [], checkins: [ci(14, 52, ""), ci(7, 63, "Hook-first review added"), ci(1, 70, "")] },
        { id: "kr-3b", title: "Website visits that start from social", owner: "Kenneth", unit: "", baseline: 2100, target: 6000, current: 3900, links: [], checkins: [ci(14, 2700, ""), ci(1, 3900, "")] },
      ],
    },
  ];
}

function metrics(now: number) {
  const m = (id: string, name: string, definition: string, unit: string, scopeLabel: string, period: string, baseline: number | null, current: number | null, target: number | null, targetStatus: string, owner: string, source: string, verifiedH: number | null, state: string, note = "") => {
    const r = rng(hash(id));
    const trend = current == null ? [] : Array.from({ length: 12 }, (_, i) => Math.round(((baseline ?? current * 0.8) + ((current - (baseline ?? current * 0.8)) * i) / 11) * (0.96 + r() * 0.08) * 100) / 100);
    if (trend.length) trend[trend.length - 1] = current as number;
    return { id, name, definition, unit, scopeLabel, period, baseline, current, target, targetStatus, owner, source, lastVerified: verifiedH == null ? null : now - verifiedH * HOUR, state, note, trend };
  };
  return [
    m("m-visitors", "Website visitors", "People who visited any connected website. Counted once per person per day.", "", "All websites", "Last 28 days", 318000, 371400, 400000, "approved", "Kenneth", "Google Analytics", 1, "ok"),
    m("m-leads", "Leads", "Form sign-ups, bookings and enquiries tracked as key events.", "", "All websites", "Last 28 days", 9100, 10840, 12000, "approved", "Kenneth", "Google Analytics", 1, "ok"),
    m("m-reach", "Social reach", "People who saw at least one post, added across networks. One person can be counted on two networks.", "", "All brands", "Last 7 days", 402000, 486000, 550000, "proposed", "Kenneth", "Metricool", 2, "ok"),
    m("m-reply", "Client reply time", "Median working hours between a client message and the first reply.", "h", "All clients", "Last 28 days", 9.5, 5.2, 4, "approved", "Nancy", "Gmail", 6, "ok"),
    m("m-firstpass", "First-pass approvals", "Share of deliverables a client approved at the first review.", "%", "All clients", "This quarter", 48, 64, 75, "approved", "Nancy", "Linear", 20, "ok"),
    m("m-mrr", "Recurring revenue", "Monthly recurring revenue across subscription products.", "$", "Fernway, Brightdesk", "This month", 41200, null, 50000, "proposed", "Sam", "Not connected", null, "missing", "No billing tool is connected yet, so this shows as unknown instead of 0."),
    m("m-checkout", "Checkout completion", "Share of started checkouts that end in a paid order.", "%", "Kiln & Clay", "Last 7 days", 71, 66, 75, "approved", "Arturo Ruiz", "Google Analytics, Slack report", 26, "conflicting", "Analytics says 97% of payments succeed. The team's Slack report says 92%. The numbers need reconciling."),
    m("m-nps", "Client satisfaction", "Average score from the quarterly client survey, out of 10.", "", "All clients", "Last quarter", 8.1, 8.4, 9, "proposed", "Nancy", "Survey sheet", 24 * 52, "stale", "The last survey closed 7 weeks ago. A new one is due."),
  ];
}

function decisions(now: number) {
  return [
    {
      id: "dec-1", question: "Should Fernway add a paid family plan this quarter?", createdAt: now - 6 * DAY, status: "decided", simulated: true,
      advisors: [
        { name: "The Operator", stance: "Not yet", argument: "The team is two people. A family plan means shared billing, invites and support for both. That is six weeks we would take from the streak redesign." },
        { name: "The Customer", stance: "Yes", argument: "Families already share one login. They are asking for separate streaks. Give them a way to pay for what they are already doing." },
        { name: "The Skeptic", stance: "Test first", argument: "We have eleven requests, not eleven hundred. Put a waitlist button in the app for two weeks and count taps before building anything." },
        { name: "The Investor", stance: "Yes, small", argument: "Revenue per household matters more than raw sign-ups at this stage. A simple two-seat plan would show whether it moves." },
      ],
      outcome: "Run a two-week waitlist test before building.", nextActions: ["Add a waitlist button to the plan screen", "Review tap count in two weeks"],
    },
    {
      id: "dec-2", question: "Do we take on a fourth agency client before January?", createdAt: now - 2 * DAY, status: "open", simulated: true,
      advisors: [
        { name: "The Operator", stance: "No", argument: "Reply time only just came under six hours. A fourth client in December pushes it back up while two people are on leave." },
        { name: "The Customer", stance: "Careful", argument: "Existing clients notice when attention drops. Say yes only if the start date is after the holiday campaigns ship." },
        { name: "The Skeptic", stance: "Depends", argument: "What is the client? A good fit at a fair rate is rare. A poor fit is expensive in any month." },
        { name: "The Investor", stance: "Yes", argument: "Agency income funds the product bets. Sign now, start in mid-January, and take a deposit." },
      ],
      outcome: null, nextActions: ["Ask the prospect whether a January 15 start works"],
    },
  ];
}

function clients(now: number, t: (d: number, h?: number) => number) {
  const detail: Record<string, any> = {
    meridian: {
      tasks: [["Landing pages for estate planning", "In progress", "Mina Park", t(5)], ["Advisor photo shoot selects", "Waiting on client", "Elena Marlowe", t(2)], ["Quarterly outlook email", "To do", "Kenneth", t(8)], ["Fee schedule page refresh", "Done", "Mina Park", t(-3)]],
      updates: [["Scope change requested: two extra landing pages", 2], ["Estate planning page is up 38% in visitors this month", 26], ["Photo selects sent for approval", 50]],
      files: [["Brand guidelines v3.pdf", 3], ["Q4 outlook draft.docx", 1], ["Landing page wireframes.fig", 6]],
      meetings: [["Scope review with Elena", t(1, 11)], ["Monthly results call", t(9, 15)]],
    },
    lumen: {
      tasks: [["Homepage fixes", "Ready for review", "Mina Park", t(2)], ["Booking form for Quincy clinic", "In progress", "Arturo Ruiz", t(6)], ["Invisalign campaign page", "To do", "Kenneth", t(12)]],
      updates: [["Homepage fixes are ready for your sign-off", 3], ["Online bookings up 14% since the new form", 30], ["Quincy location page lost some search traffic", 70]],
      files: [["Clinic photos (Quincy).zip", 2], ["Homepage copy v5.docx", 4]],
      meetings: [["Monthly call with Dr. Shah", t(3, 14)]],
    },
    harbor: {
      tasks: [["Holiday gift box campaign", "Waiting on you", "Sam", t(4)], ["Subscription page test", "In progress", "Kenneth", t(7)], ["Wholesale enquiry form", "Done", "Arturo Ruiz", t(-5)]],
      updates: [["Leo asked for holiday campaign dates, twice", 96], ["Gift box page is the top page this week", 20]],
      files: [["Holiday shoot selects", 5], ["Campaign calendar.xlsx", 2]],
      meetings: [["Holiday campaign kickoff", t(5, 10)]],
    },
  };
  return CLIENT_SEEDS.map((c) => ({
    ...c, scope: "client:" + c.id,
    tasks: detail[c.id].tasks.map((x: any, i: number) => ({ id: `${c.id}-t${i}`, title: x[0], status: x[1], owner: x[2], due: x[3] })),
    updates: detail[c.id].updates.map((x: any, i: number) => ({ id: `${c.id}-u${i}`, text: x[0], at: now - x[1] * HOUR })),
    files: detail[c.id].files.map((x: any, i: number) => ({ id: `${c.id}-f${i}`, name: x[0], modified: now - x[1] * DAY })),
    meetings: detail[c.id].meetings.map((x: any, i: number) => ({ id: `${c.id}-m${i}`, title: x[0], start: x[1] })),
  }));
}

function inbox(now: number) {
  const m = (id: string, tool: string, from: string, subject: string, preview: string, ageH: number, needsReply: boolean, scope: string | null, scopeLabel = "") => ({ id, tool, from, subject, preview, at: now - ageH * HOUR, needsReply, scope, scopeLabel });
  return [
    m("in-1", "gmail", "Elena Marlowe", "Revised scope and timeline", "Could we add two more landing pages before the sign-off meeting? Happy to move the date if it helps.", 2, true, "client:meridian", "Meridian Capital"),
    m("in-2", "slack", "Kenneth", "#platewise", "Final cut of the launch post is ready. Can you approve before 5 so I can schedule it tonight?", 1, true, "site:platewise", "Platewise"),
    m("in-3", "gmail", "Leo Martins", "Holiday campaign dates?", "Just checking in again on the dates. We need to brief the roastery by next week.", 96, true, "client:harbor", "Harbor Coffee Co."),
    m("in-4", "slack", "Arturo Ruiz", "#kilnclay", "Seeing more failed payments since Tuesday. Looking into it now, will report back by 4.", 3, false, "site:kilnclay", "Kiln & Clay"),
    m("in-5", "gmail", "Registrar", "Your domain renews in 1 day", "northlinemovers.com will renew automatically using the card on file.", 1.5, false, "site:northline", "Northline Movers"),
    m("in-6", "gmail", "Dr. Priya Shah", "Thursday still good?", "Thanks for confirming. See you Thursday at 2.", 4, false, "client:lumen", "Lumen Dental"),
    m("in-7", "slack", "Nancy", "#ops", "Budget options for Q1 are in the sheet. Three choices, my pick is the middle one.", 5, true, null),
    m("in-8", "gmail", "Mina Park", "Fernway screenshots", "First drafts attached. Final set coming Monday.", 22, false, "site:fernway", "Fernway"),
  ];
}

function events(t: (d: number, h?: number, m?: number) => number) {
  const e = (id: string, title: string, d: number, h: number, mins: number, who: string, scope: string | null, kind = "meeting") => ({ id, title, start: t(d, h), end: t(d, h) + mins * 60000, with: who, scope, kind });
  return [
    e("ev-1", "Weekly priorities with Nancy", 0, 10, 30, "Nancy", null),
    e("ev-2", "Platewise launch check-in", 0, 15, 30, "Kenneth, Mina", "site:platewise"),
    e("ev-3", "Launch post goes live", 0, 19, 0, "", "site:platewise", "deadline"),
    e("ev-4", "Scope review with Elena", 1, 11, 45, "Elena Marlowe", "client:meridian"),
    e("ev-5", "Northline domain renews", 1, 9, 0, "", "site:northline", "deadline"),
    e("ev-6", "Lumen homepage sign-off due", 2, 15, 0, "", "client:lumen", "deadline"),
    e("ev-7", "Monthly call with Dr. Shah", 3, 14, 30, "Dr. Priya Shah", "client:lumen"),
    e("ev-8", "Reel review", 2, 11, 45, "Kenneth", "site:fernway"),
    e("ev-9", "Q1 ad budget decision due", 4, 18, 0, "", null, "deadline"),
    e("ev-10", "Holiday campaign kickoff", 5, 10, 60, "Leo Martins", "client:harbor"),
    e("ev-11", "Deep work block", 1, 14, 120, "", null, "focus"),
    e("ev-12", "Brightdesk pricing review", 4, 11, 45, "Nancy, Arturo", "site:brightdesk"),
  ];
}

function files(now: number) {
  const f = (id: string, name: string, type: string, ageH: number, owner: string, scope: string | null, scopeLabel = "") => ({ id, name, type, modified: now - ageH * HOUR, owner, scope, scopeLabel, url: "#" });
  return [
    f("f-1", "Q1 ad budget options", "sheet", 5, "Nancy", null), f("f-2", "Launch post, final cut", "video", 1, "Kenneth", "site:platewise", "Platewise"),
    f("f-3", "Pricing page test, results", "doc", 8, "Arturo Ruiz", "site:brightdesk", "Brightdesk"), f("f-4", "Revised scope (Meridian)", "doc", 3, "Sam", "client:meridian", "Meridian Capital"),
    f("f-5", "Reel scorecard", "sheet", 9, "Kenneth", null), f("f-6", "Homepage copy v5", "doc", 30, "Mina Park", "client:lumen", "Lumen Dental"),
    f("f-7", "Holiday shoot selects", "folder", 50, "Leo Martins", "client:harbor", "Harbor Coffee Co."), f("f-8", "Podcast name shortlist", "doc", 72, "Sam", "site:atlasnotes", "Atlas Notes"),
    f("f-9", "City launch plan", "slides", 100, "Sam", "site:platewise", "Platewise"), f("f-10", "Brand guidelines v3", "pdf", 150, "Mina Park", "client:meridian", "Meridian Capital"),
  ];
}

function outputs(now: number) {
  const o = (id: string, title: string, task: string, scopeLabel: string, scope: string | null, owner: string, revs: [string, string, number][]) => ({
    id, title, task, scopeLabel, scope, owner,
    revisions: revs.map(([version, state, ageH]) => ({ version, state, at: now - ageH * HOUR })),
  });
  return [
    o("out-1", "Platewise launch post", "PLT-212", "Platewise", "site:platewise", "Kenneth", [["v4", "In review", 1], ["v3", "Changes requested", 26], ["v2", "Changes requested", 50], ["v1", "Draft", 96]]),
    o("out-2", "Meridian revised scope", "MER-58", "Meridian Capital", "client:meridian", "Sam", [["v2", "Draft", 3], ["v1", "Approved", 240]]),
    o("out-3", "Lumen homepage copy", "LUM-77", "Lumen Dental", "client:lumen", "Mina Park", [["v5", "Approved", 30], ["v4", "Changes requested", 80], ["v3", "Draft", 130]]),
    o("out-4", "Q1 ad budget options", "OPS-41", "All businesses", null, "Nancy", [["v1", "In review", 5]]),
    o("out-5", "Weekly results summary", "OPS-12", "All businesses", null, "Nancy", [["Nov 9", "Approved", 96], ["Nov 2", "Approved", 264]]),
    o("out-6", "Brightdesk pricing test report", "BRD-66", "Brightdesk", "site:brightdesk", "Arturo Ruiz", [["v2", "Approved", 8], ["v1", "Draft", 40]]),
    o("out-7", "Holiday campaign calendar", "HBR-31", "Harbor Coffee Co.", "client:harbor", "Kenneth", [["v1", "Draft", 48]]),
  ];
}

const SKILLS = [
  { id: "sk-1", name: "Weekly results summary", purpose: "Turn the week's website and social numbers into a one-page summary in plain words.", inputs: "Date range, which websites", owner: "Nancy", version: "1.3", tools: ["Google Analytics", "Metricool"], permissions: "Read only", example: "Summarise last week for Platewise and Fernway.", status: "Tested" },
  { id: "sk-2", name: "Reel hook review", purpose: "Score the spoken, text and visual hooks of a reel against the scorecard and suggest fixes.", inputs: "Reel link or script", owner: "Kenneth", version: "1.2", tools: ["Scorecard sheet"], permissions: "Read only", example: "Review the opening of 'Stop breaking your streak'.", status: "Tested" },
  { id: "sk-3", name: "Client reply draft", purpose: "Draft a reply to a client email in your tone. You always send it yourself.", inputs: "The email thread", owner: "Sam", version: "0.9", tools: ["Gmail"], permissions: "Read only, drafts stay local", example: "Draft a reply to Elena about the revised scope.", status: "Tested" },
  { id: "sk-4", name: "Decision brief", purpose: "Lay out a decision with options, trade-offs and what each advisor would say.", inputs: "The question, any background", owner: "Sam", version: "1.0", tools: ["Decision Room"], permissions: "None", example: "Should we take a fourth client before January?", status: "Tested" },
  { id: "sk-5", name: "New client setup", purpose: "Walk a new client through About you, Goals and Connect tools, and check each connection.", inputs: "Client name, tools they use", owner: "Nancy", version: "0.4", tools: ["Setup"], permissions: "Client approves each connection", example: "Set up a workspace for a dental practice.", status: "Proposed" },
  { id: "sk-6", name: "Invoice chaser", purpose: "List overdue invoices and draft polite reminders.", inputs: "Billing export", owner: "Nancy", version: "0.1", tools: ["Billing tool"], permissions: "Read only", example: "Who owes us for October?", status: "Unavailable", note: "No billing tool is connected." },
];

function suggestions(now: number) {
  return [
    { id: "sg-1", title: "Confirm the Kiln & Clay brand in Metricool", reason: "Kiln & Clay has no confirmed Metricool brand, so its social numbers are hidden.", benefit: "Social reach for all six websites", effort: "1 minute", owner: "Sam", status: "new", at: now - 5 * HOUR, link: "connections" },
    { id: "sg-2", title: "Give the podcast a goal and a date", reason: "The podcast naming decision has no deadline or goal, so it cannot be ranked properly.", benefit: "One less item stuck in Needs checking", effort: "2 minutes", owner: "Nancy", status: "new", at: now - 20 * HOUR, link: "attention" },
    { id: "sg-3", title: "Connect a billing tool", reason: "Recurring revenue shows as unknown because nothing reports it.", benefit: "A real revenue number on Metrics", effort: "10 minutes", owner: "Sam", status: "new", at: now - 2 * DAY, link: "connections" },
    { id: "sg-4", title: "Raise the weight of 'You unblock'", reason: "In the last 30 days you pinned 6 items above the computed order. Five of them were blocking a teammate.", benefit: "Fewer manual pins", effort: "Nancy reviews the rubric", owner: "Nancy", status: "new", at: now - 3 * DAY, link: "preferences" },
    { id: "sg-5", title: "Run a new client survey", reason: "Client satisfaction was last measured 7 weeks ago.", benefit: "A fresh number instead of a stale one", effort: "30 minutes", owner: "Nancy", status: "accepted", at: now - 6 * DAY, link: "metrics" },
  ];
}

function usage(now: number) {
  const e = (task: string, scopeLabel: string, provider: string, kind: string, tokens: number | null, cost: number | null, estimated: boolean, ageH: number) => ({ id: "u-" + hash(task + provider + ageH), task, scopeLabel, provider, kind, tokens, cost, estimated, at: now - ageH * HOUR });
  return {
    budget: { monthlyExtra: 40, note: "Extra spend on top of your plans. Plans themselves are a fixed monthly price." },
    plans: [{ provider: "Claude Code", plan: "Max", monthly: 100, status: "Connected" }, { provider: "Codex", plan: "Plus", monthly: 20, status: "Not connected" }],
    entries: [
      e("Morning greeting and summaries", "All businesses", "Claude Code", "plan", 41200, 0, false, 2),
      e("Decision Room: fourth client", "All businesses", "Claude Code", "plan", 18400, 0, false, 48),
      e("Weekly results summary", "All businesses", "Claude Code", "plan", 26900, 0, false, 96),
      e("Reel hook review (3 reels)", "Fernway", "Claude Code", "plan", 22100, 0, false, 30),
      e("Client reply drafts", "Meridian Capital", "Claude Code", "plan", 9800, 0, false, 5),
      e("Bulk caption rewrite", "Platewise", "Claude API", "api", 310000, 6.4, false, 120),
      e("Image alt text batch", "Kiln & Clay", "Claude API", "api", 96000, 2.1, true, 200),
      e("Transcript clean-up", "Atlas Notes", "Codex", "plan", null, null, false, 150),
    ],
  };
}

function connections(now: number, sitesList: any[]) {
  return [
    { id: "google-analytics", tool: "analytics", name: "Google Analytics", status: "connected", account: "sam@example.com", detail: `${sitesList.length} websites found`, lastSync: now - 12 * 60000, auth: "google", gives: "Your website list, visitors, leads and top pages" },
    { id: "metricool", tool: "metricool", name: "Metricool", status: "connected", account: "Advanced plan", detail: `${sitesList.filter((s) => s.metricoolBrand.confirmed).length} of ${sitesList.length} brands confirmed`, lastSync: now - 18 * 60000, auth: "token", gives: "Followers, reach, posts and reels for each website" },
    { id: "gmail", tool: "gmail", name: "Gmail", status: "connected", account: "sam@example.com", detail: "Reads subject lines and senders to find replies you owe", lastSync: now - 6 * 60000, auth: "google", gives: "Emails that need a reply" },
    { id: "calendar", tool: "calendar", name: "Google Calendar", status: "connected", account: "sam@example.com", detail: "Read only", lastSync: now - 6 * 60000, auth: "google", gives: "Meetings and deadlines" },
    { id: "drive", tool: "drive", name: "Google Drive", status: "connected", account: "sam@example.com", detail: "Read only, recent files", lastSync: now - 30 * 60000, auth: "google", gives: "Recent files and finished documents" },
    { id: "linear", tool: "linear", name: "Linear", status: "connected", account: "Sample workspace", detail: "Read only", lastSync: now - 9 * 60000, auth: "oauth", gives: "Tasks, approvals and goals links" },
    { id: "slack", tool: "slack", name: "Slack", status: "error", account: "Sample workspace", detail: "Sign-in expired 2 days ago. Sign in again to resume.", lastSync: now - 2 * DAY, auth: "oauth", gives: "Messages that mention you" },
    { id: "sheets", tool: "sheets", name: "Reel scorecard sheet", status: "manual", account: "Uploaded file", detail: "Updated by hand. Last import 9 hours ago.", lastSync: now - 9 * HOUR, auth: "file", gives: "Reel scores and PASS or HOLD" },
    { id: "billing", tool: "billing", name: "Billing tool", status: "off", account: "", detail: "Not connected", lastSync: null, auth: "token", gives: "Recurring revenue" },
  ];
}

export interface TemplateOptions { id: string; name: string; owner: string; accent?: string; kind?: "owner" | "client"; sites?: SiteSeed[]; rich?: boolean; empty?: boolean }

/** The tools a real (non-sample) workspace can connect in this version. Nothing is connected until the person does it. */
export function realConnections() {
  const c = (id: string, tool: string, name: string, auth: string, gives: string, extra: any = {}) => ({ id, tool, name, status: "off", account: "", detail: "Not connected", lastSync: null, auth, gives, ...extra });
  return [
    c("google-analytics", "analytics", "Google Analytics", "google", "Your website list, visitors, leads and top pages"),
    c("metricool", "metricool", "Metricool", "token", "Followers, reach and posts for each website"),
    c("gmail", "gmail", "Gmail", "google", "Emails that need a reply"),
    c("calendar", "calendar", "Google Calendar", "google", "Meetings and deadlines"),
    c("drive", "drive", "Google Drive", "google", "Recent files"),
    c("linear", "linear", "Linear", "token", "Tasks assigned to you, with their deadlines"),
    c("slack", "slack", "Slack", "soon", "Messages that mention you", { detail: "Not available in this version yet" }),
    c("sheets", "sheets", "Reel scorecard sheet", "soon", "Reel scores and PASS or HOLD", { detail: "Not available in this version yet" }),
  ];
}

/** An empty workspace for someone's real data. It holds no examples at all: every page starts empty until a tool is connected. */
function emptyWorkspace(opts: TemplateOptions, now: number) {
  return {
    id: opts.id, name: opts.name, owner: opts.owner, kind: opts.kind || "owner", sample: false, createdAt: now, templateVersion: "1.0",
    brand: { name: opts.name, accent: opts.accent || "blue" },
    modules: Object.fromEntries(MODULES.map((m) => [m.id, !["clients", "reels", "calendar", "outputs", "skills", "suggestions", "usage"].includes(m.id)])),
    rubric: JSON.parse(JSON.stringify(DEFAULT_RUBRIC)),
    setup: { done: false, about: { name: opts.owner, role: "", business: opts.name }, goals: [] as string[], step: 0 },
    sites: [] as any[], clients: [] as any[], items: [] as AttentionItem[], reels: [] as any[], goals: [] as any[], metrics: [] as any[], decisions: [] as any[],
    inbox: [] as any[], events: [] as any[], files: [] as any[], outputs: [] as any[], skills: [] as any[], suggestions: [] as any[],
    usage: { budget: { monthlyExtra: 0, note: "Extra spend on top of your plans." }, plans: [] as any[], entries: [] as any[] },
    connections: realConnections(), overrides: [] as any[], ai: { provider: "auto" }, lastSync: null as number | null,
  };
}

/** Build one workspace from the shared template. Config and safe examples only: no credentials, nothing copied from another workspace. */
export function makeWorkspace(opts: TemplateOptions, now: number) {
  if (opts.empty) return emptyWorkspace(opts, now) as any;
  const sod = startOfDay(now);
  const t = (d: number, h = 17, m = 0) => sod + d * DAY + h * HOUR + m * 60000;
  const siteList = sites(opts.sites || MAIN_SITES);
  const rich = opts.rich !== false && !opts.sites;
  let items = attention(now, t);
  let reelList = reels(now), clientList = clients(now, t), inboxList = inbox(now), eventList = events(t), fileList = files(now), outputList = outputs(now);
  if (!rich) {
    // A smaller, generic set for a new workspace, written around its own websites.
    const s0 = siteList[0], s1 = siteList[1] || siteList[0];
    const S = (tool: string, label: string) => ({ tool, label, url: "#" });
    items = [
      { id: "att-101", kind: "approval", title: `Approve this week's ${s0.name} post`, nextStep: "Read the draft and approve or send notes", scope: "site:" + s0.id, scopeLabel: s0.name, owner: opts.owner, waitingOn: "me", due: t(0, 17), consequence: "The post misses this week's slot.", sources: [S("gmail", "Draft for approval")], evidence: "verified", lastVerified: now - HOUR, factors: { impact: 3, unblocks: 4, alignment: 3 }, status: "open" },
      { id: "att-102", kind: "decision", title: `Pick next month's focus for ${s1.name}`, nextStep: "Choose one of the two options", scope: "site:" + s1.id, scopeLabel: s1.name, owner: opts.owner, waitingOn: "me", due: t(5, 12), consequence: "Planning for next month starts late.", sources: [S("drive", "Options for next month")], evidence: "verified", lastVerified: now - 4 * HOUR, factors: { impact: 4, unblocks: 3, alignment: 5 }, status: "open" },
      { id: "att-103", kind: "reply", title: "Reply to the agency about results", nextStep: "Send your two questions", scope: null, owner: opts.owner, waitingOn: "me", due: t(2, 12), consequence: "The monthly call has no agenda.", sources: [S("gmail", "Monthly results")], evidence: "verified", lastVerified: now - 2 * HOUR, factors: { impact: 2, unblocks: 3, alignment: 3 }, status: "open" },
      { id: "att-104", kind: "approval", title: "New photos from the agency", nextStep: "Agency to send the final set", scope: null, owner: "Agency", waitingOn: "other", followUpDue: t(2, 12), sources: [S("gmail", "Photo shoot")], evidence: "verified", lastVerified: now - 6 * HOUR, factors: { urgency: 2, impact: 2, unblocks: 0, alignment: 3 }, status: "open" },
    ] as AttentionItem[];
    reelList = reelList.slice(0, 3).map((r, i) => ({ ...r, id: `reel-${opts.id}-${i}`, site: s0.id, scope: "site:" + s0.id }));
    clientList = []; inboxList = inboxList.slice(0, 0); fileList = []; outputList = [];
    eventList = eventList.filter((e) => !e.scope).map((e) => ({ ...e }));
  }
  // Examples in a new workspace only ever mention that workspace's own names.
  const own = <T,>(v: T): T => {
    if (rich) return v;
    let j = JSON.stringify(v);
    for (const n of ["Platewise and Fernway", "Fernway, Brightdesk", "Platewise", "Fernway", "Brightdesk", "Kiln & Clay", "Atlas Notes", "Northline Movers", "Meridian Capital", "Lumen Dental", "Harbor Coffee Co."]) j = j.split(n).join(siteList[0].name);
    for (const n of ["Elena Marlowe", "Elena", "Kenneth", "Mina Park", "Nancy", "Arturo Ruiz", "Dr. Shah"]) j = j.split(n).join("Your team");
    j = j.split('"Sam"').join(JSON.stringify(opts.owner)).split("PLT-").join("TASK-").split("LUM-").join("TASK-");
    return JSON.parse(j);
  };
  return {
    id: opts.id, name: opts.name, owner: opts.owner, kind: opts.kind || "owner", sample: true, createdAt: now, templateVersion: "1.0",
    brand: { name: opts.name, accent: opts.accent || "blue" },
    modules: Object.fromEntries(MODULES.map((m) => [m.id, m.id === "calendar" ? false : opts.kind === "client" ? m.id !== "clients" : true])),
    rubric: JSON.parse(JSON.stringify(DEFAULT_RUBRIC)),
    setup: { done: rich, about: { name: opts.owner, role: rich ? "Founder" : "", business: opts.name }, goals: rich ? ["Launch Platewise in three new cities", "Make every client feel looked after"] : [], step: 0 },
    sites: siteList, clients: clientList, items, reels: reelList,
    goals: own(goals(now, siteList[0].name)), metrics: own(metrics(now)), decisions: rich ? decisions(now) : [],
    inbox: inboxList, events: eventList, files: fileList, outputs: outputList,
    skills: own(JSON.parse(JSON.stringify(SKILLS))), suggestions: rich ? suggestions(now) : [], usage: own(usage(now)),
    connections: connections(now, siteList), overrides: [] as any[], ai: { provider: "auto" },
  };
}

export function makeState(now = Date.now()) {
  const main = makeWorkspace({ id: "main", name: "Sam's businesses", owner: "Sam", accent: "blue" }, now);
  const clientA = makeWorkspace({ id: "sample-meridian", name: "Meridian Capital", owner: "Elena", accent: "indigo", kind: "client", sites: [
    { id: "meridian-main", name: "Meridian Capital", domain: "meridiancapital.example", kind: "Wealth advisory", color: "#B8892B", base: 780, growth: 0.18, leadRate: 0.031, networks: ["linkedin", "x"] },
    { id: "meridian-insights", name: "Meridian Insights", domain: "insights.meridiancapital.example", kind: "Research blog", color: "#5B6CFF", base: 420, growth: 0.3, leadRate: 0.02, networks: ["linkedin"] },
  ] }, now);
  const clientB = makeWorkspace({ id: "sample-lumen", name: "Lumen Dental", owner: "Priya", accent: "teal", kind: "client", sites: [
    { id: "lumen-main", name: "Lumen Dental", domain: "lumendental.example", kind: "Dental clinics", color: "#17A27C", base: 1150, growth: 0.09, leadRate: 0.062, networks: ["instagram", "facebook"] },
  ] }, now);
  return { version: 1, createdAt: now, active: "main", theme: "system", workspaces: { [main.id]: main, [clientA.id]: clientA, [clientB.id]: clientB } as Record<string, any> };
}

export { NETWORK_BASE };

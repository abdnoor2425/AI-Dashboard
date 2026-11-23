import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { handle } from "../lib/api.ts";
import { makeState } from "../lib/sample.ts";
import { keyProblem, major, monthly, shapeMoney } from "../lib/server/stripe.ts";
import { applyNotes, fallbackSum, keepNotes, notesPrompt, parseHn, parseRss, pick } from "../lib/server/news.ts";
import { cwdIn, listFiles, openMade, otherRoots, readPicture, scanMade, typeOf } from "../lib/server/made.ts";
import { engagement } from "../lib/server/google.ts";

const now = Date.parse("2026-11-17T10:00:00Z"), DAY = 864e5, HOUR = 36e5;

/** A new owner's own workspace: nothing connected, nothing made up. */
function fresh() {
  const state: any = makeState(now);
  const call = (method: string, p: string, body?: any) => handle(state, { method, path: "/api/" + p, body, now });
  call("POST", "firstrun/start"); call("POST", "firstrun/profile", { name: "Dana Reyes", role: "Founder", business: "Reyes Studio" }); call("POST", "firstrun/finish");
  return { state, call, ws: state.workspaces[state.active] };
}

test("a new workspace shows every page as not connected, with no invented numbers", () => {
  const { call, ws } = fresh();
  assert.equal(ws.sample, false);
  const d = call("GET", "ui").data;
  assert.equal(d.me.first, "Dana");
  assert.equal(d.ga.state, "off"); assert.equal(d.ga.sites.length, 0);
  assert.equal(d.money.state, "off");
  assert.equal(d.news.state, "off"); assert.equal(d.news.stories.length, 0);
  assert.equal(d.made.state, "off"); assert.equal(d.made.total, 0);
  assert.equal(d.goals.state, "empty");
  assert.equal(d.needs.total, 0);
  assert.equal(d.clients.on.length, 0);
  // The one square that can speak without a tool says something true: nothing is waiting.
  assert.deepEqual(d.brief.squares.filter((s: any) => !s.off).map((s: any) => [s.k, s.v]), [["Needs you", "All clear"]]);
  assert.ok(ws.connections.some((c: any) => c.id === "stripe" && c.auth === "token" && c.status === "off"));
});

test("goals: three levels, three on each, and a goal can feed the level above", () => {
  const { call, ws } = fresh();
  assert.equal(call("POST", "plan/save", { level: "year", title: "Grow" }).status, 400);
  assert.equal(call("POST", "plan/save", { level: "quarter", title: "x" }).status, 400);
  for (const t of ["Reach 40k a month", "Sign four clients", "Launch the dashboard"]) assert.equal(call("POST", "plan/save", { level: "quarter", title: t, progress: 40 }).status, 200);
  assert.equal(call("POST", "plan/save", { level: "quarter", title: "A fourth goal" }).status, 400);
  const q = ws.plan.goals[0];
  call("POST", "plan/save", { level: "month", title: "Close two proposals", progress: 150, feeds: q.id });
  const m = ws.plan.goals.find((g: any) => g.level === "month");
  assert.equal(m.progress, 100); assert.equal(m.feeds, q.id);
  // A week goal cannot feed a quarter goal directly: the link is dropped rather than kept wrong.
  call("POST", "plan/save", { level: "week", title: "Send the proposal", feeds: q.id });
  assert.equal(ws.plan.goals.find((g: any) => g.level === "week").feeds, "");
  call("POST", "plan/save", { id: m.id, level: "month", title: "Close three proposals", progress: 20, feeds: q.id });
  assert.equal(ws.plan.goals.filter((g: any) => g.level === "month").length, 1);
  const view = call("GET", "ui").data.goals;
  assert.equal(view.state, "ok"); assert.equal(view.total, 5);
  assert.equal(view.levels[1].items[0][2], "Feeds: Reach 40k a month");
  call("POST", "plan/remove", { id: q.id });
  assert.equal(ws.plan.goals.find((g: any) => g.id === m.id).feeds, "");
});

test("goals: a Today level, and steps drafted under a goal feed it without overwriting anything", () => {
  const { call, ws } = fresh();
  call("POST", "plan/save", { level: "week", title: "Send six proposals" });
  const w = ws.plan.goals[0];
  assert.equal(call("POST", "plan/save", { level: "day", title: "Finish two proposals", feeds: w.id }).status, 200);
  assert.equal(ws.plan.goals.find((g: any) => g.level === "day").feeds, w.id);
  const view = call("GET", "ui").data.goals;
  assert.deepEqual(view.levels.map((l: any) => l.k), ["Quarter", "Month", "Week", "Today"]);
  assert.equal(view.levels[3].items[0][2], "Feeds: Send six proposals");
  // Drafting fills only the free places on the level below.
  const d = call("POST", "plan/draft", { id: w.id, titles: ["1. Call the two warm leads", "- Write the pricing page", "Book the review", "A fourth"] });
  assert.equal(d.status, 200); assert.equal(d.data.added, 2); assert.equal(d.data.level, "day"); assert.equal(d.data.byAi, true);
  const today = ws.plan.goals.filter((g: any) => g.level === "day");
  assert.deepEqual(today.map((g: any) => g.title), ["Finish two proposals", "Call the two warm leads", "Write the pricing page"]);
  assert.ok(today.slice(1).every((g: any) => g.feeds === w.id && g.progress === 0));
  assert.equal(call("POST", "plan/draft", { id: w.id }).status, 400, "the level below is full");
  assert.equal(call("POST", "plan/draft", { id: today[0].id }).status, 400, "nothing sits below today");
  // Without AI titles a plain starter set is used.
  call("POST", "plan/save", { level: "quarter", title: "Grow revenue by a fifth" });
  const q = ws.plan.goals.find((g: any) => g.level === "quarter");
  const s = call("POST", "plan/draft", { id: q.id });
  assert.equal(s.data.added, 3); assert.equal(s.data.byAi, false);
  assert.ok(ws.plan.goals.filter((g: any) => g.level === "month").every((g: any) => g.feeds === q.id));
});

test("news topics: up to three, your own can be added, never none", () => {
  const { call, ws } = fresh();
  assert.equal(call("POST", "news/topics", { topics: [] }).status, 400);
  assert.deepEqual(call("POST", "news/topics", { topics: ["video", "agents", "models", "voice", "nope"] }).data.topics, ["video", "agents", "models"]);
  const r = call("POST", "news/topics", { topics: ["video"], add: "  AI for   dentists " }).data.topics;
  assert.equal(r.length, 2); assert.ok(r[1].startsWith("~"));
  assert.equal(ws.news.custom[0][1], "AI for dentists");
  assert.ok(call("GET", "ui").data.news.all.some((t: any) => t[1] === "AI for dentists"));
});

test("clients are suggested from names the tools already hold, and connect in one step", () => {
  const { call, ws } = fresh();
  ws.money = { currency: "usd", when: now, daily: [], payments: [], customers: [{ name: "Northline Movers", paid: 4000 }, { name: "Reyes Studio", paid: 10 }] };
  ws.made = { when: now, items: [], roots: [{ name: "Northline Movers", ai: "Claude Code" }, { name: "Scratch", ai: "Codex" }] };
  assert.equal(call("POST", "clients/scan").data.found, 1);
  const f = ws.found.names[0];
  assert.equal(f.name, "Northline Movers");
  assert.match(f.why, /paying customer in Stripe/);
  assert.equal(call("POST", "clients/connect", { name: "N" }).status, 400);
  const id = call("POST", "clients/connect", { name: "Northline Movers", src: f.src }).data.id;
  assert.equal(call("POST", "clients/connect", { name: "northline movers" }).status, 400);
  assert.equal(call("GET", "ui").data.clients.on[0].n, "Northline Movers");
  assert.equal(call("POST", "clients/remove", { id }).status, 200);
  assert.equal(ws.clients.length, 0);
});

test("Stripe: only a restricted key is accepted", () => {
  assert.match(keyProblem("sk_live_abcdefghijklmnop") || "", /full secret key/);
  assert.match(keyProblem("pk_live_abcdefghijklmnop") || "", /publishable/);
  assert.ok(keyProblem("hello"));
  assert.equal(keyProblem(" rk_live_abcdefghijklmnop12 "), null);
  assert.equal(major(1250, "usd"), 12.5); assert.equal(major(1250, "jpy"), 1250);
});

test("Stripe: charges become daily totals, failed payments, customers, recurring money and the next payout", () => {
  const at = (d: number, h = 9) => Math.floor((now - d * DAY + h * HOUR - 10 * HOUR) / 1000);
  const ch = (id: string, d: number, amount: number, name: string, extra: any = {}) => ({ id, created: at(d), amount, currency: "usd", status: "succeeded", paid: true, amount_refunded: 0, customer: { name }, description: "Retainer", payment_intent: "pi_" + id, ...extra });
  const charges = [
    ch("a", 1, 240000, "Northline Movers"), ch("b", 1, 60000, "Lumen Dental", { amount_refunded: 10000 }), ch("c", 40, 120000, "Northline Movers"),
    ch("d", 2, 80000, "Harbor Coffee", { status: "failed", paid: false, failure_message: "Your card was declined." }),
    ch("e", 5, 50000, "Atlas Notes", { status: "failed", paid: false, payment_intent: "pi_x" }), ch("f", 4, 50000, "Atlas Notes", { payment_intent: "pi_x" }),
    ch("g", 3, 999, "Euro Client", { currency: "eur" }),
  ];
  const subs = [
    { status: "active", currency: "usd", items: { data: [{ quantity: 2, price: { unit_amount: 50000, currency: "usd", recurring: { interval: "month", interval_count: 1 } } }] } },
    { status: "active", currency: "usd", items: { data: [{ quantity: 1, price: { unit_amount: 1200000, currency: "usd", recurring: { interval: "year", interval_count: 1 } } }] } },
    { status: "canceled", currency: "usd", items: { data: [{ quantity: 1, price: { unit_amount: 900000, currency: "usd", recurring: { interval: "month", interval_count: 1 } } }] } },
  ];
  assert.equal(monthly(subs[1]), 1000);
  const payouts = [{ status: "paid", currency: "usd", amount: 1, arrival_date: at(3) }, { status: "in_transit", currency: "usd", amount: 612000, arrival_date: at(-2) }];
  const m = shapeMoney(charges, subs, payouts, now);
  assert.equal(m.currency, "usd");
  assert.equal(m.daily.reduce((a, d) => a + d.gross, 0), 2400 + 500 + 1200 + 500);
  assert.equal(m.customers[0].name, "Northline Movers"); assert.equal(m.customers[0].paid, 3600);
  const failed = m.payments.filter((p) => p.status === "failed");
  assert.equal(failed.length, 2);
  assert.equal(failed.find((p) => p.customer === "Harbor Coffee")!.recovered, false);
  assert.equal(failed.find((p) => p.customer === "Atlas Notes")!.recovered, true);
  assert.equal(m.mrr, 2000); assert.equal(m.subs, 2);
  assert.equal(m.payout!.amount, 6120);
  assert.ok(!m.payments.some((p) => p.customer === "Euro Client"));

  // The money page reads exactly this record.
  const { call, ws } = fresh();
  ws.money = m; ws.connections.find((c: any) => c.id === "stripe").status = "connected";
  const v = call("GET", "ui").data.money;
  assert.equal(v.state, "ok"); assert.equal(v.sym, "$");
  assert.equal(v.failed.length, 1); assert.equal(v.failedTotal, 800);
  assert.equal(v.mrr, 2000);
  assert.equal(v.months.length, 12);
});

test("news feeds: Google News, Bing News and Hacker News are read into the same story shape", () => {
  const pub = new Date(now - 3 * HOUR).toUTCString();
  const google = `<rss><channel><item><title>Agents can now book meetings &amp; confirm them - The Verge</title><link>https://news.google.com/rss/articles/abc</link><pubDate>${pub}</pubDate><description>&lt;a href="x"&gt;Agents can now book meetings &amp;amp; confirm them&lt;/a&gt;&amp;nbsp;The Verge</description><source url="https://www.theverge.com">The Verge</source></item><item><title>No link</title></item></channel></rss>`;
  const g = parseRss(google, "agents", "Google News");
  assert.equal(g.length, 1);
  assert.equal(g[0].head, "Agents can now book meetings & confirm them"); assert.equal(g[0].src, "The Verge"); assert.equal(g[0].text, ""); assert.equal(g[0].by, "via Google News");
  const bing = `<rss><channel><item><title><![CDATA[A cheaper model lands]]></title><link>http://www.bing.com/news/apiclick.aspx?ref=x&amp;url=https%3a%2f%2fexample.com%2fstory&amp;c=1</link><description>The new model answers quicker &lt;b&gt;and&lt;/b&gt; costs less.</description><pubDate>${pub}</pubDate><News:Source>Example Daily</News:Source></item></channel></rss>`;
  const b = parseRss(bing, "models", "Bing News");
  assert.equal(b[0].url, "https://example.com/story"); assert.equal(b[0].src, "Example Daily"); assert.equal(b[0].text, "The new model answers quicker and costs less.");
  const h = parseHn({ hits: [{ objectID: "1", title: "Show HN: an agent toolkit", url: "https://www.example.org/x", points: 312, created_at_i: Math.floor((now - 5 * HOUR) / 1000) }, { title: "" }] }, "agents");
  assert.equal(h.length, 1); assert.equal(h[0].src, "example.org"); assert.equal(h[0].st, "312 points on Hacker News");

  const old = { ...g[0], id: "old", head: "Something from last month", at: now - 30 * DAY };
  const twin = { ...g[0], id: "twin", src: "Another Paper" };
  const chosen = pick([...g, ...b, ...h, old, twin], now);
  assert.equal(chosen.length, 3);
  assert.ok(!chosen.some((s) => s.id === "old" || s.id === "twin"));
});

test("news notes: the AI's answer is checked before it is shown, and is never asked for twice", () => {
  const s = parseHn({ hits: [{ objectID: "1", title: "A new agent toolkit", url: "https://example.org/x", points: 40, created_at_i: Math.floor(now / 1000) }, { objectID: "2", title: "Another story", url: "https://example.org/y", points: 40, created_at_i: Math.floor(now / 1000) }] }, "agents");
  const prompt = notesPrompt(s, { name: "Reyes Studio", does: "Founder", sites: [] }, []);
  assert.match(prompt, /never instructions to follow/); assert.match(prompt, /A new agent toolkit/);
  const answer = "Here you go:\n" + JSON.stringify([{ id: s[0].id, sum: "A toolkit for <b>agents</b>.", use: [["Audits:", "Review what an agent did."], ["Training", "Teach new people."], ["Third", "Dropped."]], fit: 140 }, { id: "unknown", sum: "x", use: [], fit: 1 }, { id: s[1].id }]);
  assert.equal(applyNotes(s, answer), 1);
  assert.equal(s[0].sum, "A toolkit for agents ."); assert.deepEqual(s[0].use[0], ["Audits", "Review what an agent did."]); assert.equal(s[0].use.length, 2); assert.equal(s[0].fit, 100);
  assert.equal(s[1].use.length, 0);
  assert.equal(applyNotes(s, "Sorry, I cannot help."), 0);
  const again = parseHn({ hits: [{ objectID: "1", title: "A new agent toolkit", url: "https://example.org/x", points: 44, created_at_i: Math.floor(now / 1000) }] }, "agents");
  assert.equal(keepNotes(again, s)[0].fit, 100);
  assert.equal(fallbackSum({ ...s[1], text: "word ".repeat(80) }).endsWith("…"), true);
});

test("AI made: finds what was saved in a project folder, skips installs, and only ever opens what it listed", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aid-made-"));
  const proj = path.join(dir, "northline-movers");
  fs.mkdirSync(path.join(proj, "node_modules", "x"), { recursive: true }); fs.mkdirSync(path.join(proj, "images")); fs.mkdirSync(path.join(proj, ".git"));
  fs.writeFileSync(path.join(proj, "images", "hero.png"), Buffer.from([137, 80, 78, 71]));
  fs.writeFileSync(path.join(proj, "plan.md"), "# Plan"); fs.writeFileSync(path.join(proj, "run.bat"), "echo"); fs.writeFileSync(path.join(proj, "package-lock.json"), "{}");
  fs.writeFileSync(path.join(proj, "node_modules", "x", "index.js"), "x"); fs.writeFileSync(path.join(proj, "old.md"), "old");
  const t = Date.now(); fs.utimesSync(path.join(proj, "old.md"), new Date(t - 30 * DAY), new Date(t - 30 * DAY));
  assert.equal(typeOf("a.PNG"), "image"); assert.equal(typeOf("a.exe"), "");
  assert.deepEqual(listFiles(proj, t - 14 * DAY).map((f) => path.basename(f.path)).sort(), ["hero.png", "plan.md"]);
  const made = scanMade(t, [{ dir: proj, ai: "Claude Code", at: t }]);
  assert.equal(made.items.length, 2); assert.equal(made.roots[0].name, "northline movers"); assert.equal(made.items[0].ai, "Claude Code");
  const pic = made.items.find((x: any) => x.type === "image");
  assert.equal(readPicture(made, pic.id)!.type, "image/png");
  assert.equal(readPicture(made, made.items.find((x: any) => x.type === "doc").id), null);
  assert.equal(readPicture(made, "m-not-listed"), null);
  await assert.rejects(() => openMade(made, "m-not-listed", "file"), /no longer in the list/);
  assert.equal(cwdIn('{"type":"x","cwd":"C:\\\\Users\\\\dana\\\\site","v":1}'), "C:\\Users\\dana\\site");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("Google Analytics: engagement and time on site come with the 28 days before", () => {
  const row = (tag: string, v: number[]) => ({ dimensionValues: [{ value: tag }], metricValues: v.map((x) => ({ value: String(x) })) });
  const e = engagement({ rows: [row("date_range_1", [0.5, 60, 900]), row("date_range_0", [0.62, 95.5, 1200])] })!;
  assert.equal(e.engagement.rate, 0.62); assert.equal(e.engagement.prev, 0.5); assert.equal(e.time.sec, 95.5);
  assert.equal(engagement({ rows: [] }), null);
  assert.equal(engagement({ rows: [row("date_range_0", [0, 0, 0])] }), null);
});

test("Hermes, Grok and Muse Code: the project folder comes from their own records, and their saved media is picked up", () => {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), "aid-other-ai-"));
  const now = Date.now(), since = now - 14 * 86400000;
  const proj = path.join(h, "work", "launch-site");
  fs.mkdirSync(proj, { recursive: true });
  fs.mkdirSync(path.join(h, ".hermes", "sessions"), { recursive: true });
  fs.mkdirSync(path.join(h, ".hermes", "cache", "scratch"), { recursive: true });
  fs.mkdirSync(path.join(h, ".muse", "sessions", "a"), { recursive: true });
  fs.mkdirSync(path.join(h, ".grok", "outputs"), { recursive: true });
  fs.writeFileSync(path.join(h, ".hermes", "sessions", "s1.jsonl"), JSON.stringify({ role: "system", working_directory: proj, text: "private words" }) + "\n");
  fs.writeFileSync(path.join(h, ".muse", "sessions", "a", "state.json"), JSON.stringify({ workspaceRoot: proj }));
  fs.writeFileSync(path.join(h, ".hermes", "cache", "scratch", "chart.png"), "png");
  const roots = otherRoots(since, h);
  const has = (ai: string, dir: string) => roots.some((r) => r.ai === ai && r.dir === dir);
  assert.ok(has("Hermes", proj) && has("Muse Code", proj));
  assert.ok(has("Hermes", path.join(h, ".hermes", "cache", "scratch")) && has("Grok", path.join(h, ".grok", "outputs")));
  const made = scanMade(now, roots.filter((r) => r.ai === "Hermes"));
  assert.deepEqual(made.items.map((x: any) => [x.title, x.type, x.ai]), [["chart.png", "image", "Hermes"]]);
  assert.ok(!JSON.stringify(roots).includes("private words"));
  fs.rmSync(h, { recursive: true, force: true });
});

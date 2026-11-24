import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// A pretend computer with a pretend AI app, so a whole council can run without any real AI.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-dashboard-room-"));
const home = path.join(root, "home"), bin = path.join(root, "bin"), keystone = path.join(root, "keystone");
fs.mkdirSync(home); fs.mkdirSync(bin); fs.mkdirSync(keystone);
process.env.HOME = home; process.env.USERPROFILE = home; process.env.KEYSTONE_HOME = keystone;
process.env.PATH = bin + path.delimiter + path.dirname(process.execPath) + path.delimiter + "/usr/bin" + path.delimiter + "/bin";
// The pretend AI reads the prompt it is handed and answers in the form each step asks for. The Attention seat never answers properly.
fs.writeFileSync(path.join(bin, "fake-ai.mjs"), `
let p = ""; process.stdin.on("data", (d) => (p += d)); process.stdin.on("end", () => {
  const out = (o) => console.log("Here you go:\\n" + JSON.stringify(o));
  const file = (p.match(/F(\\d+)\\. Pricing research/) || [])[1];
  if (p.includes("Prepare the brief")) return out({ title: "Should we raise the price?", intent: "Earn more from each customer without losing the ones who pay today.",
    needs: [{ what: "What comes in each month", from: "E1" }, { what: "How revenue moved lately", from: "M1" }, { what: "What customers say about price", from: file ? "F" + file : "" }], stake: "Revenue is {E1} and a ghost number is {E99}.", kind: "pricing", one_way: false,
    options: [{ title: "Raise for all", detail: "Everyone pays more." }, { title: "Raise for new", detail: "Only new customers pay more." }, { title: "Change nothing", detail: "Leave it." }],
    questions: p.includes("QUESTION: Should we change the subscription price") ? [] : [{ q: "Is the date fixed?", choices: ["Yes", "No"] }], depth: "full", depth_why: "It touches income.", more: ["M1"], files: file ? [file] : [], keywords: ["price"], seat_why: { cu: "Customers feel it first." } });
  if (p.includes("You read documents")) return out({ notes: [{ id: (p.match(/--- (E\\d+):/) || [])[1], value: "9 of 10", covers: "10 calls", note: "Nine of ten callers said the price is fair.", points: ["Two callers asked for a yearly plan.", "Nobody named a rival."] }] });
  if (p.includes("This is round 1")) { if (p.includes("You hold The Attention seat")) return console.log("I would rather not say."); return out({ stance: "For B", scores: p.includes("You hold The Capital seat") ? [3, 6, 7] : [4, 8, 5], say: "New customers have never seen the old price. Revenue is {E1}, or so says {E77}.", ask: "" }); }
  if (p.includes("Find where the seats truly disagree")) return out({ cruxes: [{ a: "cu", b: "cp", q: "Do today's customers ever pay more?" }, { a: "cu", b: "zz", q: "Not a real seat" }], answer: { seat: "cp", fact: "E1", say: "Stripe says {E1}." } });
  if (p.includes("This is round 2")) return out({ say: "I can live with it if the promise is written down." });
  if (p.includes("Write the resolution")) return out({ draft: "Raise the price for new customers on 1 January.", settled: ["Not before July."] });
  if (p.includes("This is the final vote")) return out({ scores: p.includes("You hold The Capital seat") ? [3, 6, 6] : [4, 8, 5], line: "Yes.", ruin: "no", sure: 4 });
  if (p.includes("Write the verdict")) return out({ answer: "Yes. Raise it for new customers only.", example: "A caller who signs up in January pays the new price. {E2} of the callers said that is fair.", call: "Raise the price for new customers on 1 January.", why: [{ head: "The market pays more.", text: "Revenue is {E1}." }, { head: "Callers agree.", text: "{E2} said so." }, { head: "It is easy to undo.", text: "Only new customers are touched." }],
    money: "About {E1} a month is at stake.", next: [{ step: "Write the note", owner: "Kim", days: 3 }, { step: "Change the page", owner: "Nobody", days: 9 }, { step: "Add the price", owner: "Dana", days: 20 }],
    conditions: ["Tell customers first."], stops: [{ text: "Cancellations pass 4% in a month.", fact: "E1" }], again_days: 500, again: "Did new customers still sign up?", minority: { seat: "cp", quote: "A healthy business does not need to hurry." }, change: ["A rival cuts its price."], decisive: ["E1", "E50"] });
  if (p.includes("short notes that go with the answer")) return out({ short: "Price rise", words: [{ word: "Plan", means: "What a customer pays for each month." }, { word: "Seat", means: "dup" }], options: [{ best: "Most money.", risk: "People leave." }, { best: "Safe.", risk: "Two prices." }, { best: "Nothing breaks.", risk: "Money is left behind." }], wont: "It will not fix churn." });
  console.log("{}");
});`);
fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\nexec node "${path.join(bin, "fake-ai.mjs")}"\n`, { mode: 0o755 });

const R = await import("../lib/room.ts");
const room = await import("../lib/server/room.ts");
const { reportHtml, decisionMd } = await import("../lib/room-report.ts");
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

const seats = (weights: number[]) => weights.map((weight, i) => ({ key: R.ROSTER[i].key, weight, why: "" }));
const votes = (list: number[][]) => Object.fromEntries(list.map((scores, i) => [R.ROSTER[i].key, { scores, ruin: "no", sure: 4 }]));

test("scores match the sums in roast-room's three example sessions", () => {
  const examples: [string, number][] = [["(2x2 + 1x3 + 3x4 + 1x3 + 2x4 + 1x3 + 2x3) / 12", 3.3], ["(2x3 + 1x3 + 1x4 + 2x2 + 1x3) / 7", 2.9], ["(2x3 + 1x3 + 3x2 + 1x3 + 2x2 + 1x3 + 2x4) / 12", 2.8], ["(2x3 + 1x4 + 1x3 + 2x5 + 1x4) / 7", 3.9],
    ["(2x3 + 1x4 + 3x4 + 1x3 + 2x5 + 1x5 + 2x4) / 12", 4.0], ["(2x4 + 1x3 + 3x2 + 1x4 + 2x2 + 1x3 + 2x4) / 12", 3.0], ["(2x8 + 1x8 + 1x8 + 2x8 + 1x8) / 7", 8.0], ["(2x8 + 1x8 + 3x8 + 1x8 + 2x8 + 1x8 + 2x8) / 12", 8.0],
    ["(3x3 + 3x3 + 2x4 + 2x2) / 10", 3.0], ["(3x3 + 3x4 + 2x5 + 2x6) / 10", 4.3], ["(3x3 + 3x4 + 2x5 + 2x7) / 10", 4.5], ["(3x4 + 3x3 + 2x4 + 2x3) / 10", 3.5], ["(3x7 + 3x7 + 2x7 + 2x5) / 10", 6.6], ["(3x7 + 3x7 + 2x7 + 2x6) / 10", 6.8]];
  for (const [sum, want] of examples) {
    const pairs = [...sum.matchAll(/(\d)x(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const got = R.optionScore(seats(pairs.map((p) => p[0])), Object.fromEntries(pairs.map((p, i) => [R.ROSTER[i].key, [p[1]]])), 0);
    assert.equal(got, want, sum);
  }
  assert.equal(R.bandOf(8.0), "go"); assert.equal(R.bandOf(6.8), "cond"); assert.equal(R.bandOf(4.5), "reshape"); assert.equal(R.bandOf(4.4), "no");
});

test("the verdict is capped by a ruin risk, by a one-way door, and becomes Wait when doing nothing wins", () => {
  const board = seats([3, 2, 1]);
  const clear = R.tally(board, votes([[9, 3, 2], [8, 3, 2], [8, 4, 2]]), 3);
  assert.equal(clear.rec, 0); assert.equal(clear.band, "go"); assert.equal(clear.score, 8.5); assert.equal(clear.agree, 3); assert.equal(clear.confWord, "high");
  const ruin = votes([[9, 3, 2], [8, 3, 2], [8, 4, 2]]); (ruin.dm as any).ruin = "likely";
  assert.equal(R.tally(board, ruin, 3).band, "reshape");
  (ruin.dm as any).ruin = "unlikely";
  assert.equal(R.tally(board, ruin, 3).band, "go");
  const split = votes([[10, 3, 2], [9, 3, 2], [5, 4, 2]]);
  assert.equal(R.tally(board, split, 3, { oneWay: false }).band, "go");
  const capped = R.tally(board, split, 3, { oneWay: true });
  assert.equal(capped.band, "cond"); assert.equal(capped.spread, 5); assert.equal(capped.caps.length, 1);
  assert.equal(R.tally(board, votes([[3, 4, 8], [3, 4, 8], [3, 4, 7]]), 3, { statusQuo: 2 }).band, "wait");
  // A seat that never voted is left out of the sum instead of counting as zero.
  assert.equal(R.tally(board, { cu: { scores: [6, 1, 1] }, dm: undefined, of: { scores: [8, 1, 1] } }, 3).score, 6.5);
});

test("each kind of decision seats seven, and a Quick council keeps the heaviest seats and the downside guard", () => {
  for (const kind of Object.keys(R.KINDS)) {
    const full = R.pickBoard(kind, "full"), quick = R.pickBoard(kind, "quick");
    assert.equal(full.seats.length, 7, kind); assert.equal(full.bench.length, 5, kind);
    assert.ok(full.seats.every((s) => s.weight >= 1 && s.weight <= 3 && R.seatOf(s.key)));
    assert.equal(quick.seats.length, 4, kind); assert.ok(quick.seats.some((s) => s.key === "cp"), kind);
    assert.equal(new Set([...quick.seats.map((s) => s.key), ...quick.bench]).size, 12, kind);
  }
  assert.equal(R.callsFor("full", 7, false), 23); assert.equal(R.callsFor("quick", 4, true), 13);
});

test("a source code is kept only when that fact exists and is switched on", () => {
  const pack: any[] = [{ id: "E1", on: true, value: "$10" }, { id: "E2", on: false, value: "7%" }];
  const r = R.checkCites("Revenue is {E1}. Churn is {E2}, visits (E1) and a ghost {E9|about 40}.", pack);
  assert.equal(r.text, "Revenue is {E1}. Churn is an unconfirmed figure, visits {E1} and a ghost about 40.");
  assert.deepEqual(r.cites, ["E1"]); assert.equal(r.dropped, 2);
  assert.equal(R.plainCites(r.text, pack), "Revenue is $10. Churn is an unconfirmed figure, visits $10 and a ghost about 40.");
  assert.deepEqual(R.parseJson('Sure!\n```json\n{"a": [1, 2,], "b": "x"}\n```'), { a: [1, 2], b: "x" });
  assert.equal(R.parseJson("no json here"), null);
});

test("the dashboard's own facts come only from what is connected, and say what is missing", () => {
  const none = R.coreFacts({ money: { state: "off" }, ga: { state: "off" }, needs: {}, goals: { state: "off" }, clients: { on: [] } }, [], 0);
  assert.equal(none.core.length, 0); assert.equal(none.gaps.length, 3);
  const some = R.coreFacts({ money: { state: "ok", sym: "$", when: "5 minutes ago", monthName: "May", prevName: "April", total: 1200, delta: -8, mrr: 900, subs: 3, failed: [], months: [["Feb", 1], ["Mar", 2], ["Apr", 3], ["May", 4]], top: [{ name: "Acme", paid: 500, share: 40 }] }, ga: { state: "off" }, needs: { total: 2, today: 1, waiting: 1 }, goals: { state: "off" }, clients: { on: [] } }, [{ owner: "Kim", due: 5 }, { owner: "Kim", due: null }], 10);
  assert.deepEqual(some.core.map((f) => f.value), ["$1,200", "$900", "2"]);
  assert.match(some.core[0].note, /8% behind April/); assert.equal(some.core[0].age, "5 min");
  assert.ok(some.menu.some((f) => f.src === "linear" && /Kim 2\. 1 past/.test(f.note)));
});

/** A zip with one stored entry, enough to stand in for a Word file. */
function tinyZip(name: string, text: string) {
  const data = Buffer.from(text), n = Buffer.from(name), local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(n.length, 28);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + n.length, 12); end.writeUInt32LE(30 + n.length + data.length, 16);
  return Buffer.concat([local, n, data, central, n, end]);
}

test("an attached file is read as plain words, and files that look like secrets are refused", async () => {
  const docx = tinyZip("word/document.xml", "<w:document><w:p><w:r><w:t>Nine of ten callers said the price is fair &amp; simple.</w:t></w:r></w:p><w:p><w:r><w:t>Second line.</w:t></w:r></w:p></w:document>");
  assert.equal((await room.textOf("Call notes.docx", docx)).text, "Nine of ten callers said the price is fair & simple.\nSecond line.");
  const ws: any = { id: "attach-test" };
  await assert.rejects(room.attachFile(ws, "passwords.txt", Buffer.from("a long enough text to read here").toString("base64")), /passwords or keys/);
  await assert.rejects(room.attachFile(ws, "run.exe", "AAAA"), /can't be read/);
  await assert.rejects(room.attachFile(ws, "empty.txt", Buffer.from("hi").toString("base64")), /No words/);
  const item = await room.attachFile(ws, "../../Call notes.docx", docx.toString("base64"));
  assert.equal(item.name, "Call notes.docx"); assert.equal(item.words, 13); assert.equal(ws.room.attach.length, 1);
  room.dropAttach(ws, item.id);
  assert.equal(ws.room.attach.length, 0);
});

const until = async (id: string, want: string[]) => {
  for (let i = 0; i < 300; i++) { const s = room.readSession("t", id); if (want.includes(s.status)) return s; if (s.status === "failed") throw new Error(s.error); await new Promise((r) => setTimeout(r, 50)); }
  throw new Error("The council did not reach " + want.join(" or ") + ": " + room.readSession("t", id).status);
};

test("a whole council runs on the owner's AI: brief, evidence, three rounds, a counted vote and a report", { skip: process.platform === "win32" }, async () => {
  const ws: any = { id: "t", name: "Test Co", owner: "Dana Reyes", team: [{ name: "Dana Reyes" }, { name: "Kim Lee" }], items: [], inbox: [], setup: { about: { name: "Dana Reyes" } } };
  const u = { money: { state: "ok", sym: "$", when: "just now", monthName: "May", prevName: "April", total: 1200, delta: 4, mrr: 0, failed: [], months: [["Feb", 1], ["Mar", 2], ["Apr", 3], ["May", 4]] }, ga: { state: "off" }, needs: {}, goals: { state: "off" }, clients: { on: [] } };
  const used: string[] = [];
  const ctx = { ws, u, team: [], usage: (task: string) => used.push(task) };
  await room.attachFile(ws, "Call notes.txt", Buffer.from("Nine of ten callers said the price is fair. One asked for a discount.").toString("base64"));
  await assert.rejects(room.startSession(ctx, { q: "Too short", ai: "Claude Code" }, Date.now()), /full sentence/);
  await assert.rejects(room.startSession(ctx, { q: "Should we raise the price in January?", ai: "Codex" }, Date.now()), /Pick which AI/);
  const { id } = await room.startSession(ctx, { q: "Should we raise the price in January?", ai: "Claude Code", mode: "auto" }, Date.now());
  assert.equal(ws.room.attach.length, 0, "the attached file moves into the decision");

  let s = await until(id, ["brief"]);
  assert.equal(s.brief.kindLabel, "a pricing decision"); assert.equal(s.seats.length, 7); assert.equal(s.seats[0].why, "Customers feel it first.");
  assert.equal(s.brief.stake, "Revenue is {E1} and a ghost number is an unconfirmed figure.");
  assert.deepEqual(s.pack.map((f: any) => [f.id, f.src, f.pass]), [["E1", "stripe", 0], ["E2", "att", 0], ["E3", "stripe", 1]]);
  // The owner answers the Chair, swaps a seat, then switches the numbers off: the facts stay listed but are no longer shared.
  room.editSession(s, { answer: [0, 1], swap: [3, "lv"] });
  assert.equal(s.seats[3].key, "lv"); assert.ok(s.bench.includes("at"));
  room.editSession(s, { swap: [3, "at"], access: { num: false } });
  assert.deepEqual(s.pack.map((f: any) => f.on), [false, true, false]);
  room.editSession(s, { access: { num: true } });

  room.gather(s, ctx);
  s = await until(id, ["ready"]);
  assert.equal(s.pack[1].value, "9 of 10"); assert.match(s.pack[1].note, /Nine of ten/); assert.equal(s.calls.total, 24);
  room.run(s, ctx);
  assert.throws(() => room.editSession(s, { mode: "quick" }), /already started/);

  await until(id, ["done"]);
  // The verdict is shown as soon as it is counted. The background pages of the report follow a moment later.
  for (let i = 0; i < 200 && !fs.existsSync(path.join(room.sessionFolder(room.readSession("t", id)), "report.html")); i++) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 100));
  s = room.readSession("t", id);
  assert.deepEqual(s.out, ["at"], "a seat that fails twice sits out");
  assert.equal(Object.keys(s.r3).length, 6);
  assert.equal(s.cruxes.length, 1, "a disagreement that names a seat that is not sitting is dropped");
  assert.equal(s.r2.length, 2); assert.equal(s.answer.fact, "E1");
  // cu 3, dm 2, of 3, ti 1, op 2 vote 8 and cp 3 votes 6 on option B: (11 x 8 + 3 x 6) / 14 = 7.6
  assert.equal(s.result.rec, 1); assert.equal(s.result.score, 7.6); assert.equal(s.result.band, "go"); assert.equal(s.result.voted, 6);
  assert.ok(s.checks.dropped >= 6, "codes that point at nothing are removed"); assert.ok(!JSON.stringify([s.r1, s.verdict]).includes("E77"));
  assert.deepEqual(s.verdict.next.map((n: any) => n.owner), ["Kim", "Dana", "Dana"], "a step can only belong to someone on the team");
  assert.deepEqual(s.verdict.decisive, ["E1"]); assert.equal(s.verdict.minority.score, 6);
  assert.equal(Math.round((s.verdict.again.on - Date.now()) / 86400000), 120, "the look-again date is kept within four months");
  assert.deepEqual(s.report.words.map((w: any) => w.word), ["Plan"]);
  assert.equal(s.calls.done, s.calls.total); assert.equal(used.length, 2);
  assert.deepEqual(s.events.map((e: any) => e.t).filter((t: string, i: number, a: string[]) => a.indexOf(t) === i).sort(), ["crux", "data", "draft", "end", "open", "out", "r1", "r2", "vote"]);

  const dir = room.sessionFolder(s);
  const html = fs.readFileSync(path.join(dir, "report.html"), "utf8");
  // A Full council: the answer, the choices compared, the references. Page one holds the whole decision.
  assert.equal(html.split('<section class="pg').length - 1, 3);
  const one = html.split('<section class="pg')[1];
  for (const part of ["Yes. Raise it for new customers only.", "Go · 7.6 of 10 · 6 seats", "<h3>Why</h3>", "<h3>An example</h3>", "<h3>Do this</h3>", "Stop and think again if", "Who disagreed"]) assert.ok(one.includes(part), part);
  // References are numbered in the order the reader meets them, and the list at the end uses the same numbers.
  assert.match(one, /\$1,200<sup class="c">1<\/sup>/); assert.match(one, /9 of 10<sup class="c">2<\/sup>/);
  assert.match(html, /<td class="k">2<\/td><td><b>Call notes\.txt:<\/b> 9 of 10/);
  assert.match(html, /The Attention seat did not answer and sat out/);
  assert.ok(!/Page \d of \d|E1<\/span>/.test(html), "no fixed page count and no internal codes on the page");
  // The same answer as a plain file for an AI.
  const md = fs.readFileSync(path.join(dir, "decision.md"), "utf8");
  for (const part of ["answer: Yes. Raise it for new customers only.", "verdict: go", "score: 7.6 of 10", "- [ ] Write the note (owner: Kim, due: ", "1. The market pays more. Revenue is $1,200 [1].", "[2] Attached by you | Call notes.txt: 9 of 10", "## Stop and think again if"]) assert.ok(md.includes(part), part);
  assert.equal(room.latestDecision("t").text, md); assert.equal(room.latestDecision("nobody").found, false);
  const log = fs.readFileSync(path.join(dir, "shared-log.jsonl"), "utf8").trim().split("\n");
  assert.ok(log.length >= s.calls.done); assert.ok(!log.join("").includes("passwords"));
  const view = room.viewSession(s, Date.now());
  assert.equal(view.pack[1].text, undefined, "the screens are not sent the text of a file"); assert.equal(view.pack[1].words, 14);
  const homePage = await room.roomHome(ws, { needs: { rows: [] } }, Date.now());
  assert.equal(homePage.hist.length, 1); assert.equal(homePage.hist[0].label, "Go"); assert.equal(homePage.open, null); assert.equal(homePage.ais[0].found, true); assert.equal(homePage.ais[3].found, false);
  room.checkin(s, "worked");
  assert.equal((await room.roomHome(ws, { needs: { rows: [] } }, Date.now() + 200 * 86400000)).stats.worked, 1);
});

test("the report never lets text from the AI or a file become markup", () => {
  const s: any = { id: "x", at: 0, q: "<b>Q</b>", owner: "Dana", biz: "Test <Co>", ai: "Claude Code", mode: "quick", seats: seats([3, 2]), out: [], gaps: [], shared: {}, checks: {},
    brief: { title: "<script>alert(1)</script>", stake: "", options: [{ title: "A<i>", detail: "" }, { title: "B", detail: "" }, { title: "C", detail: "" }] },
    pack: [{ id: "E1", src: "stripe", what: "<img src=x>", value: "<u>9</u>", period: "", age: "Live", note: "", on: true, pass: 0 }],
    r1: { cu: { say: "{E1}" }, dm: { say: "" } }, r2: [], cruxes: [], draft: { text: "Do <it>", lead: 0 }, r3: votes([[8, 2, 2], [7, 2, 2]]),
    result: R.tally(seats([3, 2]), votes([[8, 2, 2], [7, 2, 2]]), 3),
    verdict: { call: "Call {E1} <b>", why: [], money: "", next: [], conditions: [], stops: [], again: { on: 0, text: "<x>" }, minority: { seat: "dm", quote: "<q>", score: 7 }, change: [], decisive: ["E1"] } };
  const html = reportHtml(s);
  for (const bad of ["<script>alert", "<img src=x>", "<u>9</u>", "<b>Q</b>", "Do <it>", "<q>", "<x>"]) assert.ok(!html.includes(bad), bad);
  assert.match(html, /&lt;u&gt;9&lt;\/u&gt;<sup class="c">1<\/sup>/);
  // A Quick council with no example is two pages: the answer and the references. Nothing is padded out.
  assert.equal(html.split('<section class="pg').length - 1, 2); assert.ok(!html.includes("An example"));
  const md = decisionMd(s);
  for (const bad of ["{E1}", "undefined", "NaN"]) assert.ok(!md.includes(bad), bad);
  assert.match(md, /answer: Go, as planned\./);
});

test("the owner can choose who sits, and a council started from the one screen carries on by itself", { skip: process.platform === "win32" }, async () => {
  assert.equal(R.guessKind("Should I raise the price from $49 to $69?"), "pricing"); assert.equal(R.guessKind("Hire a second editor or keep freelancers?"), "hiring"); assert.equal(R.guessKind("What now?"), "other");
  const first = room.suggestBoard("Should I raise the price from $49 to $69?");
  assert.equal(first.seats.length, 7); assert.equal(first.weights.cu, 3);
  // Chosen seats keep the weight their kind of decision gives them. A seat that kind does not name counts as 2.
  const own = R.ownBoard("pricing", ["cu", "cp", "br", "cu", "nope"])!;
  assert.deepEqual(own.seats.map((x) => [x.key, x.weight]), [["cu", 3], ["cp", 3], ["br", 2]]); assert.equal(own.bench.length, 9);
  assert.equal(R.ownBoard("pricing", ["cu", "cp"]), null, "two seats is no debate");
  assert.equal(R.ownBoard("pricing", R.ROSTER.map((x) => x.key))!.seats.length, 9, "never more than nine");

  const ws: any = { id: "auto", name: "Test Co", owner: "Dana Reyes", team: [{ name: "Dana Reyes" }, { name: "Kim Lee" }], items: [], inbox: [], setup: { about: { name: "Dana Reyes" } } };
  const u = { money: { state: "ok", sym: "$", when: "just now", monthName: "May", prevName: "April", total: 1200, delta: 4, mrr: 0, failed: [], months: [["Feb", 1], ["Mar", 2], ["Apr", 3], ["May", 4]] }, ga: { state: "off" }, needs: {}, goals: { state: "off" }, clients: { on: [] } };
  const ctx = { ws, u, team: [] };
  await assert.rejects(room.startSession(ctx, { q: "Should we raise the price in January?", ai: "Claude Code", seats: ["cu", "cp"] }, Date.now()), /at least 3 seats/);
  const { id } = await room.startSession(ctx, { q: "Should we raise the price in January?", ai: "Claude Code", mode: "auto", auto: true, seats: ["cu", "of", "cp", "br"] }, Date.now());
  const wait = async (want: string) => { for (let i = 0; i < 300; i++) { const s = room.readSession("auto", id); if (s.status === want) return s; if (s.status === "failed") throw new Error(s.error); await new Promise((r) => setTimeout(r, 50)); } throw new Error("never reached " + want); };
  // The pretend Chair asks one question, so the council waits for the owner there, with the owner's seats in place.
  let s = await wait("brief");
  assert.deepEqual(s.seats.map((x: any) => [x.key, x.weight]), [["cu", 3], ["of", 3], ["cp", 3], ["br", 2]]);
  room.editSession(s, { answer: [0, 0], mode: "quick" });
  assert.equal(s.seats.length, 4, "a change of depth never undoes the owner's own choice of seats");
  // After the answer, one step starts it and it runs to the end without another click.
  room.gather(s, ctx);
  s = await wait("done");
  assert.equal(s.result.voted, 4); assert.equal(s.verdict.answer, "Yes. Raise it for new customers only.");
});

test("a price question gets all of Stripe and the website, and the brief says what the owner is after", () => {
  const u = { money: { state: "ok", sym: "$", when: "just now", monthName: "May", prevName: "April", total: 1200, delta: 4, mrr: 980, subs: 20, failed: [], months: [["Feb", 1], ["Mar", 2], ["Apr", 3], ["May", 4]], pace: 2400, top: [{ name: "Acme", paid: 500, share: 40 }], recent: [["Acme", "Pro plan · 2 May", "$49"]] },
    ga: { state: "ok", when: "just now", sites: [{ name: "platewise.test", v: Array(56).fill(100), l: Array(56).fill(2), src: [{ name: "Google", n: 60, share: 0.6 }, { name: "Direct", n: 40, share: 0.4 }], pages: [{ path: "/pricing", n: 900 }, { path: "/", n: 700 }] }] },
    needs: {}, goals: { state: "off" }, clients: { on: [{ n: "Acme", need: true }] } };
  const social = { file: "metricool.csv", at: 0, brands: { main: [{ name: "Instagram", followers: 1200, followersDelta: 30, reach: 9000, reachPrev: 8000 }] } };
  const { menu } = R.coreFacts(u, [{ owner: "Kim", due: null }], 86400000, social);
  const by = (what: string) => menu.find((f) => f.what === what)!;
  assert.equal(by("Average paid by one subscription each month").value, "$49");
  assert.match(by("Latest payments").note, /Acme \$49 \(Pro plan\)/);
  assert.equal(by("Leads from the websites").value, "56"); assert.equal(by("Visitors who become a lead").value, "2%");
  assert.match(by("Top source of visitors to platewise.test").note, /Google 60%, Direct 40%/);
  assert.match(by("Most visited page on platewise.test").note, /\/pricing 900/);
  assert.equal(by("Followers on social").value, "1,200"); assert.match(by("Reach on social").note, /Instagram 9,000\. From metricool\.csv/);
  // The Chair picked nothing, and still every Stripe, website and client number is in. Team tasks and social stay out of a price question.
  const got = R.moreFor("pricing", menu, []);
  assert.deepEqual([...new Set(got.map((f) => f.src))].sort(), ["clients", "ga", "stripe"]);
  assert.equal(got.filter((f) => f.src === "stripe").length, menu.filter((f) => f.src === "stripe").length);
  // What the Chair asked for comes first and is never pushed out by the cap.
  const team = menu.find((f) => f.src === "linear")!;
  assert.equal(R.moreFor("pricing", menu, [team])[0], team); assert.ok(R.moreFor("marketing", menu, []).some((f) => f.src === "social"));
  assert.ok(R.moreFor("pricing", Array.from({ length: 40 }, () => ({ src: "stripe" })), []).length <= R.MORE_MAX); assert.deepEqual(R.moreFor("other", menu, []), []);
  // Every seat is told what the owner is after and what is missing.
  const prompt = R.openingPrompt(R.ROSTER[0], { title: "Raise the price?", asked: "should i charge more", intent: "Earn more from each customer.", missing: ["Churn after the last change"], stake: "", options: [{ title: "A", detail: "" }, { title: "B", detail: "" }, { title: "C", detail: "" }], answers: [] }, []);
  for (const part of ["IN THE OWNER'S OWN WORDS: should i charge more", "WHAT THE OWNER IS REALLY AFTER: Earn more from each customer.", "NOT IN THE EVIDENCE (say so rather than guess): Churn after the last change."]) assert.ok(prompt.includes(part), part);
});

test("the council asks before it reads a closed file, reads it once allowed, and says what it could not find", { skip: process.platform === "win32" }, async () => {
  const { changeBrain } = await import("../lib/server/brain.ts");
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(process.cwd()), "keystone-room-test-"));
  test.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.mkdirSync(path.join(temp, "Research"));
  fs.writeFileSync(path.join(temp, "Research", "Pricing research.txt"), "We asked ten customers about the price. Eight said 69 dollars a month is fair. Two would leave.");
  const ws: any = { id: "files", name: "Test Co", owner: "Dana Reyes", team: [{ name: "Dana Reyes" }], items: [], inbox: [], setup: { about: { name: "Dana Reyes" } } };
  changeBrain("files", { action: "connect", path: path.join(temp, "Research") });
  const u = { money: { state: "ok", sym: "$", when: "just now", monthName: "May", prevName: "April", total: 1200, delta: 4, mrr: 980, subs: 20, failed: [], months: [["Feb", 1], ["Mar", 2], ["Apr", 3], ["May", 4]] }, ga: { state: "off" }, needs: {}, goals: { state: "off" }, clients: { on: [] } };
  const ctx = { ws, u, team: [] };
  const wait = async (id: string, want: string) => { for (let i = 0; i < 300; i++) { const s = room.readSession("files", id); if (s.status === want) return s; if (s.status === "failed") throw new Error(s.error); await new Promise((r) => setTimeout(r, 50)); } throw new Error("never reached " + want); };
  const { id } = await room.startSession(ctx, { q: "Should we change the subscription price this spring?", ai: "Claude Code", mode: "quick", auto: true }, Date.now());
  // The Chair has no question for the owner, but it wants a file in a folder that is switched off. So it stops and asks.
  let s = await wait(id, "brief");
  await new Promise((r) => setTimeout(r, 150));
  s = room.readSession("files", id);
  assert.equal(s.status, "brief", "it did not carry on without asking"); assert.equal(s.brief.questions.length, 0); assert.equal(s.held, true);
  assert.equal(s.brief.intent, "Earn more from each customer without losing the ones who pay today.");
  const doc = s.pack.find((f: any) => f.src === "file");
  assert.equal(doc.what, "Pricing research.txt"); assert.equal(doc.on, false);
  // Stripe is read in full for a price question: the months the Chair asked for, and the average subscription it did not ask for.
  assert.ok(s.pack.some((f: any) => f.what === "Average paid by one subscription each month" && f.value === "$49"));
  assert.deepEqual(s.brief.needs.map((n: any) => !!n.ref), [true, true, true]); assert.equal(s.brief.needs[2].ref, doc.id);
  room.editSession(s, { allowFiles: true });
  room.gather(s, ctx);
  s = await wait(id, "done");
  const read = s.pack.find((f: any) => f.src === "file");
  assert.equal(read.on, true); assert.match(read.text, /Eight said 69 dollars/); assert.deepEqual(read.points, ["Two callers asked for a yearly plan.", "Nobody named a rival."]);
  // Each seat was told the goal behind the question, and got the key points of the file with its words.
  const logDir = fs.readdirSync(path.join(keystone, "room")).map((d) => path.join(keystone, "room", d, id)).find((d) => fs.existsSync(d))!;
  const sent = fs.readFileSync(path.join(logDir, "shared-log.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const opening = sent.find((x) => x.sent.includes("This is round 1")).sent;
  for (const part of ["WHAT THE OWNER IS REALLY AFTER: Earn more from each customer", "Key points: Two callers asked for a yearly plan. | Nobody named a rival.", "Eight said 69 dollars"]) assert.ok(opening.includes(part), part);
  assert.ok(!opening.includes("NOT IN THE EVIDENCE"), "nothing it needed was missing once the file was allowed");
  assert.match(decisionMd(s), /intent: Earn more from each customer/); assert.match(reportHtml(s), /What you are after: Earn more from each customer/);
  // Without the folder, the same question has a need nothing covers. The council carries on by itself and says so.
  const bare: any = { ...ws, id: "bare" };
  const two = await room.startSession({ ws: bare, u, team: [] }, { q: "Should we change the subscription price this spring?", ai: "Claude Code", mode: "quick", auto: true }, Date.now());
  let b: any; for (let i = 0; i < 300 && (b = room.readSession("bare", two.id)).status !== "done"; i++) { if (b.status === "failed") throw new Error(b.error); await new Promise((r) => setTimeout(r, 50)); }
  assert.equal(b.status, "done"); assert.equal(b.held, false); assert.equal(b.brief.needs[2].ref, null);
  assert.ok(b.gaps.includes("What customers say about price. Nothing connected covers it."));
});

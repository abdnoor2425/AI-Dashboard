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
  if (p.includes("Prepare the brief")) return out({ title: "Should we raise the price?", stake: "Revenue is {E1} and a ghost number is {E99}.", kind: "pricing", one_way: false,
    options: [{ title: "Raise for all", detail: "Everyone pays more." }, { title: "Raise for new", detail: "Only new customers pay more." }, { title: "Change nothing", detail: "Leave it." }],
    questions: [{ q: "Is the date fixed?", choices: ["Yes", "No"] }], depth: "full", depth_why: "It touches income.", more: ["M1"], files: [], keywords: ["price"], seat_why: { cu: "Customers feel it first." } });
  if (p.includes("You read documents")) return out({ notes: [{ id: (p.match(/--- (E\\d+):/) || [])[1], value: "9 of 10", covers: "10 calls", note: "Nine of ten callers said the price is fair." }] });
  if (p.includes("This is round 1")) { if (p.includes("You hold The Attention seat")) return console.log("I would rather not say."); return out({ stance: "For B", scores: p.includes("You hold The Capital seat") ? [3, 6, 7] : [4, 8, 5], say: "New customers have never seen the old price. Revenue is {E1}, or so says {E77}.", ask: "" }); }
  if (p.includes("Find where the seats truly disagree")) return out({ cruxes: [{ a: "cu", b: "cp", q: "Do today's customers ever pay more?" }, { a: "cu", b: "zz", q: "Not a real seat" }], answer: { seat: "cp", fact: "E1", say: "Stripe says {E1}." } });
  if (p.includes("This is round 2")) return out({ say: "I can live with it if the promise is written down." });
  if (p.includes("Write the resolution")) return out({ draft: "Raise the price for new customers on 1 January.", settled: ["Not before July."] });
  if (p.includes("This is the final vote")) return out({ scores: p.includes("You hold The Capital seat") ? [3, 6, 6] : [4, 8, 5], line: "Yes.", ruin: "no", sure: 4 });
  if (p.includes("Write the verdict")) return out({ call: "Raise the price for new customers on 1 January.", why: [{ head: "The market pays more.", text: "Revenue is {E1}." }, { head: "Callers agree.", text: "{E2} said so." }, { head: "It is easy to undo.", text: "Only new customers are touched." }],
    money: "About {E1} a month is at stake.", next: [{ step: "Write the note", owner: "Kim", days: 3 }, { step: "Change the page", owner: "Nobody", days: 9 }, { step: "Add the price", owner: "Dana", days: 20 }],
    conditions: ["Tell customers first."], stops: [{ text: "Cancellations pass 4% in a month.", fact: "E1" }], again_days: 500, again: "Did new customers still sign up?", minority: { seat: "cp", quote: "A healthy business does not need to hurry." }, change: ["A rival cuts its price."], decisive: ["E1", "E50"] });
  if (p.includes("background pages")) return out({ short: "Price rise", business: ["Test Co sells one plan. Revenue is {E1}."], led: "Rivals charge more.", words: [{ word: "Plan", means: "What a customer pays for each month." }, { word: "Seat", means: "dup" }], options: [{ best: "Most money.", risk: "People leave." }, { best: "Safe.", risk: "Two prices." }, { best: "Nothing breaks.", risk: "Money is left behind." }], wont: "It will not fix churn." });
  console.log("{}");
});`);
fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\nexec node "${path.join(bin, "fake-ai.mjs")}"\n`, { mode: 0o755 });

const R = await import("../lib/room.ts");
const room = await import("../lib/server/room.ts");
const { reportHtml } = await import("../lib/room-report.ts");
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
  assert.equal(html.split('<section class="pg').length - 1, 8); assert.match(html, /Go, <em>as planned\.<\/em>/); assert.match(html, /\$1,200<span class="c">E1<\/span>/);
  assert.match(html, /The Attention seat did not answer and sat out/);
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
  assert.match(html, /&lt;u&gt;9&lt;\/u&gt;<span class="c">E1<\/span>/);
});

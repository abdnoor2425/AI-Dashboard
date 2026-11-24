// Decision Room: the part that touches the disk and the AI.
// Each decision has its own folder under .keystone/room/<workspace>/<id>/ with the session, the report and a log of what was shared.
// The council runs step by step. The owner's AI app only ever answers one prompt at a time, and every answer is checked by code.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import zlib from "node:zlib";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { HOME } from "./store.ts";
import * as ai from "./ai.ts";
import { brainFilePath, getBrain } from "./brain.ts";
import * as R from "../room.ts";
import { decisionMd, reportHtml } from "../room-report.ts";

const DAY = 86400000;
const safe = (v: string) => createHash("sha256").update(String(v)).digest("hex").slice(0, 16);
const roomDir = (wsId: string, home = HOME) => path.join(home, "room", safe(wsId));
const dirOf = (wsId: string, id: string, home = HOME) => {
  if (!/^[a-z0-9-]{6,80}$/.test(id)) throw new Error("No such decision.");
  return path.join(roomDir(wsId, home), id);
};
const dayText = (t: number, long = false) => new Date(t).toLocaleDateString("en-GB", long ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
const dueText = (t: number) => new Date(t).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
const words = (t: string) => (t.match(/\S+/g) || []).length;
const sinceText = (t: number, now: number) => { const d = Math.max(0, now - t); return d < 3600000 ? "Live" : d < DAY ? Math.round(d / 3600000) + " h" : d < 14 * DAY ? Math.round(d / DAY) + " days" : d < 70 * DAY ? Math.round(d / (7 * DAY)) + " weeks" : Math.round(d / (30 * DAY)) + " months"; };

/* ---------- Sessions on disk ---------- */

/** Decisions the council is working on right now. A screen that asks for one gets the very object the council is writing to. */
const live = new Map<string, any>();

export function readSession(wsId: string, id: string, home = HOME): any | null {
  if (live.get(id)?.wsId === wsId) return live.get(id);
  try { return JSON.parse(fs.readFileSync(path.join(dirOf(wsId, id, home), "session.json"), "utf8")); } catch { return null; }
}
function save(s: any, home = HOME) {
  const dir = dirOf(s.wsId, s.id, home);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, "session.json.tmp-" + process.pid);
  fs.writeFileSync(tmp, JSON.stringify(s, null, 1));
  fs.renameSync(tmp, path.join(dir, "session.json"));
}
export function listSessions(wsId: string, home = HOME): any[] {
  let names: string[] = [];
  try { names = fs.readdirSync(roomDir(wsId, home)).filter((n) => !n.startsWith("_")); } catch { return []; }
  return names.map((n) => readSession(wsId, n, home)).filter(Boolean).sort((a, b) => b.at - a.at);
}

/* ---------- Reading a file the owner attached, or one in a folder they switched on ---------- */

/** One entry of a zip file (Word and Excel files are zips), read with nothing but zlib. */
export function unzipEntry(buf: Buffer, want: (name: string) => boolean, max = 4 * 1024 * 1024): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) return out;
  let at = buf.readUInt32LE(end + 16);
  const count = buf.readUInt16LE(end + 10);
  for (let n = 0; n < count && at + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) break;
    const method = buf.readUInt16LE(at + 10), size = buf.readUInt32LE(at + 20), full = buf.readUInt32LE(at + 24);
    const nameLen = buf.readUInt16LE(at + 28), extra = buf.readUInt16LE(at + 30), comment = buf.readUInt16LE(at + 32), local = buf.readUInt32LE(at + 42);
    const name = buf.toString("utf8", at + 46, at + 46 + nameLen);
    at += 46 + nameLen + extra + comment;
    if (!want(name) || full > max || local + 30 > buf.length) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    try { out.push({ name, text: (method === 0 ? raw : zlib.inflateRawSync(raw, { maxOutputLength: max })).toString("utf8") }); } catch { /* a damaged entry is skipped */ }
  }
  return out;
}
const unXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");

/** The plain words inside a file: text, Word, a spreadsheet or a PDF. Returns "" when nothing readable was found. */
export async function textOf(name: string, buf: Buffer): Promise<{ text: string; pages?: number }> {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".docx") {
    const doc = unzipEntry(buf, (n) => n === "word/document.xml")[0]?.text || "";
    return { text: unXml(doc.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, " ").replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim() };
  }
  if (ext === ".xlsx") {
    const parts = unzipEntry(buf, (n) => n === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    const shared = [...(parts.find((p) => p.name.endsWith("sharedStrings.xml"))?.text || "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unXml(m[1].replace(/<[^>]+>/g, "")));
    const rows: string[] = [];
    for (const sheet of parts.filter((p) => p.name.includes("worksheets")).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3)) {
      for (const row of sheet.text.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
        const cells = [...row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].map((c) => { const v = (c[2].match(/<v>([\s\S]*?)<\/v>/) || c[2].match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || ""; return /t="s"/.test(c[1]) ? shared[+v] || "" : unXml(v); });
        if (cells.some(Boolean)) rows.push(cells.join(", "));
        if (rows.length > 400) break;
      }
    }
    return { text: rows.join("\n") };
  }
  if (ext === ".pdf") {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const r: any = await extractText(pdf, { mergePages: true });
      return { text: String(r.text || "").trim(), pages: r.totalPages };
    } catch { return { text: "" }; }
  }
  if (buf.includes(0)) return { text: "" };
  let text = buf.toString("utf8");
  if (ext === ".html" || ext === ".htm") text = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  return { text: text.trim() };
}

const ATTACH_OK = /\.(pdf|docx|xlsx|txt|md|markdown|csv|tsv|json|html?|rtf|log)$/i;
const SECRET = /(password|passwd|secret|api[_-]?key|private[_ -]?key|credential|\.env$|\.pem$|id_rsa|token)/i;

/** A file the owner attaches to their next question. It is kept as plain text in the room folder and is read for that one decision only. */
export async function attachFile(ws: any, name0: any, data: any, home = HOME) {
  const name = path.basename(String(name0 || "")).replace(/[^\w .()&,'-]/g, "").slice(0, 90);
  if (!name || !ATTACH_OK.test(name)) throw new Error("That kind of file can't be read here. Attach a PDF, Word file, text file or spreadsheet.");
  if (SECRET.test(name)) throw new Error("That looks like a file of passwords or keys, so it was not attached.");
  const buf = Buffer.from(String(data || ""), "base64");
  if (!buf.length) throw new Error("The file arrived empty. Try attaching it again.");
  if (buf.length > 12 * 1024 * 1024) throw new Error("That file is larger than 12 MB. Attach a smaller one.");
  const room = (ws.room ||= {});
  if ((room.attach || []).length >= 3) throw new Error("Three files can be attached to one question. Remove one first.");
  const got = await textOf(name, buf);
  if (got.text.length < 20) throw new Error(/\.pdf$/i.test(name) ? "No words could be read from that PDF. It may be a scan. Attach it as Word or text instead." : "No words could be read from that file.");
  const id = "a" + safe(name + buf.length + Date.now()).slice(0, 10);
  const dir = path.join(roomDir(ws.id, home), "_attach");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + ".txt"), got.text.slice(0, 60000));
  const item = { id, name, size: buf.length, words: words(got.text), pages: got.pages || null };
  room.attach = [...(room.attach || []), item];
  return item;
}
export function dropAttach(ws: any, id: string, home = HOME) {
  const room = (ws.room ||= {});
  room.attach = (room.attach || []).filter((a: any) => a.id !== id);
  try { fs.unlinkSync(path.join(roomDir(ws.id, home), "_attach", String(id).replace(/[^a-z0-9]/g, "") + ".txt")); } catch { /* already gone */ }
}

/* ---------- The Ask screen: what is found, what is allowed, what is waiting ---------- */

export const defaultAccess = (ws: any) => ({ num: true, files: false, folders: [] as string[], fileIds: [] as string[], made: true, mail: true, ...(ws.room?.access || {}) });
const folderList = (ws: any, access: any, home = HOME) => {
  try { return getBrain(ws.id, home).projects.filter((p: any) => p.files > 0).map((p: any) => ({ id: p.id, name: p.name, files: p.files, on: access.folders.includes(p.id), warn: /memory|private|personal|journal/i.test(p.name) })); } catch { return []; }
};
const roster = () => R.ROSTER.map(({ lens, ...seat }) => seat);
const histRow = (s: any) => ({ id: s.id, step: s.step, at: s.at, date: dayText(s.at), q: s.brief?.title || s.q, label: s.result?.label || "", tag: s.result ? R.BANDS[s.result.band as R.Band].tag : "", score: s.result ? s.result.score.toFixed(1) : "", depth: s.mode === "quick" ? "Quick" : "Full", status: s.status,
  note: s.status !== "done" ? "Not finished" : s.checkin?.result ? ({ worked: "Worked.", partly: "Worked in part.", no: "Did not work." } as any)[s.checkin.result] : s.verdict?.again ? "Look again on " + dayText(s.verdict.again.on).replace(/ \d{4}$/, "") : "" });

export async function roomHome(ws: any, u: any, now: number, home = HOME) {
  const found = await ai.detect();
  const room = ws.room || {};
  const access = defaultAccess(ws);
  const all = listSessions(ws.id, home);
  const done = all.filter((s) => s.status === "done");
  const open = all.find((s) => s.status !== "done" && now - s.at < 14 * DAY);
  const due = done.filter((s) => s.verdict?.again?.on <= now && !s.checkin?.result).sort((a, b) => a.verdict.again.on - b.verdict.again.on)[0];
  const checked = done.filter((s) => s.checkin?.result);
  const rows: any[] = u.needs?.rows || [];
  return {
    ais: ai.ALL_PROVIDERS.map((name) => ({ name, found: found.includes(name) })),
    ai: found.includes(room.ai) ? room.ai : found.find((p) => String(p).toLowerCase().startsWith(String(ws.ai?.provider || "~"))) || found[0] || null,
    access, names: room.names !== false, attach: room.attach || [],
    folders: folderList(ws, access, home),
    sugg: rows.slice(0, 3).map((r) => ({ q: `How should I handle this: ${String(r.t).replace(/[.?!]+$/, "")}?`, src: String(r.sub || "").split(" · ")[0] || "Needs you", note: String(r.sub || "").split(" · ").slice(1).join(" · ") || "Waiting on you" })),
    hist: all.filter((s) => s.status === "done" || s === open).map(histRow),
    open: open ? { id: open.id, status: liveStatus(open), q: open.brief?.title || open.q, step: open.step } : null,
    checkin: due ? { id: due.id, q: due.brief?.title || due.q, label: due.result.label, call: due.verdict.call, text: due.verdict.again.text, decided: dayText(due.at).replace(/ \d{4}$/, "") } : null,
    stats: { year: done.filter((s) => new Date(s.at).getFullYear() === new Date(now).getFullYear()).length, checked: checked.length, worked: checked.filter((s) => s.checkin.result === "worked").length },
    owner: String(ws.setup?.about?.name || ws.owner || "You").split(" ")[0], roster: roster(),
  };
}

export function setAccess(ws: any, body: any) {
  const room = (ws.room ||= {}), a = defaultAccess(ws);
  for (const k of ["num", "files", "made", "mail"]) if (typeof body[k] === "boolean") (a as any)[k] = body[k];
  if (Array.isArray(body.folders)) { a.folders = body.folders.map(String).slice(0, 60); a.files = a.folders.length > 0 && body.files !== false; }
  if (typeof body.names === "boolean") room.names = body.names;
  if (typeof body.ai === "string" && ai.ALL_PROVIDERS.includes(body.ai)) room.ai = body.ai;
  room.access = a;
  return a;
}

/* ---------- Starting a decision and writing the brief ---------- */

const active = new Set<string>();
const timers = new Map<string, any>();
const liveStatus = (s: any) => ((s.status === "running" || s.status === "briefing" || s.status === "gathering") && !active.has(s.id) ? "stopped" : s.status);

const number = (s: any, list: any[], pass: number, on: (f: any) => boolean) => { for (const f of list) s.pack.push({ ...f, id: "E" + (s.pack.length + 1), pass, on: on(f) }); };
function applyAccess(s: any) {
  const a = s.access;
  for (const f of s.pack as R.Fact[]) {
    f.on = f.src === "att" || f.src === "past" ? true : f.src === "file" ? (a.files && a.folders.includes((f as any).folder)) || a.fileIds.includes(f.ref) : f.src === "mail" ? !!a.mail : f.src === "made" ? !!a.made : !!a.num;
  }
}

export type Ctx = { ws: any; u: any; team: { owner: string; due: number | null }[]; usage?: (task: string, provider: string) => void; home?: string };

export async function startSession(ctx: Ctx, body: any, now: number) {
  const { ws, u } = ctx, home = ctx.home || HOME;
  const q = R.clip(body.q, 600);
  if (q.length < 12) throw new Error("Write your question in a full sentence first.");
  const found = await ai.detect();
  const provider = found.includes(body.ai) ? body.ai : null;
  if (!provider) throw new Error(found.length ? "Pick which AI runs the council." : "No AI app was found on this computer. Scan for AI first.");
  const room = (ws.room ||= {});
  const id = new Date(now).toISOString().slice(0, 10) + "-" + (q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36).replace(/-$/, "") || "decision") + "-" + now.toString(36).slice(-4);
  const s: any = {
    id, wsId: ws.id, at: now, q, owner: String(ws.setup?.about?.name || ws.owner || "The owner").split(" ")[0], biz: ws.name,
    business: [ws.name, ws.setup?.about?.role, ...(ws.setup?.goals || []), (ws.sites || []).length ? "Websites: " + (ws.sites || []).map((x: any) => x.name).slice(0, 8).join(", ") : ""].filter(Boolean).join(". "),
    people: (ws.team || []).slice(1, 12).map((p: any) => String(p.name || "").split(" ")[0]).filter(Boolean),
    ai: provider, modeAsk: ["quick", "full"].includes(body.mode) ? body.mode : "auto", mode: body.mode === "quick" ? "quick" : "full",
    status: "briefing", step: "brief", access: { ...defaultAccess(ws), fileIds: [] }, names: room.names !== false,
    attach: room.attach || [], pack: [], gaps: [], events: [], r1: {}, r2: [], r3: {}, out: [], seats: [], bench: [],
    calls: { done: 0, total: 0 }, checks: { cites: 0, dropped: 0 }, shared: { skipped: 0 },
    // One screen: the owner may have chosen the seats, and the council carries on by itself unless the Chair needs an answer.
    chosen: R.ownBoard("other", body.seats) ? [...new Set((body.seats as any[]).map(String))].filter((k) => R.seatOf(k)).slice(0, R.SEATS_MAX) : null, auto: body.auto === true,
  };
  if (Array.isArray(body.seats) && body.seats.length && !s.chosen) throw new Error(`Keep at least ${R.SEATS_MIN} seats, so there is a real debate.`);
  const pool = R.coreFacts(u, ctx.team, now);
  s.menu = pool.menu; s.gaps = pool.gaps;
  number(s, pool.core, 0, () => true);
  // Attached files move into this decision's own folder and leave the composer.
  const dir = dirOf(ws.id, id, home);
  fs.mkdirSync(dir, { recursive: true });
  for (const a of s.attach) {
    let text = "";
    try { const from = path.join(roomDir(ws.id, home), "_attach", a.id + ".txt"); text = fs.readFileSync(from, "utf8"); fs.renameSync(from, path.join(dir, "attached-" + a.id + ".txt")); } catch { /* the file was removed in the meantime */ }
    if (text) number(s, [{ src: "att", what: a.name, value: "Read", period: a.pages ? `${a.pages} page${a.pages === 1 ? "" : "s"}` : `${a.words.toLocaleString("en-US")} words`, age: "Just now", link: "", note: "Attached by you, and read for this decision only.", text: text.slice(0, 6000), ref: a.id }], 0, () => true);
  }
  room.attach = [];
  applyAccess(s);
  save(s, home);
  background(s, ctx, () => writeBrief(s, ctx, now));
  return { id };
}

/** Runs a piece of council work without making the screen wait, and turns any failure into a calm status the screen can show. */
function background(s: any, ctx: Ctx, job: () => Promise<void>) {
  const home = ctx.home || HOME;
  if (active.has(s.id)) return;
  active.add(s.id); live.set(s.id, s);
  delete s.error; delete s.rest;
  job().catch((e: any) => {
    const message = String(e?.message || e);
    if (e?.pause) s.status = "paused";
    else if (ai.isLimit(message)) {
      s.status = "resting"; s.rest = { until: Date.now() + 15 * 60000, why: R.clip(message, 160) };
      clearTimeout(timers.get(s.id));
      timers.set(s.id, setTimeout(() => { const again = readSession(s.wsId, s.id, home); if (again?.status === "resting") resume(again, ctx); }, 15 * 60000));
    } else { s.status = "failed"; s.error = R.clip(message, 240); }
  }).finally(() => { active.delete(s.id); live.delete(s.id); save(s, home); carryOn(s, ctx); });
}

/** A council started from the one screen does not wait for the owner between steps. It stops only when the Chair has a question no data could answer. */
function carryOn(s: any, ctx: Ctx) {
  if (!s.auto) return;
  if (s.status === "brief" && s.brief && !s.brief.questions.length) gather(s, ctx);
  else if (s.status === "ready" && !s.startedAt) run(s, ctx);
}

/** The council the screen shows before any AI has read the question: a first guess from its words. */
export function suggestBoard(q: any) {
  const kind = R.guessKind(String(q || "")), board = R.pickBoard(kind, "full");
  return { kind, label: R.KINDS[kind].label, seats: board.seats.map((x) => x.key), quick: R.pickBoard(kind, "quick").seats.map((x) => x.key), weights: Object.fromEntries(R.KINDS[kind].board), min: R.SEATS_MIN, max: R.SEATS_MAX };
}

/** One question to the owner's AI, answered as JSON. Tried twice before it counts as a failure. */
async function ask(s: any, ctx: Ctx, prompt: string, label: string): Promise<any> {
  const home = ctx.home || HOME;
  let last: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (s.pause) throw Object.assign(new Error("Paused"), { pause: true });
    try {
      const answer = await ai.runLong(s.ai, prompt);
      const data = R.parseJson(answer);
      fs.appendFileSync(path.join(dirOf(s.wsId, s.id, home), "shared-log.jsonl"), JSON.stringify({ at: Date.now(), step: label, ai: s.ai, sent: prompt, answer: answer.slice(0, 6000) }) + "\n");
      if (data) { s.calls.done++; return data; }
      last = new Error(`${s.ai} answered in a form the dashboard could not read.`);
    } catch (e: any) {
      if (ai.isLimit(String(e?.message || e))) throw e;
      last = e;
    }
  }
  throw last;
}
const cite = (s: any, text: any, max: number) => { const r = R.checkCites(text, s.pack, max); s.checks.cites += r.cites.length; s.checks.dropped += r.dropped; return r.text; };
const briefIn = (s: any): R.BriefIn => ({ title: s.brief.title, stake: R.plainCites(s.brief.stake, s.pack), options: s.brief.options, answers: (s.brief.questions || []).map((x: any, i: number) => (s.brief.answers[i] != null ? `${x.q} ${x.choices[s.brief.answers[i]]}.` : "")).filter(Boolean) });

async function writeBrief(s: any, ctx: Ctx, now: number) {
  const { ws } = ctx, home = ctx.home || HOME;
  const keys = R.keywordsOf(s.q);
  let brain: any = { projects: [], nodes: [], sources: [] };
  try { brain = getBrain(ws.id, home); } catch { /* no folders connected */ }
  const projects = new Map<string, any>(brain.projects.map((p: any) => [p.id, p]));
  const files = brain.nodes.filter((n: any) => n.kind === "file" && (n.readable || /^\.(docx|xlsx|pdf)$/i.test(n.extension)) && !SECRET.test(n.name))
    .map((n: any) => ({ n, hit: R.matches(n.name + " " + n.path, keys) ? 1 : 0 })).sort((a: any, b: any) => b.hit - a.hit || b.n.modifiedAt - a.n.modifiedAt).slice(0, 110).map((x: any) => x.n);
  if (!brain.projects.length) s.gaps.push("Your files. No WorkOS or project folder is connected.");
  const past = listSessions(ws.id, home).filter((x) => x.status === "done" && x.id !== s.id);
  const data = await ask(s, ctx, R.briefPrompt({
    q: s.q, business: s.business, owner: s.owner, core: s.pack, today: dayText(now, true),
    menu: s.menu.map((m: any, i: number) => ({ id: "M" + (i + 1), what: m.menu })),
    files: files.map((n: any, i: number) => ({ n: i + 1, name: n.name, folder: projects.get(n.project)?.name || "Folder", open: s.access.files && s.access.folders.includes(n.project) })),
    past: past.slice(0, 8).map((x) => `${dayText(x.at)}: ${x.brief?.title} Verdict: ${x.result?.label}.${x.checkin?.result ? " Outcome: " + x.checkin.result + "." : ""}`),
  }), "brief");
  const options = (Array.isArray(data.options) ? data.options : []).slice(0, 3).map((o: any) => ({ title: R.clip(o?.title, 60), detail: R.clip(o?.detail, 140) })).filter((o: any) => o.title);
  if (options.length < 2) throw new Error(`${s.ai} did not return clear options. Try again, or word the question as a choice.`);
  if (options.length < 3) options.push({ title: "Change nothing for now", detail: "Leave things as they are and look again later." });
  const kind = R.KINDS[data.kind] ? data.kind : "other";
  s.brief = {
    title: R.clip(data.title, 110) || s.q, stake: cite(s, data.stake, 320), kind, kindLabel: R.KINDS[kind].label, oneWay: data.one_way === true, options, statusQuo: 2,
    questions: (Array.isArray(data.questions) ? data.questions : []).slice(0, 2).map((x: any) => ({ q: R.clip(x?.q, 110), choices: (Array.isArray(x?.choices) ? x.choices : []).slice(0, 3).map((c: any) => R.clip(c, 28)).filter(Boolean) })).filter((x: any) => x.q && x.choices.length > 1),
    answers: [], depth: data.depth === "quick" ? "quick" : "full", depthWhy: R.clip(data.depth_why, 200),
    keywords: [...new Set([...(Array.isArray(data.keywords) ? data.keywords : []).map((k: any) => String(k).toLowerCase().replace(/[^a-z0-9 -]/g, "")).filter((k: string) => k.length > 3), ...keys])].slice(0, 10),
    seatWhy: typeof data.seat_why === "object" && data.seat_why ? data.seat_why : {},
  };
  if (s.modeAsk === "auto") s.mode = s.brief.depth;
  Object.assign(s, (s.chosen && R.ownBoard(kind, s.chosen, s.brief.seatWhy)) || R.pickBoard(kind, s.mode, s.brief.seatWhy));
  // The Chair asked for more: numbers the dashboard reads itself, and files by name.
  const more = (Array.isArray(data.more) ? data.more : []).map((m: any) => s.menu[Number(String(m).replace(/\D/g, "")) - 1]).filter(Boolean).slice(0, 6);
  number(s, [...new Set(more)].map(({ menu, ...f }: any) => f), 1, () => true);
  const wants = [...new Set((Array.isArray(data.files) ? data.files : []).map((n: any) => files[Number(n) - 1]).filter(Boolean))].slice(0, 4);
  number(s, wants.map((n: any) => ({ src: "file", what: n.name, value: "Not read", period: "", age: sinceText(n.modifiedAt, now), link: "#brain", note: "", ref: n.id, folder: n.project, path: [brain.sources.find((x: any) => x.id === n.sourceId)?.name, ...String(n.path).split("/").slice(0, -1)].filter(Boolean).join(" / ") })), 1, () => true);
  // One last pass: mail subjects, things the AIs made, and past decisions that touch the same words.
  const kw = s.brief.keywords;
  const mail = (ws.inbox || []).filter((m: any) => m.subject && now - m.at < 30 * DAY);
  if (mail.length) {
    const hits = mail.filter((m: any) => R.matches(m.subject, kw));
    number(s, [{ src: "mail", what: `Mail subjects that mention ${kw.slice(0, 2).join(" or ")}`, value: String(hits.length), period: "Last 30 days", age: "Live", link: "#inbox", note: `Subjects and senders only. No message was opened.${hits.length ? " From " + [...new Set(hits.map((m: any) => m.from))].slice(0, 3).join(", ") + "." : ""}` }], 2, () => true);
  }
  for (const m of (ws.made?.items || []).filter((m: any) => m.type !== "code" && R.matches(m.title, kw.slice(0, 5))).sort((a: any, b: any) => b.at - a.at).slice(0, 2))
    number(s, [{ src: "made", what: m.title, value: ({ image: "Picture", video: "Video", doc: "Document", code: "Code" } as any)[m.type] || "File", period: "Made " + dayText(m.at).replace(/ \d{4}$/, ""), age: sinceText(m.at, now), link: "#made", note: `Made by ${m.ai} in ${m.project}.` }], 2, () => true);
  for (const p of past.filter((x) => R.matches(x.brief?.title + " " + x.q, kw)).slice(0, 2))
    number(s, [{ src: "past", what: p.brief.title, value: p.checkin?.result ? ({ worked: "Worked", partly: "Partly", no: "Did not work" } as any)[p.checkin.result] : p.result.label, period: "Decided " + dayText(p.at), age: sinceText(p.at, now), link: "#room/verdict/" + p.id, note: R.clip(p.verdict.call, 150) }], 2, () => true);
  delete s.menu;
  applyAccess(s);
  s.status = "brief";
  ctx.usage?.("Decision Room: " + s.brief.title, s.ai);
}

/* ---------- Changes the owner makes before the council sits ---------- */

export function editSession(s: any, body: any, home = HOME) {
  if (!["brief", "ready"].includes(s.status)) throw new Error("The council has already started on this one.");
  if (Array.isArray(body.answer)) { const [i, j] = body.answer.map(Number); if (s.brief.questions[i]?.choices[j]) s.brief.answers[i] = j; }
  if (["quick", "full"].includes(body.mode) && body.mode !== s.mode) { s.mode = body.mode; if (!s.chosen) Object.assign(s, R.pickBoard(s.brief.kind, s.mode, s.brief.seatWhy)); }
  if (Array.isArray(body.swap)) {
    const [i, key] = body.swap, at = s.bench.indexOf(key);
    if (s.seats[i] && at >= 0) { s.bench[at] = s.seats[i].key; s.seats[i] = { key, weight: s.seats[i].weight, why: R.clip(s.brief.seatWhy?.[key], 90) || R.seatOf(key)!.why }; }
  }
  if (body.allowFiles) s.access.fileIds = s.pack.filter((f: any) => f.src === "file").map((f: any) => f.ref);
  if (body.access && typeof body.access === "object") { for (const k of ["num", "files", "made", "mail"]) if (typeof body.access[k] === "boolean") s.access[k] = body.access[k]; if (Array.isArray(body.access.folders)) { s.access.folders = body.access.folders.map(String); s.access.files = s.access.folders.length > 0; } }
  if (typeof body.names === "boolean") s.names = body.names;
  if (["brief", "board", "evidence"].includes(body.step)) s.step = body.step;
  if (body.allowFiles || body.access) { applyAccess(s); if (s.status === "ready") s.status = "brief"; }
  save(s, home);
  return s;
}

/** Reads what the owner allowed: the files in open folders and the attached files. One AI call then says what each text shows. */
export function gather(s: any, ctx: Ctx) {
  if (s.status !== "brief") return;
  const home = ctx.home || HOME;
  s.status = "gathering"; s.step = "evidence";
  save(s, home);
  background(s, ctx, async () => {
    let excerpts = 0, count = 0;
    for (const f of s.pack as any[]) {
      if (f.src !== "file") continue;
      delete f.text;
      if (!f.on) { f.value = "Not read"; f.note = "That folder is switched off."; continue; }
      try {
        const file = brainFilePath(s.wsId, f.ref, home), info = fs.statSync(file);
        if (info.size > 12 * 1024 * 1024) throw new Error("large");
        const got = await textOf(f.what, fs.readFileSync(file));
        if (got.text.length < 20) throw new Error("empty");
        f.text = got.text.slice(0, 2400); f.value = "Read"; f.period = `${words(got.text).toLocaleString("en-US")} words`; f.note = "Read from your folder for this decision."; excerpts++; count += words(f.text);
      } catch { f.on = false; f.value = "Not read"; f.note = "This file could not be opened as text."; s.shared.skipped++; }
    }
    const texts = (s.pack as any[]).filter((f) => f.on && f.text);
    s.shared = { ...s.shared, excerpts, words: count, attach: s.attach.length, facts: s.pack.filter((f: any) => f.on).length };
    s.calls.total = R.callsFor(s.mode, s.seats.length, texts.length > 0);
    if (texts.length) {
      const data = await ask(s, ctx, R.notesPrompt(texts.map((f) => ({ id: f.id, name: f.what, text: f.text })), s.brief.title), "reading the files").catch((e) => { if (ai.isLimit(String(e?.message)) || e?.pause) throw e; s.calls.total--; return { notes: [] }; });
      for (const n of Array.isArray(data.notes) ? data.notes : []) {
        const f = texts.find((x) => x.id === String(n?.id).toUpperCase());
        if (!f) continue;
        f.value = R.clip(n.value, 18) || "Read"; if (n.covers) f.period = R.clip(n.covers, 24); f.note = R.clip(n.note, 190) || f.note;
      }
    }
    for (const g of (s.pack as any[]).filter((f) => !f.on && f.pass > 0).map((f) => `${f.what}. ${f.src === "file" ? "That folder is switched off." : "That source is switched off."}`).slice(0, 3)) if (!s.gaps.includes(g)) s.gaps.push(g);
    s.status = "ready";
  });
}

/* ---------- The council itself ---------- */

async function pool<T>(items: T[], size: number, job: (item: T) => Promise<void>) {
  let at = 0, stop: any = null;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (at < items.length && !stop) { const item = items[at++]; try { await job(item); } catch (e) { stop = e; } }
  }));
  if (stop) throw stop;
}
const hard = (e: any) => e?.pause || ai.isLimit(String(e?.message || e));

export function resume(s: any, ctx: Ctx) {
  if (s.status === "done") return;
  delete s.pause;
  if (!s.brief) { s.status = "briefing"; return background(s, ctx, () => writeBrief(s, ctx, Date.now())); }
  if (!s.startedAt) { s.status = "brief"; return gather(s, ctx); }
  run(s, ctx);
}

export function run(s: any, ctx: Ctx) {
  const home = ctx.home || HOME;
  if (!["ready", "paused", "resting", "failed", "running"].includes(s.status) || active.has(s.id)) return;
  s.status = "running"; s.step = "live"; s.startedAt ||= Date.now();
  save(s, home);
  const b = () => briefIn(s), pack = () => s.pack as R.Fact[];
  const sitting = () => (s.seats as R.Sitting[]).filter((x) => !s.out.includes(x.key));
  const say = (event: any) => { s.events.push(event); save(s, home); };
  background(s, ctx, async () => {
    if (!s.events.length) say({ t: "open" });
    // Round 1: every seat alone, three at a time.
    await pool(sitting().filter((x) => !s.r1[x.key]), 3, async (x) => {
      try {
        const d = await ask(s, ctx, R.openingPrompt(R.seatOf(x.key)!, b(), pack()), "round 1, " + R.seatOf(x.key)!.role);
        const scores = R.cleanScores(d.scores, 3);
        if (!scores) throw new Error("no scores");
        s.r1[x.key] = { key: x.key, stance: R.clip(d.stance, 26) || "Has a view", say: cite(s, d.say, 420), scores, ask: R.clip(d.ask, 140) };
        say({ t: "r1", k: x.key });
      } catch (e) { if (hard(e)) throw e; s.out.push(x.key); s.calls.total -= 2; say({ t: "out", k: x.key }); }
    });
    if (sitting().length < 2) throw new Error("Too few seats answered to hold a council. Try again in a moment.");
    const openings = () => sitting().map((x) => s.r1[x.key]);
    const raw = () => Object.fromEntries(sitting().map((x) => [x.key, s.r1[x.key].scores]));
    if (s.mode !== "quick") {
      // The Chair finds the real disagreements, then those seats answer each other.
      if (!s.cruxes) {
        const d = await ask(s, ctx, R.cruxPrompt(b(), pack(), openings()), "finding the disagreements");
        const ok = (k: any) => sitting().some((x) => x.key === k);
        s.cruxes = (Array.isArray(d.cruxes) ? d.cruxes : []).filter((c: any) => ok(c?.a) && ok(c?.b) && c.a !== c.b && c.q).slice(0, 2).map((c: any) => ({ a: c.a, b: c.b, q: R.clip(c.q, 130) }));
        s.calls.total -= (2 - s.cruxes.length) * 2;
        const a = d.answer, fact = a && pack().find((f) => f.id === String(a.fact).toUpperCase() && f.on);
        if (fact && ok(a.seat)) s.answer = { seat: a.seat, fact: fact.id, say: cite(s, a.say, 300) };
        say({ t: "crux" });
        if (s.answer) say({ t: "data" });
      }
      await pool(s.cruxes.map((c: any, i: number) => ({ c, i })), 2, async ({ c, i }: any) => {
        const A = R.seatOf(c.a)!, B = R.seatOf(c.b)!;
        let first = s.r2.find((m: any) => m.crux === i && m.from === c.a);
        if (!first) {
          const d = await ask(s, ctx, R.debatePrompt(A, B, c.q, b(), pack(), s.r1[c.a], s.r1[c.b]), "round 2, " + A.role).catch((e) => { if (hard(e)) throw e; s.calls.total--; return null; });
          if (d?.say) { first = { crux: i, from: c.a, to: c.b, say: cite(s, d.say, 360) }; s.r2.push(first); say({ t: "r2", i: s.r2.length - 1 }); }
        }
        if (!s.r2.find((m: any) => m.crux === i && m.from === c.b)) {
          const d = await ask(s, ctx, R.debatePrompt(B, A, c.q, b(), pack(), s.r1[c.b], s.r1[c.a], first?.say), "round 2, " + B.role).catch((e) => { if (hard(e)) throw e; s.calls.total--; return null; });
          if (d?.say) { s.r2.push({ crux: i, from: c.b, to: c.a, say: cite(s, d.say, 360) }); say({ t: "r2", i: s.r2.length - 1 }); }
        }
      });
    } else s.cruxes ||= [];
    if (!s.draft) {
      const first = [0, 1, 2].map((o) => R.optionScore(sitting(), raw(), o));
      const lead = first.indexOf(Math.max(...first));
      const d = await ask(s, ctx, R.draftPrompt(b(), pack(), openings(), s.cruxes, s.r2, lead), "the draft resolution");
      s.draft = { lead, text: cite(s, d.draft, 330) || `${s.brief.options[lead].title}. ${s.brief.options[lead].detail}` };
      (Array.isArray(d.settled) ? d.settled : []).slice(0, s.cruxes.length).forEach((t: any, i: number) => (s.cruxes[i].settled = cite(s, t, 200)));
      say({ t: "draft" });
    }
    // The vote. A seat that cannot be reached keeps its opening scores, and the report says so.
    await pool(sitting().filter((x) => !s.r3[x.key]), 3, async (x) => {
      const mine = s.r1[x.key], said = s.r2.filter((m: any) => m.from === x.key || m.to === x.key).map((m: any) => `${R.seatOf(m.from)!.role} to ${R.seatOf(m.to)!.role}: "${R.plainCites(m.say, pack())}"`);
      const d = await ask(s, ctx, R.votePrompt(R.seatOf(x.key)!, b(), pack(), mine, R.plainCites(s.draft.text, pack()), s.draft.lead, said), "the vote, " + R.seatOf(x.key)!.role).catch((e) => { if (hard(e)) throw e; s.calls.total--; return null; });
      const scores = d && R.cleanScores(d.scores, 3);
      s.r3[x.key] = scores ? { scores, line: cite(s, d.line, 170) || "Voted.", ruin: String(d.ruin || "no").toLowerCase(), sure: Number(d.sure) || 3 } : { scores: mine.scores, line: "Could not be reached for the vote, so its opening scores were kept.", ruin: "no", sure: 2, kept: true };
      say({ t: "vote", k: x.key });
    });
    s.result = R.tally(sitting(), s.r3, 3, { oneWay: s.brief.oneWay, statusQuo: s.brief.statusQuo });
    if (!s.verdict) await writeVerdict(s, ctx);
    s.status = "done"; s.endedAt = Date.now();
    say({ t: "end" });
    if (!s.report) {
      const d = await ask(s, ctx, R.reportPrompt({ b: b(), pack: pack(), call: s.verdict.call, business: s.business, owner: s.owner, openings: openings() }), "the report").catch((e) => { if (hard(e)) throw e; return {}; });
      s.report = {
        short: R.clip(d.short, 34) || R.clip(s.brief.title, 34),
        words: (Array.isArray(d.words) ? d.words : []).slice(0, 4).map((w: any) => ({ word: R.clip(w?.word, 34), means: R.clip(w?.means, 150) })).filter((w: any) => w.word && w.means && !/^(the )?(council|seats?|chair)$/i.test(w.word)),
        options: [0, 1, 2].map((i) => ({ best: cite(s, d.options?.[i]?.best, 190), risk: cite(s, d.options?.[i]?.risk, 190) })),
        wont: cite(s, d.wont, 300),
      };
    }
    writeReport(s, home);
    ctx.usage?.(`Decision Room verdict: ${s.result.label}`, s.ai);
  });
}

async function writeVerdict(s: any, ctx: Ctx) {
  const now = Date.now(), pack = s.pack as R.Fact[], r = s.result;
  const sitting = (s.seats as R.Sitting[]).filter((x) => !s.out.includes(x.key));
  const d = await ask(s, ctx, R.verdictPrompt({
    b: briefIn(s), pack, openings: sitting.map((x) => s.r1[x.key]), votes: sitting.map((x) => ({ key: x.key, scores: s.r3[x.key].scores, line: R.plainCites(s.r3[x.key].line, pack) })),
    draft: R.plainCites(s.draft.text, pack), settled: (s.cruxes || []).map((c: any) => R.plainCites(c.settled || "", pack)).filter(Boolean), result: r, people: s.people, owner: s.owner, today: dayText(now, true),
  }), "the verdict");
  const names = [s.owner, ...s.people];
  const list = (v: any, n: number, max: number) => (Array.isArray(v) ? v : []).slice(0, n).map((t: any) => cite(s, t, max)).filter(Boolean);
  const low = [...sitting].sort((a, b) => s.r3[a.key].scores[r.rec] - s.r3[b.key].scores[r.rec])[0];
  const minor = sitting.find((x) => x.key === d.minority?.seat) || low;
  const days = Math.max(14, Math.min(120, Math.round(Number(d.again_days)) || 60));
  s.verdict = {
    answer: R.clip(R.plainCites(R.checkCites(d.answer, pack, 90).text, pack), 90),
    example: cite(s, d.example, 340),
    call: cite(s, d.call, 340) || s.draft.text,
    why: (Array.isArray(d.why) ? d.why : []).slice(0, 3).map((w: any) => ({ head: R.clip(w?.head, 60), text: cite(s, w?.text, 240) })).filter((w: any) => w.head && w.text),
    money: cite(s, d.money, 420),
    next: (Array.isArray(d.next) ? d.next : []).slice(0, 3).map((n: any) => { const due = now + Math.max(0, Math.min(180, Math.round(Number(n?.days)) || 7)) * DAY; return { step: R.clip(n?.step, 110), owner: names.find((p) => p.toLowerCase() === String(n?.owner || "").toLowerCase().split(" ")[0]) || s.owner, due, by: dueText(due) }; }).filter((n: any) => n.step),
    conditions: list(d.conditions, 3, 130),
    stops: (Array.isArray(d.stops) ? d.stops : []).slice(0, 2).map((x: any) => ({ text: R.clip(R.plainCites(R.checkCites(x?.text, pack, 150).text, pack), 150), fact: pack.find((f) => f.on && f.id === String(x?.fact).toUpperCase())?.id || "" })).filter((x: any) => x.text),
    again: { on: now + days * DAY, text: R.clip(d.again, 120) || "Check whether this worked." },
    minority: { seat: minor.key, quote: R.plainCites(R.checkCites(String(d.minority?.quote || s.r3[minor.key].line).replace(/^["“]|["”]$/g, ""), pack, 280).text, pack), score: s.r3[minor.key].scores[r.rec] },
    change: list(d.change, 3, 110),
    decisive: (Array.isArray(d.decisive) ? d.decisive : []).map((x: any) => String(x).toUpperCase()).filter((id: string) => pack.some((f) => f.on && f.id === id)).slice(0, 3),
  };
}

/* ---------- The report ---------- */

const browsers = () => {
  const pf = process.env.ProgramFiles || "C:\\Program Files", pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", local = process.env.LOCALAPPDATA || "";
  return process.platform === "win32"
    ? [path.join(pf, "Google", "Chrome", "Application", "chrome.exe"), path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"), path.join(local, "Google", "Chrome", "Application", "chrome.exe"), path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"), path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe")]
    : process.platform === "darwin"
      ? ["Google Chrome", "Microsoft Edge", "Brave Browser", "Chromium"].flatMap((n) => [`/Applications/${n}.app/Contents/MacOS/${n}`, path.join(os.homedir(), "Applications", `${n}.app`, "Contents", "MacOS", n)])
      : [process.env.CHROME_PATH || "", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/microsoft-edge", "/snap/bin/chromium", "/opt/pw-browsers/chromium"];
};

/** The report as a page, for reading inside the dashboard. */
export const reportPage = (s: any) => reportHtml(s);

const writeIfNew = (file: string, text: string) => { let old = ""; try { old = fs.readFileSync(file, "utf8"); } catch { /* not written yet */ } if (old !== text) fs.writeFileSync(file, text); };
/** Saves the answer twice in the decision's folder: a page for people, and a plain file for the owner's AI. */
export function writeReport(s: any, home = HOME) {
  const dir = dirOf(s.wsId, s.id, home);
  writeIfNew(path.join(dir, "report.html"), reportHtml(s));
  writeIfNew(path.join(dir, "decision.md"), decisionMd(s));
}
/** The plain file an AI reads. */
export const decisionText = (s: any) => decisionMd(s);
/** The newest finished decision, for an AI that asks what was decided. */
export function latestDecision(wsId: string, home = HOME) {
  const s = listSessions(wsId, home).filter((x) => x.status === "done" && x.verdict).sort((a, b) => b.at - a.at)[0];
  return s ? { found: true, id: s.id, question: s.brief?.title || s.q, decided: dayText(s.at, true), file: path.join(dirOf(wsId, s.id, home), "decision.md"), text: decisionMd(s) } : { found: false, note: "No decision has been finished yet. The owner asks one in the Decision Room." };
}

const fileUrl = (file: string) => "file://" + (process.platform === "win32" ? "/" : "") + file.replace(/\\/g, "/").split("/").map((p, i) => (i === 0 && /^[A-Za-z]:$/.test(p) ? p : encodeURIComponent(p))).join("/");
const FLAGS = ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", "--disable-component-update", "--disable-sync"];

/** The line at the foot of every printed page. The count is whatever the answer needed, so it is filled in by the browser. */
const PDF_FOOT = `<div style="width:100%;padding:0 18mm;display:flex;justify-content:space-between;font:400 6.4pt ui-monospace,Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:#8A8D97"><span>Made with AI-Dashboard</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;

/** Prints a page to PDF by talking to the browser directly, the way a testing tool does. Waits for the page and its fonts first. */
function printByDevtools(bin: string, html: string, pdf: string, profile: string): Promise<boolean> {
  const WS: any = (globalThis as any).WebSocket;
  if (!WS) return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = execFile(bin, [...FLAGS, `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank"], { windowsHide: true }, () => {});
    let done = false, socket: any = null, text = "";
    const finish = (ok: boolean) => { if (done) return; done = true; clearTimeout(timer); try { socket?.close(); } catch { /* closed */ } try { child.kill(); } catch { /* gone */ } resolve(ok); };
    const timer = setTimeout(() => finish(false), 40000);
    child.on("error", () => finish(false));
    child.stderr?.on("data", (chunk) => {
      text += String(chunk);
      const m = !socket && text.match(/DevTools listening on (ws:\/\/\S+)/);
      if (!m) return;
      let id = 0; const waiting = new Map<number, (r: any) => void>();
      const send = (method: string, params: any = {}, sessionId?: string) => new Promise<any>((ok) => { const n = ++id; waiting.set(n, ok); socket.send(JSON.stringify({ id: n, method, params, sessionId })); });
      socket = new WS(m[1]);
      socket.onerror = () => finish(false);
      socket.onmessage = (ev: any) => { const msg = JSON.parse(String(ev.data)); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)!(msg.result || {}); waiting.delete(msg.id); } };
      socket.onopen = async () => {
        try {
          const { targetId } = await send("Target.createTarget", { url: "about:blank" });
          const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
          await send("Page.enable", {}, sessionId);
          await send("Page.navigate", { url: fileUrl(html) }, sessionId);
          // Give the page and its fonts a moment, but never wait on a font that cannot be fetched.
          await send("Runtime.evaluate", { expression: "Promise.race([new Promise(r=>{if(document.readyState==='complete')r();else addEventListener('load',r)}).then(()=>document.fonts.ready),new Promise(r=>setTimeout(r,7000))]).then(()=>1)", awaitPromise: true }, sessionId);
          const out = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: PDF_FOOT }, sessionId);
          if (!out.data) return finish(false);
          fs.writeFileSync(pdf, Buffer.from(out.data, "base64"));
          finish(true);
        } catch { finish(false); }
      };
    });
  });
}

/** The report as a PDF, printed by the Chrome or Edge already on this computer. Returns null when no such browser is found. */
export async function reportPdf(s: any, home = HOME): Promise<string | null> {
  const dir = dirOf(s.wsId, s.id, home), html = path.join(dir, "report.html"), pdf = path.join(dir, "report.pdf");
  writeReport(s, home);
  if (fs.existsSync(pdf) && fs.statSync(pdf).size > 2000 && fs.statSync(pdf).mtimeMs >= fs.statSync(html).mtimeMs) return pdf;
  const bin = browsers().find((b) => b && fs.existsSync(b));
  if (!bin) return null;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "aid-print-"));
  try {
    if (!(await printByDevtools(bin, html, pdf, profile)))
      await new Promise<void>((done) => execFile(bin, [...FLAGS, `--user-data-dir=${profile}`, "--no-pdf-header-footer", "--virtual-time-budget=6000", `--print-to-pdf=${pdf}`, fileUrl(html)], { timeout: 30000, windowsHide: true }, () => done()));
  } finally { try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* the folder is temporary anyway */ } }
  return fs.existsSync(pdf) && fs.statSync(pdf).size > 2000 ? pdf : null;
}
export const sessionFolder = (s: any, home = HOME) => dirOf(s.wsId, s.id, home);

/* ---------- What the screens are given ---------- */

export function viewSession(s: any, now: number) {
  const status = liveStatus(s);
  const { menu, people, business, ...rest } = s;
  return {
    ...rest, status, roster: roster(),
    pack: (s.pack || []).map(({ text, ...f }: any) => ({ ...f, words: text ? words(text) : 0 })),
    date: dayText(s.at), minutes: s.endedAt && s.startedAt ? Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000)) : null,
    restAt: s.rest ? new Date(s.rest.until).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null,
    againDate: s.verdict ? dayText(s.verdict.again.on, true) : null,
    kindLabel: s.brief?.kindLabel,
  };
}

export function pause(s: any, home = HOME) { if (active.has(s.id)) { s.pause = true; } else if (s.status === "running") s.status = "paused"; save(s, home); }

export function checkin(s: any, result: string, home = HOME) {
  if (!["worked", "partly", "no"].includes(result)) throw new Error("Pick one of the three answers.");
  s.checkin = { result, at: Date.now() };
  save(s, home);
}

export function removeSession(wsId: string, id: string, home = HOME) { fs.rmSync(dirOf(wsId, id, home), { recursive: true, force: true }); }
export const saveSession = save;

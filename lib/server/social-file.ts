// The Metricool folder. The owner, or their AI, saves a Metricool export here and the dashboard shows the newest one.
// Nothing is sent anywhere: the file is read on this computer, and only followers and reach are kept from it.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { HOME } from "./store.ts";
import { FILE_HELP, socialFromJson, socialFromTables, tableFromText, tableOf, type SocialFile } from "../social-file.ts";

const MAX = 15 * 1024 * 1024;
const KINDS = /\.(csv|tsv|txt|xlsx|json|pdf)$/i;
export const socialFolder = (wsId: string, home = HOME) => path.join(home, "metricool", wsId.replace(/[^a-zA-Z0-9_-]/g, "_"));

const README = `Metricool numbers for AI-Dashboard

Save a Metricool export in this folder and the dashboard shows it on the Social page.
The newest file wins. CSV, Excel (.xlsx), JSON and PDF all work.

The simplest file is a CSV with these columns:
date, network, followers, reach
One row for each network for each day, for at least the last 14 days.
Add a "brand" column when there is more than one website.

For an AI: JSON in this shape also works.
${JSON.stringify(FILE_HELP.json, null, 1)}
`;
/** Makes the folder, with a short note inside for whoever opens it. */
export function ensureFolder(wsId: string, home = HOME) {
  const dir = socialFolder(wsId, home);
  fs.mkdirSync(dir, { recursive: true });
  const note = path.join(dir, "READ ME.txt");
  if (!fs.existsSync(note)) fs.writeFileSync(note, README);
  return dir;
}

/* ---------- Excel, without a library: a .xlsx is a zip of small XML files ---------- */
function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("This Excel file could not be opened. Save it again as .xlsx or as CSV.");
  let at = buf.readUInt32LE(end + 16); const count = buf.readUInt16LE(end + 10);
  for (let n = 0; n < count && at + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) break;
    const method = buf.readUInt16LE(at + 10), size = buf.readUInt32LE(at + 20), nameLen = buf.readUInt16LE(at + 28), extra = buf.readUInt16LE(at + 30), comment = buf.readUInt16LE(at + 32), local = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString("utf8");
    at += 46 + nameLen + extra + comment;
    if (!/^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml)$/.test(name) || local + 30 > buf.length) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28), raw = buf.subarray(start, start + size);
    const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw, { maxOutputLength: 80 * 1024 * 1024 }) : null;
    if (data) out.set(name, data);
  }
  return out;
}
const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");
const textIn = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unxml(m[1])).join("");
/** Every sheet of a workbook as rows of cells. */
export function sheetsOf(buf: Buffer): unknown[][][] {
  const files = unzip(buf);
  const shared = [...(files.get("xl/sharedStrings.xml")?.toString("utf8") || "").matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((m) => textIn(m[1]));
  const sheets: unknown[][][] = [];
  for (const name of [...files.keys()].filter((n) => n.startsWith("xl/worksheets/")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const rows: unknown[][] = [];
    for (const r of files.get(name)!.toString("utf8").matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
      const row: unknown[] = [];
      for (const c of r[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /\br="([A-Z]+)\d+"/.exec(c[1])?.[1] || "", type = /\bt="(\w+)"/.exec(c[1])?.[1] || "n", inner = c[2] || "";
        const col = ref ? [...ref].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1 : row.length;
        const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        row[col] = type === "s" ? shared[Number(v)] ?? "" : type === "inlineStr" ? textIn(inner) : type === "str" || type === "b" || type === "e" ? unxml(v || "") : v == null || v === "" ? "" : Number(v);
      }
      rows.push(Array.from(row, (x) => x ?? ""));
    }
    if (rows.length) sheets.push(rows);
  }
  if (!sheets.length) throw new Error("This Excel file has no readable sheet. Save it again as .xlsx or as CSV.");
  return sheets;
}

/** Reads one file's bytes into social numbers. The kind is taken from the file's name. */
export async function readSocial(name: string, data: Buffer, at: number): Promise<SocialFile> {
  const file = path.basename(name).slice(0, 120), ext = path.extname(file).toLowerCase();
  if (!KINDS.test(file)) throw new Error("Use a CSV, Excel (.xlsx), JSON or PDF file.");
  if (data.length > MAX) throw new Error("That file is over 15 MB. Export a shorter date range.");
  if (!data.length) throw new Error("That file is empty.");
  if (ext === ".xlsx") return socialFromTables(sheetsOf(data), file, at);
  if (ext === ".json") { let j: any; try { j = JSON.parse(data.toString("utf8").replace(/^﻿/, "")); } catch { throw new Error("This JSON file could not be read. Check that it is complete."); } return socialFromJson(j, file, at); }
  if (ext === ".pdf") {
    let text = "";
    try { const { extractText, getDocumentProxy } = await import("unpdf"); const r = await extractText(await getDocumentProxy(new Uint8Array(data)), { mergePages: false }); text = (Array.isArray(r.text) ? r.text : [r.text]).join("\n"); }
    catch { throw new Error("This PDF could not be opened. Export the same report as CSV or Excel."); }
    try { return socialFromTables([tableFromText(text)], file, at); }
    catch { throw new Error("No followers or reach numbers could be read from this PDF. A CSV or Excel export always works."); }
  }
  // CSV, TSV or text. Excel on Windows often saves CSV as UTF-16.
  const text = data[0] === 0xff && data[1] === 0xfe ? data.subarray(2).toString("utf16le") : data.toString("utf8");
  return socialFromTables([tableOf(text)], file, at);
}

/** The newest readable file in the folder, if it is newer than what is already shown. */
export function newestFile(wsId: string, home = HOME): { path: string; name: string; at: number } | null {
  const dir = socialFolder(wsId, home);
  let best: { path: string; name: string; at: number } | null = null;
  let names: string[] = [];
  try { names = fs.readdirSync(dir); } catch { return null; }
  for (const name of names) {
    if (!KINDS.test(name) || name.startsWith(".") || name.startsWith("~$") || /^read ?me/i.test(name)) continue;
    const p = path.join(dir, name);
    try { const st = fs.statSync(p); if (st.isFile() && st.size > 0 && (!best || st.mtimeMs > best.at)) best = { path: p, name, at: Math.round(st.mtimeMs) }; } catch { /* a file that went away */ }
  }
  return best;
}

/** Saves a file the person picked or dropped into the folder, under a safe name. */
export function saveUpload(wsId: string, name: string, data: Buffer, home = HOME) {
  const clean = path.basename(String(name || "metricool.csv")).replace(/[^\w .()-]+/g, "_").replace(/^\.+/, "").slice(0, 100) || "metricool.csv";
  if (!KINDS.test(clean) || /^read ?me/i.test(clean)) throw new Error("Use a CSV, Excel (.xlsx), JSON or PDF file.");
  if (data.length > MAX) throw new Error("That file is over 15 MB. Export a shorter date range.");
  const file = path.join(ensureFolder(wsId, home), clean);
  fs.writeFileSync(file, data);
  return file;
}

const busy = new Set<string>();
/** Brings the workspace up to date with its folder. Returns true when what is shown changed. A file that cannot be read is
 *  remembered with its reason, so the page can say why, and is not tried again until it changes. */
export async function refreshSocial(ws: any, home = HOME): Promise<boolean> {
  if (!ws || ws.sample || busy.has(ws.id)) return false;
  const f = newestFile(ws.id, home);
  if (!f) return false;
  if ((ws.socialFile && ws.socialFile.at >= f.at) || (ws.socialFileProblem && ws.socialFileProblem.at >= f.at) || (ws.socialFileOff || 0) >= f.at) return false;
  busy.add(ws.id);
  try {
    ws.socialFile = await readSocial(f.name, fs.readFileSync(f.path), f.at);
    delete ws.socialFileProblem;
    const cn = ws.connections?.find((x: any) => x.id === "metricool");
    if (cn && !(cn.status === "connected" && cn.account !== "From a file" && cn.account)) { cn.status = "connected"; cn.account = "From a file"; }
    if (cn && cn.account === "From a file") { cn.detail = `${f.name}, read ${new Date(f.at).toISOString().slice(0, 10)}`; cn.lastSync = f.at; }
    return true;
  } catch (e: any) {
    ws.socialFileProblem = { file: f.name, at: f.at, error: String(e?.message || e).slice(0, 240) };
    return true;
  } finally { busy.delete(ws.id); }
}

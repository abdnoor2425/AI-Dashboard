// AI made: what was saved, in the last 14 days, inside the project folders your AI apps worked in on this computer.
// The folder list comes from each app's own record of where it was opened (Claude Code, Codex, Gemini CLI, Cursor).
// Only the folder path is taken from those records. Conversations are never read, and nothing leaves this computer.
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DAY } from "../rand.ts";

const win = process.platform === "win32", mac = process.platform === "darwin";
const home = () => os.homedir();
const safe = <T,>(fn: () => T, or: T): T => { try { return fn(); } catch { return or; } };
const ls = (dir: string) => safe(() => fs.readdirSync(dir, { withFileTypes: true }), [] as fs.Dirent[]);
const mtime = (p: string) => safe(() => fs.statSync(p).mtimeMs, 0);

// The field that says which folder an AI app was opened in. Each app has its own name for it.
const CWD = /"(?:cwd|workdir|working_dir|working_directory|workingDirectory|workingDir|project_path|projectPath|project_dir|projectDir|project_root|projectRoot|workspace_path|workspacePath|workspace_root|workspaceRoot|workspace_dir|workspaceDir)"\s*:\s*"((?:[^"\\]|\\.)+)"/;
export const cwdIn = (text: string) => { const m = CWD.exec(text); return m ? safe(() => JSON.parse('"' + m[1] + '"') as string, "") : ""; };
/** Looks through a session record for the one field that says which folder the app was opened in, and stops there.
 *  Nothing else in the record is kept or shown. */
function head(file: string, max = 6 * 1024 * 1024) {
  return safe(() => {
    const fd = fs.openSync(file, "r");
    try {
      const size = 262144, b = Buffer.alloc(size); let pos = 0, tail = "";
      while (pos < max) {
        const n = fs.readSync(fd, b, 0, size, pos); if (!n) break;
        const text = tail + b.subarray(0, n).toString("utf8"), hit = cwdIn(text);
        if (hit) return `"cwd":${JSON.stringify(hit)}`;
        tail = text.slice(-600); pos += n;
      }
      return "";
    } finally { fs.closeSync(fd); }
  }, "");
}

export type Root = { dir: string; ai: string; at: number };

function claudeRoots(since: number): Root[] {
  const out: Root[] = [], base = path.join(home(), ".claude", "projects");
  // Claude Code keeps a list of the folders it was opened in, and names each session folder after the path.
  const listed = safe(() => Object.keys(JSON.parse(fs.readFileSync(path.join(home(), ".claude.json"), "utf8")).projects || {}), [] as string[]);
  const byName = new Map(listed.map((p) => [p.replace(/[^a-zA-Z0-9]/g, "-"), p]));
  for (const d of ls(base)) {
    if (!d.isDirectory()) continue;
    const known = byName.get(d.name);
    if (known) { const at = Math.max(0, ...ls(path.join(base, d.name)).filter((x) => x.name.endsWith(".jsonl")).map((x) => mtime(path.join(base, d.name, x.name)))); if (at >= since) out.push({ dir: known, ai: "Claude Code", at }); continue; }
    const files = ls(path.join(base, d.name)).filter((f) => f.isFile() && f.name.endsWith(".jsonl")).map((f) => path.join(base, d.name, f.name)).map((f) => [f, mtime(f)] as [string, number]).sort((a, b) => b[1] - a[1]);
    if (!files.length || files[0][1] < since) continue;
    const dir = cwdIn(head(files[0][0]));
    if (dir) out.push({ dir, ai: "Claude Code", at: files[0][1] });
  }
  return out;
}
function codexRoots(since: number): Root[] {
  const out: Root[] = [], base = path.join(process.env.CODEX_HOME || path.join(home(), ".codex"), "sessions");
  const walk = (dir: string, depth: number) => {
    for (const d of ls(dir)) {
      const p = path.join(dir, d.name);
      if (d.isDirectory() && depth < 4) walk(p, depth + 1);
      else if (d.isFile() && d.name.endsWith(".jsonl")) { const at = mtime(p); if (at >= since) { const dir2 = cwdIn(head(p)); if (dir2) out.push({ dir: dir2, ai: "Codex", at }); } }
    }
  };
  walk(base, 0);
  return out;
}
function cursorRoots(since: number): Root[] {
  const base = win ? path.join(process.env.APPDATA || path.join(home(), "AppData", "Roaming"), "Cursor") : mac ? path.join(home(), "Library", "Application Support", "Cursor") : path.join(home(), ".config", "Cursor");
  const out: Root[] = [], store = path.join(base, "User", "workspaceStorage");
  for (const d of ls(store)) {
    const file = path.join(store, d.name, "workspace.json"), at = Math.max(mtime(path.join(store, d.name)), mtime(file));
    if (at < since) continue;
    const folder = safe(() => JSON.parse(fs.readFileSync(file, "utf8")).folder as string, "");
    if (!folder || !folder.startsWith("file://")) continue;
    const dir = safe(() => { let p = decodeURIComponent(new URL(folder).pathname); if (win) p = p.replace(/^\/([a-zA-Z]:)/, "$1").replace(/\//g, "\\"); return p; }, "");
    if (dir) out.push({ dir, ai: "Cursor", at });
  }
  return out;
}
/** Gemini CLI names its notes folder after a fingerprint of the project path, so it can only confirm folders found another way,
 *  plus any listed in its own project list. */
function geminiRoots(since: number, known: Root[]): Root[] {
  const out: Root[] = [], base = path.join(home(), ".gemini");
  const list = safe(() => JSON.parse(fs.readFileSync(path.join(base, "projects.json"), "utf8")).projects, null as any);
  const dirs = new Set<string>([...known.map((r) => r.dir), ...(list && typeof list === "object" ? Object.keys(list) : [])]);
  for (const dir of dirs) {
    const at = mtime(path.join(base, "tmp", crypto.createHash("sha256").update(dir).digest("hex")));
    if (at >= since) out.push({ dir, ai: "Gemini CLI", at });
  }
  return out;
}

/** Hermes, Grok, Muse Code and any other command-line AI: each keeps session records in its own folder in the home folder.
 *  The newest records are looked through for the one field that names the project folder. Nothing else in them is kept.
 *  Folders where the app saves what it makes (pictures, videos, documents) are taken as they are. */
const OTHER_AIS: [string, string][] = [["Hermes", ".hermes"], ["Grok", ".grok"], ["Muse Code", ".muse"], ["Gemini CLI", ".gemini"], ["Codex", ".codex"]];
const MADE_HERE = ["outputs", "output", "artifacts", "generated", "generated_images", "images", "media", "videos", "exports", "workspace", "scratch", path.join("cache", "scratch"), path.join("cache", "images"), path.join("cache", "media")];
export function otherRoots(since: number, h = home()): Root[] {
  const out: Root[] = [];
  for (const [ai, folder] of OTHER_AIS) {
    const base = ai === "Codex" && process.env.CODEX_HOME ? process.env.CODEX_HOME : path.join(h, folder);
    if (!safe(() => fs.statSync(base).isDirectory(), false)) continue;
    const records: [string, number][] = []; let seen = 0;
    const walk = (dir: string, depth: number) => {
      for (const d of ls(dir)) {
        if (seen > 6000) return;
        const p = path.join(dir, d.name);
        if (d.isDirectory()) { if (depth < 5 && !/^(node_modules|venv|\.venv|site-packages|bin|lib|skills|plugins|extensions|backups|logs?)$/i.test(d.name)) walk(p, depth + 1); continue; }
        if (!d.isFile() || !/\.(jsonl|json|ndjson)$/i.test(d.name)) continue;
        seen++; const at = mtime(p); if (at >= since) records.push([p, at]);
      }
    };
    walk(base, 0);
    for (const [file, at] of records.sort((a, b) => b[1] - a[1]).slice(0, 200)) { const dir = cwdIn(head(file, 1024 * 1024)); if (dir && path.isAbsolute(dir)) out.push({ dir, ai, at }); }
    for (const sub of MADE_HERE) { const dir = path.join(base, sub), at = mtime(dir); if (at && safe(() => fs.statSync(dir).isDirectory(), false)) out.push({ dir, ai, at: Math.max(at, since) }); }
  }
  return out;
}

/** Folders that are too broad to be one project, or that are not the owner's work. */
function tooWide(dir: string) {
  const d = path.resolve(dir), h = path.resolve(home());
  if (d === h || d === path.parse(d).root || path.dirname(d) === path.parse(d).root) return true;
  const rel = path.relative(h, d).split(path.sep)[0].toLowerCase();
  if (!path.relative(h, d).includes(path.sep) && ["desktop", "documents", "downloads", "pictures", "videos", "movies", "music", "onedrive", "library", "appdata"].includes(rel)) return true;
  return d.startsWith(os.tmpdir()) || /[\\/](node_modules|\.git|\.cache|AppData|Library[\\/]Caches)([\\/]|$)/i.test(d);
}

/** Every project folder an AI app was used in since `since`, newest first, one row per folder and AI. */
export function findRoots(since: number): Root[] {
  const found = [...claudeRoots(since), ...codexRoots(since), ...cursorRoots(since), ...otherRoots(since)];
  const all = [...found, ...geminiRoots(since, found)].filter((r) => !tooWide(r.dir) && safe(() => fs.statSync(r.dir).isDirectory(), false));
  const best = new Map<string, Root>();
  for (const r of all) { const k = r.ai + "|" + path.resolve(r.dir); const o = best.get(k); if (!o || o.at < r.at) best.set(k, { ...r, dir: path.resolve(r.dir) }); }
  return [...best.values()].sort((a, b) => b.at - a.at).slice(0, 60);
}

const TYPES: [string, RegExp][] = [
  ["image", /\.(png|jpe?g|webp|gif|svg|avif)$/i], ["video", /\.(mp4|mov|webm|m4v)$/i], ["site", /\.html?$/i],
  ["doc", /\.(md|mdx|pdf|docx?|pptx?|xlsx?|csv|txt|rtf)$/i], ["code", /\.(tsx?|jsx?|mjs|cjs|py|rb|go|rs|java|kt|swift|php|cs|css|scss|sql|sh|ps1|json|ya?ml|toml|vue|svelte|ipynb)$/i],
];
export const typeOf = (name: string) => TYPES.find(([, re]) => re.test(name))?.[0] || "";
const SKIP = /^(node_modules|dist|build|out|target|vendor|venv|env|__pycache__|coverage|tmp|temp|cache|logs?|Pods|DerivedData|bower_components|site-packages)$/i;
const DULL = /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|tsconfig.*\.json|next-env\.d\.ts|thumbs\.db|desktop\.ini)$|\.(min\.(js|css)|map|log|lock|d\.ts)$/i;
export const idOf = (file: string) => "m" + crypto.createHash("sha1").update(file).digest("hex").slice(0, 14);

/** Files changed in one folder since `since`. Hidden folders, installs and build output are skipped. */
export function listFiles(root: string, since: number, cap = 1500) {
  const out: { path: string; at: number; size: number; type: string }[] = [];
  let seen = 0;
  const walk = (dir: string, depth: number) => {
    for (const d of ls(dir)) {
      if (seen > 20000 || out.length >= cap) return;
      if (d.name.startsWith(".") || d.isSymbolicLink()) continue;
      const p = path.join(dir, d.name);
      if (d.isDirectory()) { if (depth < 6 && !SKIP.test(d.name)) walk(p, depth + 1); continue; }
      if (!d.isFile()) continue;
      seen++;
      const type = typeOf(d.name);
      if (!type || DULL.test(d.name)) continue;
      const st = safe(() => fs.statSync(p), null as fs.Stats | null);
      if (st && st.mtimeMs >= since && st.size > 0) out.push({ path: p, at: Math.round(st.mtimeMs), size: st.size, type });
    }
  };
  walk(root, 0);
  return out;
}

const pretty = (dir: string) => path.basename(dir).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || dir;

/** The whole look: find the folders, list what changed, keep the newest. Pictures and videos are kept ahead of code. */
export function scanMade(now: number, rootsIn?: Root[]) {
  const since = now - 14 * DAY, roots = rootsIn || findRoots(since);
  const byDir = new Map<string, Root[]>();
  for (const r of roots) byDir.set(r.dir, [...(byDir.get(r.dir) || []), r]);
  // A folder inside another found folder is listed once, under the deeper one.
  const dirs = [...byDir.keys()].sort((a, b) => b.length - a.length), taken = new Set<string>(), items: any[] = [];
  const projects = new Map<string, { name: string; ai: Set<string>; dir: string }>();
  for (const dir of dirs) {
    const ais = byDir.get(dir)!.sort((a, b) => b.at - a.at).map((r) => r.ai), ai = ais[0];
    // A folder with no project file of its own is a shelf of projects: each folder inside it is listed under its own name.
    const shelf = ![".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod", "CLAUDE.md", "AGENTS.md", "GEMINI.md"].some((m) => fs.existsSync(path.join(dir, m)));
    for (const f of listFiles(dir, since)) {
      if (taken.has(f.path)) continue;
      taken.add(f.path);
      const first = path.relative(dir, f.path).split(path.sep), home2 = shelf && first.length > 1 ? path.join(dir, first[0]) : dir;
      const p = projects.get(home2) || { name: pretty(home2), ai: new Set<string>(), dir: home2 };
      for (const a of ais) p.ai.add(a); projects.set(home2, p);
      items.push({ id: idOf(f.path), title: path.basename(f.path), type: f.type, ai, project: p.name, path: f.path, at: Math.min(f.at, now), size: f.size });
    }
  }
  const rank = (x: any) => (x.type === "image" || x.type === "video" ? 0 : x.type === "site" || x.type === "doc" ? 1 : 2);
  const media = items.filter((x) => rank(x) === 0).sort((a, b) => b.at - a.at).slice(0, 500);
  const rest = items.filter((x) => rank(x) > 0).sort((a, b) => rank(a) - rank(b) || b.at - a.at).slice(0, 700);
  return {
    when: now, items: [...media, ...rest].sort((a, b) => b.at - a.at),
    roots: [...projects.values()].map((p) => ({ name: p.name, ai: [...p.ai].join(" and "), dir: p.dir })),
  };
}

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", avif: "image/avif" };
/** A picture from the list, for its thumbnail. Only files the scan found, only pictures, and only up to 20 MB. */
export function readPicture(made: any, id: string) {
  const it = (made?.items || []).find((x: any) => x.id === id && x.type === "image");
  if (!it) return null;
  const type = MIME[path.extname(it.path).slice(1).toLowerCase()];
  const st = safe(() => fs.statSync(it.path), null as fs.Stats | null);
  if (!type || !st || !st.isFile() || st.size > 20 * 1024 * 1024) return null;
  return safe(() => ({ type, data: fs.readFileSync(it.path) }), null as { type: string; data: Buffer } | null);
}

/** Kinds of file that are safe to hand to the computer's default app. Anything that could run as a program opens its folder instead. */
const OPENABLE = /\.(png|jpe?g|webp|gif|avif|mp4|mov|webm|m4v|pdf|md|txt|csv|docx?|pptx?|xlsx?|html?)$/i;
const start = (cmd: string, args: string[]) => new Promise<void>((resolve) => { const c = execFile(cmd, args, { windowsHide: false }, () => resolve()); c.on("error", () => resolve()); setTimeout(resolve, 1500); });

/** Hands one file to the computer: its own app for a document or picture, its folder for anything else. */
export async function openPath(file0: string, how: string) {
  const file = how === "file" && OPENABLE.test(file0);
  if (win) await start("explorer.exe", file ? [file0] : ["/select," + file0]);
  else if (mac) await start("open", file ? [file0] : ["-R", file0]);
  else await start("xdg-open", [file ? file0 : path.dirname(file0)]);
  return { ok: true, opened: file ? "file" : "folder", note: how === "file" && !file ? "This kind of file opens in its folder, so nothing runs by accident." : "" };
}

/** Opens a found file, or shows it in its folder. Returns what happened in words. */
export async function openMade(made: any, id: string, how: string) {
  const it = (made?.items || []).find((x: any) => x.id === id);
  if (!it) throw new Error("That file is no longer in the list. Look again to refresh it.");
  if (!fs.existsSync(it.path)) throw new Error("That file has been moved or deleted since the last look.");
  return openPath(it.path, how);
}

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { HOME } from "./store.ts";

const MAX_SOURCES = 8;
const MAX_NODES = 6000;
const MAX_ENTRIES = 30000;
const MAX_DEPTH = 20;
const MAX_TEXT = 128 * 1024;
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCES = 4000;
const TEXT = new Set(".md .mdx .markdown .txt .rst .json .jsonl .yaml .yml .toml .csv .tsv .log .js .jsx .ts .tsx .mjs .cjs .py .rb .go .rs .java .kt .cs .c .cpp .h .css .scss .html .xml .sql .sh .ps1 .ini".split(" "));
const EXCLUDED = /^(?:\.|node_modules$|vendor$|dist$|build$|coverage$|__pycache__$|recycle\.bin$|system volume information$|sapassword|id_(?:rsa|dsa|ecdsa|ed25519)|(?:.*[._ -])?(?:secrets?|credentials?|passwords?|tokens?|private[._ -]?keys?|api[._ -]?keys?|service[._ -]?accounts?|oauth)(?:[._ -]|$))|\.(?:key|pem|p12|pfx|jks|kdbx|ppk|keystore)$/i;

export class BrainError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// A source is either a whole WorkOS (every folder inside it is a project) or one project folder on its own.
type Kind = "workos" | "project";
type Source = { id: string; name: string; path: string; kind?: Kind; excluded?: string[]; indexedAt: number; fileCount: number; skipped: number; warnings: string[] };
type Node = { id: string; sourceId: string; name: string; path: string; kind: "folder" | "file"; extension: string; size: number; modifiedAt: number; readable: boolean };
type Link = { source: string; target: string; kind: "contains" | "reference" | "mention" };
type Indexed = { source: Source; nodes: Node[]; links: Link[] };

const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);
const normalize = (value: string) => process.platform === "win32" ? value.toLowerCase() : value;
const equal = (left: string, right: string) => normalize(left) === normalize(right);
const within = (root: string, candidate: string) => {
  const relative = path.relative(normalize(root), normalize(candidate));
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep));
};

function sourceRoot(value: unknown, home: string) {
  // Windows "Copy as path" wraps the path in quotes, so take them off.
  if (typeof value === "string") value = value.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  if (typeof value !== "string" || value.length > 4096 || !path.isAbsolute(value)) {
    throw new BrainError("Paste the folder's full path, for example " + (process.platform === "win32" ? "C:\\Users\\you\\Documents\\WorkOS." : "/Users/you/Documents/WorkOS."));
  }
  const raw = value;
  if (/^(?:[\\/]{2}|[a-z]:[^\\/]|[\\/](?![\\/]))/i.test(raw) && process.platform === "win32") {
    throw new BrainError("Enter a local folder path with a drive letter.");
  }
  if (raw.split(/[\\/]/).includes("..") || (process.platform === "win32" && raw.slice(2).includes(":"))) {
    throw new BrainError("Enter the folder's absolute path without parent-directory segments or stream names.");
  }

  const root = path.resolve(raw);
  const system = [
    process.env.SystemRoot, process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.ProgramData,
    process.env.APPDATA, process.env.LOCALAPPDATA,
    ...(process.platform === "win32" ? [] : ["/etc", "/proc", "/dev", "/sys", "/boot", "/run", "/root", "/usr", "/var/lib", "/var/run", "/System", "/Library"]),
    path.resolve(home),
  ].filter(Boolean);
  if (root === path.parse(root).root || equal(root, path.resolve(os.tmpdir())) || within(root, os.homedir())
      || system.some(base => within(base, root) || within(root, base))
      || root.slice(path.parse(root).root.length).split(path.sep).some(part => EXCLUDED.test(part))) {
    throw new BrainError("Choose a specific project folder outside system and private data directories.");
  }
  try {
    const info = fs.lstatSync(root);
    if (!info.isDirectory() || info.isSymbolicLink() || !equal(root, fs.realpathSync(root))) throw new Error();
    return root;
  } catch {
    throw new BrainError("That folder could not be found or opened. Check the path, or pick the real folder rather than a shortcut.");
  }
}

function localStat(file: string) {
  const info = fs.lstatSync(file);
  if (info.isSymbolicLink() || !equal(file, fs.realpathSync(file)) || (info.isFile() && info.nlink > 1)) return null;
  return info;
}

function readText(file: string, info: fs.Stats) {
  if (info.size > MAX_TEXT) return null;
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.nlink > 1 || opened.ino !== info.ino || opened.dev !== info.dev || !equal(file, fs.realpathSync(file))) return null;
    const buffer = Buffer.alloc(MAX_TEXT + 1);
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (!count) break;
      length += count;
    }
    const bytes = buffer.subarray(0, length);
    if (length > MAX_TEXT || bytes.includes(0)) return null;
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return null; }
  } finally {
    fs.closeSync(fd);
  }
}

function scan(id: string, name: string, root: string, kind: Kind = "project", excluded: string[] = []): Indexed {
  const source: Source = { id, name, path: root, kind, excluded, indexedAt: Date.now(), fileCount: 0, skipped: 0, warnings: [] };
  const leftOut = new Set(excluded.map(normalize));
  const notes: { node: Node; content: string }[] = [];
  const nodes: Node[] = [];
  const links: Link[] = [];
  const markdown: { node: Node; content: string }[] = [];
  let entries = 0;
  let referenceBytes = 0;
  let limited = false;
  let readsFailed = false;
  let referenceLimited = false;

  function visit(file: string, relative: string, parent?: Node, depth = 0) {
    if (++entries > MAX_ENTRIES || nodes.length >= MAX_NODES || depth > MAX_DEPTH) {
      source.skipped++;
      limited = true;
      return;
    }
    if (relative && EXCLUDED.test(path.basename(file))) {
      source.skipped++;
      return;
    }
    if (relative && leftOut.has(normalize(relative))) return; // left out on the Edit page: not a skip, a choice
    try {
      const info = localStat(file);
      if (!info || (!info.isDirectory() && !info.isFile())) {
        source.skipped++;
        return;
      }
      const folder = info.isDirectory();
      const extension = folder ? "" : path.extname(file).toLowerCase();
      const node: Node = { id: digest(id + "\0" + relative), sourceId: id, name: relative ? path.basename(file) : name, path: relative, kind: folder ? "folder" : "file",
        extension, size: folder ? 0 : info.size, modifiedAt: info.mtimeMs, readable: !folder && TEXT.has(extension) && info.size <= MAX_TEXT };
      nodes.push(node);
      if (parent) links.push({ source: parent.id, target: node.id, kind: "contains" });
      if (!folder) {
        source.fileCount++;
        if (node.readable && [".md", ".mdx", ".markdown", ".txt"].includes(extension)) {
          if (referenceBytes + info.size > MAX_REFERENCE_BYTES) referenceLimited = true;
          else {
            referenceBytes += info.size;
            const content = readText(file, info);
            if (content === null) node.readable = false;
            else { if (extension !== ".txt") markdown.push({ node, content }); notes.push({ node, content }); }
          }
        }
        return;
      }
      const dir = fs.opendirSync(file);
      try {
        let child: fs.Dirent | null;
        while ((child = dir.readSync()) !== null) {
          if (entries >= MAX_ENTRIES || nodes.length >= MAX_NODES) {
            source.skipped++;
            limited = true;
            break;
          }
          visit(path.join(file, child.name), relative ? relative + "/" + child.name : child.name, node, depth + 1);
        }
      } finally {
        dir.closeSync();
      }
    } catch {
      if (!parent) throw new BrainError("The selected folder could not be read.", 422);
      source.skipped++;
      readsFailed = true;
    }
  }

  visit(root, "");
  if (!nodes.length) throw new BrainError("The selected folder could not be read.", 422);
  if (limited) source.warnings.push("The scan stopped at its entry, folder depth, or index limit.");
  if (readsFailed) source.warnings.push("Some entries could not be read.");
  const byPath = new Map(nodes.map(node => [normalize(node.path), node]));
  const wiki = new Map<string, Node | null>();
  for (const node of nodes) {
    if (node.kind !== "file") continue;
    const key = normalize(path.posix.basename(node.path, path.posix.extname(node.path)));
    wiki.set(key, wiki.has(key) ? null : node);
  }
  let references = 0;
  for (const { node, content } of markdown) {
    const seen = new Set<string>();
    for (const match of content.matchAll(/\[\[([^\]\n]+)\]\]|!?\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g)) {
      let targetPath = (match[1] || match[2] || match[3]).split(match[1] ? /[|#]/ : /[?#]/)[0].trim();
      try { targetPath = decodeURIComponent(targetPath); } catch { continue; }
      if (!targetPath || /^(?:[a-z][a-z0-9+.-]*:|[\\/])/i.test(targetPath) || targetPath.includes("\\")) continue;
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(node.path), targetPath)).replace(/\/$/, "");
      if (relative === ".." || relative.startsWith("../")) continue;
      const normalized = normalize(relative === "." ? "" : relative);
      const target = byPath.get(normalized) || (match[1] && (byPath.get(normalized + ".md") || byPath.get(normalize(targetPath))
        || byPath.get(normalize(targetPath) + ".md") || wiki.get(normalize(targetPath))));
      if (target && target.id !== node.id && !seen.has(target.id)) {
        seen.add(target.id);
        links.push({ source: node.id, target: target.id, kind: "reference" });
        if (++references >= MAX_REFERENCES) { referenceLimited = true; break; }
      }
    }
    if (references >= MAX_REFERENCES) break;
  }
  // A note that names another project is connected to it, even without a link. This is what ties projects together.
  if (kind === "workos") {
    const projects = nodes.filter(node => node.kind === "folder" && node.path && !node.path.includes("/") && node.name.replace(/^[\d\s._-]+/, "").trim().length >= 4);
    const linked = new Set(links.filter(link => link.kind === "reference").map(link => link.source + ">" + link.target));
    for (const { node, content } of notes) {
      if (references >= MAX_REFERENCES) { referenceLimited = true; break; }
      const text = content.toLowerCase();
      const home = node.path.split("/")[0];
      for (const project of projects) {
        if (project.path === home || linked.has(node.id + ">" + project.id)) continue;
        const name = project.name.replace(/^[\d\s._-]+/, "").trim().toLowerCase();
        const at = text.indexOf(name);
        if (at < 0 || /[a-z0-9]/.test(text[at - 1] || "") || /[a-z0-9]/.test(text[at + name.length] || "")) continue;
        links.push({ source: node.id, target: project.id, kind: "mention" });
        references++;
      }
    }
  }
  if (referenceLimited) source.warnings.push("Some Markdown references were skipped at the reference limit.");
  return { source, nodes, links };
}

const dataFile = (workspaceId: string, home: string) => path.join(home, "brain-" + digest(workspaceId) + ".json");

function load(workspaceId: string, home: string): Indexed[] {
  try {
    const value = JSON.parse(fs.readFileSync(dataFile(workspaceId, home), "utf8"));
    if (value.version !== 1 || !Array.isArray(value.indexes)) throw new Error();
    return value.indexes;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new BrainError("AI-Dashboard could not read this workspace's Second Brain index.", 500);
  }
}

function save(workspaceId: string, indexes: Indexed[], home: string) {
  const file = dataFile(workspaceId, home);
  const temporary = file + "." + randomUUID() + ".tmp";
  try {
    fs.mkdirSync(home, { recursive: true, mode: 0o700 });
    fs.writeFileSync(temporary, JSON.stringify({ version: 1, indexes }), { mode: 0o600, flag: "wx" });
    fs.renameSync(temporary, file);
  } catch {
    throw new BrainError("AI-Dashboard could not save this workspace's Second Brain index.", 500);
  } finally {
    try { fs.rmSync(temporary, { force: true }); } catch {}
  }
}

type Project = { id: string; sourceId: string; name: string; path: string; files: number; folders: number; modifiedAt: number };

/** Which project every entry belongs to. In a WorkOS, each top-level folder is a project and loose files belong to the WorkOS itself. */
function projectsOf(index: Indexed) {
  const kind = index.source.kind || "project";
  const root = index.nodes.find(node => !node.path) || index.nodes[0];
  const top = new Map(index.nodes.filter(node => node.kind === "folder" && node.path && !node.path.includes("/")).map(node => [node.path, node]));
  const stats = new Map<string, Project>();
  const nodes = index.nodes.map(node => {
    const owner = kind === "workos" ? top.get(node.path.split("/")[0]) || root : root;
    let project = stats.get(owner.id);
    if (!project) stats.set(owner.id, project = { id: owner.id, sourceId: index.source.id, name: owner.name, path: owner.path, files: 0, folders: 0, modifiedAt: 0 });
    if (node.kind === "file") { project.files++; project.modifiedAt = Math.max(project.modifiedAt, node.modifiedAt); }
    else if (node.id !== owner.id) project.folders++;
    return { ...node, project: owner.id };
  });
  // A WorkOS with no loose files is not itself a project: it is the core everything hangs from.
  if (kind === "workos" && stats.size > 1 && !stats.get(root.id)?.files) stats.delete(root.id);
  return { nodes, projects: [...stats.values()] };
}

function view(indexes: Indexed[]) {
  const parts = indexes.map(projectsOf);
  const sources = indexes.map(index => ({ ...index.source, kind: index.source.kind || "project", excluded: index.source.excluded || [] }));
  return { sources, projects: parts.flatMap(part => part.projects), nodes: parts.flatMap(part => part.nodes), links: indexes.flatMap(index => index.links) };
}

/** A short, content-free outline for Ask your AI: project names, sizes and which projects connect. Never file contents. */
export function brainSummary(workspaceId: string, home = HOME) {
  let brain: ReturnType<typeof view>;
  try { brain = view(load(workspaceId, home)); } catch { return null; }
  if (!brain.sources.length) return null;
  const owner = new Map(brain.nodes.map(node => [node.id, node.project]));
  const names = new Map(brain.projects.map(project => [project.id, project.name]));
  const ties = new Map<string, Set<string>>();
  for (const link of brain.links) {
    const from = owner.get(link.source), to = owner.get(link.target);
    if (link.kind === "contains" || !from || !to || from === to) continue;
    for (const [a, b] of [[from, to], [to, from]]) { if (!ties.has(a)) ties.set(a, new Set()); ties.get(a)!.add(names.get(b) || ""); }
  }
  const recent = brain.nodes.filter(node => node.kind === "file").sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 12);
  return {
    sources: brain.sources.map(source => ({ name: source.name, kind: source.kind, files: source.fileCount })),
    projects: brain.projects.slice(0, 60).map(project => ({ name: project.name, files: project.files, lastChanged: new Date(project.modifiedAt).toISOString().slice(0, 10), connectedTo: [...(ties.get(project.id) || [])].filter(Boolean).slice(0, 12) })),
    recentlyChanged: recent.map(node => ({ file: node.name, project: names.get(node.project) || "", changed: new Date(node.modifiedAt).toISOString().slice(0, 10) })),
  };
}

/** Folders the owner can pick from on the Edit page. Names only, never file contents. */
export function browseFolders(value: unknown) {
  const start = typeof value === "string" && value.trim() && path.isAbsolute(value.trim()) && !value.split(/[\\/]/).includes("..") ? path.resolve(value.trim()) : os.homedir();
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(start, { withFileTypes: true }); } catch { throw new BrainError("That folder could not be opened.", 404); }
  const folders = entries.filter(entry => entry.isDirectory() && !EXCLUDED.test(entry.name) && !entry.name.startsWith("$"))
    .map(entry => ({ name: entry.name, path: path.join(start, entry.name) })).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 400);
  const parent = path.dirname(start);
  return { path: start, name: path.basename(start) || start, parent: parent === start ? null : parent, home: os.homedir(), folders };
}

export function dropBrain(workspaceId: string, home = HOME) {
  fs.rmSync(dataFile(workspaceId, home), { force: true });
}

export function getBrain(workspaceId: string, home = HOME) {
  return view(load(workspaceId, home));
}

export function getBrainNode(workspaceId: string, id: string, home = HOME) {
  for (const index of load(workspaceId, home)) {
    const node = index.nodes.find(item => item.id === id);
    if (!node) continue;
    let content: string | null = null;
    if (node.readable) {
      const root = sourceRoot(index.source.path, home);
      const parts = node.path.split("/");
      const file = path.resolve(root, ...parts);
      if (parts.some(part => !part || part === ".." || EXCLUDED.test(part)) || !within(root, file)) {
        throw new BrainError("This file is outside the indexed folder.", 404);
      }
      try {
        const info = localStat(file);
        if (info?.isFile()) content = readText(file, info);
        else throw new Error();
      } catch {
        throw new BrainError("This file is no longer available. Rescan its folder to refresh the index.", 404);
      }
    }
    return { node, content };
  }
  throw new BrainError("This item is not in the selected workspace.", 404);
}

export function changeBrain(workspaceId: string, body: { action?: unknown; path?: unknown; name?: unknown; sourceId?: unknown; kind?: unknown; leftOut?: unknown }, home = HOME) {
  const indexes = load(workspaceId, home);
  if (body.action === "connect") {
    const root = sourceRoot(body.path, home);
    if (indexes.some(index => within(index.source.path, root) || within(root, index.source.path))) {
      throw new BrainError("This folder is already part of your Second Brain: it sits inside a source you connected, or contains one.", 409);
    }
    if (indexes.length >= MAX_SOURCES) throw new BrainError("This workspace has reached its folder limit.");
    const name = (typeof body.name === "string" && body.name.trim().slice(0, 100)) || path.basename(root);
    indexes.push(scan(randomUUID(), name, root, body.kind === "workos" ? "workos" : "project"));
  } else if (body.action === "rescan" || body.action === "disconnect" || body.action === "leave-out") {
    const position = indexes.findIndex(index => index.source.id === body.sourceId);
    if (position < 0) throw new BrainError("This folder is not connected to the selected workspace.", 404);
    const { id, name, path: folder, kind, excluded = [] } = indexes[position].source;
    if (body.action === "disconnect") indexes.splice(position, 1);
    else {
      let next = excluded;
      if (body.action === "leave-out") {
        // Leave a folder inside this source out of the Second Brain, or bring it back. The folder itself is never touched.
        const relative = typeof body.path === "string" ? body.path.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") : "";
        if (!relative || relative.length > 1024 || relative.split("/").some(part => !part || part === "." || part === "..")) throw new BrainError("Choose a folder inside this source.");
        next = excluded.filter(item => normalize(item) !== normalize(relative));
        if (body.leftOut !== false) next = [...next, relative].slice(-200);
      }
      indexes[position] = scan(id, name, sourceRoot(folder, home), kind || "project", next);
    }
  } else {
    throw new BrainError("Choose connect, rescan, leave-out, or disconnect.");
  }
  save(workspaceId, indexes, home);
  return view(indexes);
}

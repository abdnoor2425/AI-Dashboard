import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { HOME } from "./store.ts";

const MAX_SOURCES = 8;
const MAX_NODES = 2000;
const MAX_ENTRIES = 10000;
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

type Source = { id: string; name: string; path: string; indexedAt: number; fileCount: number; skipped: number; warnings: string[] };
type Node = { id: string; sourceId: string; name: string; path: string; kind: "folder" | "file"; extension: string; size: number; modifiedAt: number; readable: boolean };
type Link = { source: string; target: string; kind: "contains" | "reference" };
type Indexed = { source: Source; nodes: Node[]; links: Link[] };

const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);
const normalize = (value: string) => process.platform === "win32" ? value.toLowerCase() : value;
const equal = (left: string, right: string) => normalize(left) === normalize(right);
const within = (root: string, candidate: string) => {
  const relative = path.relative(normalize(root), normalize(candidate));
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep));
};

function sourceRoot(value: unknown, home: string) {
  if (typeof value !== "string" || value.length > 4096 || !path.isAbsolute(value.trim())) {
    throw new BrainError("Enter an absolute folder path on the computer running Keystone.");
  }
  const raw = value.trim();
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
    throw new BrainError("The folder is unavailable, unreadable, or reached through a link.");
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

function scan(id: string, name: string, root: string): Indexed {
  const source: Source = { id, name, path: root, indexedAt: Date.now(), fileCount: 0, skipped: 0, warnings: [] };
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
        if (node.readable && [".md", ".mdx", ".markdown"].includes(extension)) {
          if (referenceBytes + info.size > MAX_REFERENCE_BYTES) referenceLimited = true;
          else {
            referenceBytes += info.size;
            const content = readText(file, info);
            if (content === null) node.readable = false;
            else markdown.push({ node, content });
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
    throw new BrainError("Keystone could not read this workspace's Second Brain index.", 500);
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
    throw new BrainError("Keystone could not save this workspace's Second Brain index.", 500);
  } finally {
    try { fs.rmSync(temporary, { force: true }); } catch {}
  }
}

function view(indexes: Indexed[]) {
  const sources = indexes.map(index => index.source);
  return { sources, projects: sources, nodes: indexes.flatMap(index => index.nodes), links: indexes.flatMap(index => index.links) };
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

export function changeBrain(workspaceId: string, body: { action?: unknown; path?: unknown; name?: unknown; sourceId?: unknown }, home = HOME) {
  const indexes = load(workspaceId, home);
  if (body.action === "connect") {
    const root = sourceRoot(body.path, home);
    if (indexes.some(index => within(index.source.path, root) || within(root, index.source.path))) {
      throw new BrainError("This folder overlaps a source already connected to this workspace.", 409);
    }
    if (indexes.length >= MAX_SOURCES) throw new BrainError("This workspace has reached its folder limit.");
    const name = (typeof body.name === "string" && body.name.trim().slice(0, 100)) || path.basename(root);
    indexes.push(scan(randomUUID(), name, root));
  } else if (body.action === "rescan" || body.action === "disconnect") {
    const position = indexes.findIndex(index => index.source.id === body.sourceId);
    if (position < 0) throw new BrainError("This folder is not connected to the selected workspace.", 404);
    const { id, name, path: folder } = indexes[position].source;
    if (body.action === "rescan") indexes[position] = scan(id, name, sourceRoot(folder, home));
    else indexes.splice(position, 1);
  } else {
    throw new BrainError("Choose connect, rescan, or disconnect.");
  }
  save(workspaceId, indexes, home);
  return view(indexes);
}

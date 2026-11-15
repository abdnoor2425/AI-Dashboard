// Second Brain: the shapes the page works with, and the facts worked out from an index.
// A WorkOS is folders of projects. Inside each project are its files, and the connections between them.

export type BrainSource = { id: string; name: string; path: string; kind: "workos" | "project"; excluded: string[]; indexedAt: number; fileCount: number; skipped: number; warnings: string[] };
export type BrainProject = { id: string; sourceId: string; name: string; path: string; files: number; folders: number; modifiedAt: number };
export type BrainNode = { id: string; sourceId: string; project: string; name: string; path: string; kind: "folder" | "file"; extension: string; size: number; modifiedAt: number; readable: boolean };
export type BrainLink = { source: string; target: string; kind: "contains" | "reference" | "mention" };
export type Brain = { sources: BrainSource[]; projects: BrainProject[]; nodes: BrainNode[]; links: BrainLink[]; sample?: boolean };

// One colour per project, in order. Chosen to sit on navy and stay apart from each other.
export const PROJECT_COLORS = ["#E0B663", "#6FC3A8", "#E58A6B", "#7FB2E8", "#F1E6CF", "#9CCB86", "#E7A3A0", "#5FB6C9", "#C9A46B", "#A9B7C9", "#F0C987", "#8FD0BE", "#D98F6F", "#B9CDEB"];

export type Facts = ReturnType<typeof factsOf>;

/** Everything the page needs to know about an index, worked out once. */
export function factsOf(brain: Brain) {
  const byId = new Map(brain.nodes.map((n) => [n.id, n]));
  const projects = [...brain.projects].sort((a, b) => b.files - a.files);
  const color = new Map(projects.map((p, i) => [p.id, PROJECT_COLORS[i % PROJECT_COLORS.length]]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  const out = new Map<string, BrainLink[]>(), into = new Map<string, BrainLink[]>();
  const degree = new Map<string, number>();
  // How strongly each pair of projects is connected: project -> other project -> number of links.
  const ties = new Map<string, Map<string, number>>();
  let connections = 0;
  const seen = new Set<string>();
  for (const l of brain.links) {
    const key = l.source + ">" + l.target + ">" + l.kind; if (seen.has(key)) continue; seen.add(key);
    const a = byId.get(l.source), b = byId.get(l.target);
    if (!a || !b) continue;
    if (l.kind === "contains") { parent.set(b.id, a.id); (children.get(a.id) || children.set(a.id, []).get(a.id)!).push(b.id); continue; }
    connections++;
    (out.get(a.id) || out.set(a.id, []).get(a.id)!).push(l);
    (into.get(b.id) || into.set(b.id, []).get(b.id)!).push(l);
    degree.set(a.id, (degree.get(a.id) || 0) + 1); degree.set(b.id, (degree.get(b.id) || 0) + 1);
    if (a.project !== b.project) for (const [x, y] of [[a.project, b.project], [b.project, a.project]]) {
      const m = ties.get(x) || ties.set(x, new Map()).get(x)!; m.set(y, (m.get(y) || 0) + 1);
    }
  }
  const files = brain.nodes.filter((n) => n.kind === "file");
  return { byId, projects, projectById, color, parent, children, out, into, degree, ties, connections, files };
}

/** Files changed in the last week, newest first. */
export const recentFiles = (f: Facts, now: number, days = 7) => f.files.filter((n) => now - n.modifiedAt < days * 86400000).sort((a, b) => b.modifiedAt - a.modifiedAt);

/** Things worth a look: projects nobody has touched in months, and projects connected to nothing else. */
export function needsLook(f: Facts, now: number) {
  const out: { id: string; name: string; why: string }[] = [];
  for (const p of f.projects) {
    const months = Math.floor((now - p.modifiedAt) / (30 * 86400000));
    if (p.files && months >= 4) out.push({ id: p.id, name: p.name, why: `Project · not touched in ${months} months` });
    else if (f.projects.length > 1 && p.files > 2 && !f.ties.get(p.id)?.size) out.push({ id: p.id, name: p.name, why: "Project · connected to nothing else" });
  }
  return out;
}

export const ago = (t: number, now: number) => {
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 60) return m <= 1 ? "just now" : `${m} minutes ago`;
  const h = Math.round(m / 60); if (h < 24) return h === 1 ? "an hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24); if (d < 31) return d === 1 ? "yesterday" : `${d} days ago`;
  const mo = Math.round(d / 30); return mo < 12 ? (mo === 1 ? "a month ago" : `${mo} months ago`) : (mo < 24 ? "a year ago" : `${Math.round(mo / 12)} years ago`);
};

export const sizeText = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);
export const kindText = (n: BrainNode) => (n.kind === "folder" ? "Folder" : ({ ".md": "Note", ".mdx": "Note", ".markdown": "Note", ".txt": "Text", ".docx": "Document", ".doc": "Document", ".pdf": "PDF", ".png": "Image", ".jpg": "Image", ".jpeg": "Image", ".xlsx": "Spreadsheet", ".csv": "Spreadsheet", ".fig": "Design", ".pptx": "Slides", ".mp4": "Video", ".mov": "Video" } as Record<string, string>)[n.extension] || (n.extension ? n.extension.slice(1).toUpperCase() + " file" : "File"));

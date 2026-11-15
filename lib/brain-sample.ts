// A made-up WorkOS for the preview and for a dashboard with nothing connected yet.
// It has the same shape as a real index, so the Second Brain page draws both the same way. Every name is fictional.
import type { Brain, BrainLink, BrainNode } from "./brain.ts";

const DAY = 86400000;
const rnd = (seed: number) => { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s ^= s >>> 16) >>> 0) / 4294967296); };

const PROJECTS: [string, string[]][] = [
  ["Platewise launch", ["Brief", "Research", "Creative", "Reels", "Reports"]],
  ["Fernway onboarding redesign", ["Brief", "User interviews", "Designs", "Copy"]],
  ["Meridian Capital landing pages", ["Brief", "Wireframes", "Copy", "Approvals"]],
  ["Lumen Dental homepage", ["Brief", "Copy", "Photos", "QA"]],
  ["Kiln & Clay checkout", ["Bug reports", "Fixes", "Reports"]],
  ["Northline Movers site", ["Pages", "Local search", "Reviews"]],
  ["Atlas Notes newsletter", ["Issues", "Ideas", "Sponsors"]],
  ["Brightdesk help centre", ["Articles", "Saved replies"]],
  ["Brand voice", ["Guides", "Examples"]],
  ["Playbooks", ["Launches", "Clients", "Reels", "Reporting"]],
  ["Meeting notes", ["Weekly", "Clients", "Planning"]],
  ["Team", ["People", "Hiring"]],
  ["Finance and admin", ["Invoices", "Budgets", "Contracts"]],
];
// Which projects lean on which. The sample draws real-looking links along these lines.
const TIES: [number, number[]][] = [[0, [8, 9, 10, 11, 12]], [1, [8, 10, 11]], [2, [8, 9, 10, 12]], [3, [9, 10, 2]], [4, [10, 11, 9]], [5, [9, 8]], [6, [8, 0, 12]], [7, [9, 1]], [9, [8]], [10, [11]], [12, [11]]];
const WORDS = ["plan", "notes", "draft", "summary", "checklist", "review", "outline", "feedback", "timeline", "ideas", "results", "handover", "questions", "scope", "v2", "final", "options", "risks", "budget", "copy"];
const EXT = [".md", ".md", ".md", ".md", ".md", ".docx", ".pdf", ".png", ".xlsx", ".txt"];

export function sampleBrain(now: number): Brain & { sample: true } {
  const r = rnd(42);
  const nodes: BrainNode[] = [];
  const links: BrainLink[] = [];
  const notesOf: BrainNode[][] = [];
  const add = (n: Omit<BrainNode, "size" | "modifiedAt" | "readable"> & { age?: number }, parent?: string) => {
    const file = n.kind === "file";
    const node: BrainNode = { ...n, size: file ? 800 + Math.floor(r() * 40000) : 0, modifiedAt: now - (n.age ?? 30) * DAY, readable: file && [".md", ".txt"].includes(n.extension) };
    nodes.push(node); if (parent) links.push({ source: parent, target: node.id, kind: "contains" });
    return node;
  };
  const root = add({ id: "s1", sourceId: "src-workos", project: "s1", name: "WorkOS", path: "", kind: "folder", extension: "" });
  PROJECTS.forEach(([name, folders], pi) => {
    const pid = "p" + pi;
    const lively = pi < 5 ? 1 : pi < 9 ? 4 : 2.2; // how recently this project has been worked on
    add({ id: pid, sourceId: "src-workos", project: pid, name, path: name, kind: "folder", extension: "" }, root.id);
    const notes: BrainNode[] = [];
    const file = (folder: string, parent: string, label: string, ext: string, i: number) => {
      const age = pi === 7 ? 190 + r() * 200 : Math.pow(r(), 2.2) * 150 * lively + (r() < 0.12 ? 0.3 : 1);
      const n = add({ id: `${pid}-${folder}-${i}`.replace(/\s+/g, "_"), sourceId: "src-workos", project: pid, name: label + ext, path: `${name}/${folder ? folder + "/" : ""}${label}${ext}`, kind: "file", extension: ext, age }, parent);
      if (n.readable) notes.push(n);
    };
    file("", pid, "README", ".md", 0);
    folders.forEach((f, fi) => {
      const fid = `${pid}f${fi}`;
      add({ id: fid, sourceId: "src-workos", project: pid, name: f, path: `${name}/${f}`, kind: "folder", extension: "" }, pid);
      const count = 9 + Math.floor(r() * 12);
      for (let i = 0; i < count; i++) file(f, fid, `${f.split(" ")[0]} ${WORDS[Math.floor(r() * WORDS.length)]} ${i + 1}`, EXT[Math.floor(r() * EXT.length)], i);
    });
    notes.forEach((n, i) => { for (let k = 0; k < 2; k++) if (i && r() < 0.6) links.push({ source: n.id, target: notes[Math.floor(r() * i)].id, kind: "reference" }); });
    notesOf.push(notes);
  });
  for (const [from, tos] of TIES) for (const to of tos) {
    const a = notesOf[from], b = notesOf[to];
    const n = 4 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) links.push({ source: a[Math.floor(r() * a.length)].id, target: b[Math.floor(r() * b.length)].id, kind: "reference" });
    links.push({ source: a[Math.floor(r() * a.length)].id, target: "p" + to, kind: "mention" });
  }
  // A second source: one project folder that lives outside the WorkOS.
  const lib = add({ id: "s2", sourceId: "src-reels", project: "s2", name: "Reel library", path: "", kind: "folder", extension: "" });
  const reelNotes: BrainNode[] = [];
  ["Scripts", "Hooks", "Scorecards"].forEach((f, fi) => {
    const fid = "s2f" + fi;
    add({ id: fid, sourceId: "src-reels", project: "s2", name: f, path: f, kind: "folder", extension: "" }, lib.id);
    for (let i = 0; i < 16; i++) { const n = add({ id: `s2-${fi}-${i}`, sourceId: "src-reels", project: "s2", name: `${f.slice(0, -1)} ${i + 1}.md`, path: `${f}/${f.slice(0, -1)} ${i + 1}.md`, kind: "file", extension: ".md", age: Math.pow(r(), 2) * 60 + 0.5 }, fid); reelNotes.push(n); }
  });
  reelNotes.forEach((n, i) => { if (i && r() < 0.5) links.push({ source: n.id, target: reelNotes[Math.floor(r() * i)].id, kind: "reference" }); });

  const count = (src: string) => nodes.filter((n) => n.sourceId === src && n.kind === "file").length;
  const projects = nodes.filter((n) => n.project === n.id && n.id !== "s1").map((p) => {
    const mine = nodes.filter((n) => n.project === p.id);
    return { id: p.id, sourceId: p.sourceId, name: p.name, path: p.path, files: mine.filter((n) => n.kind === "file").length, folders: mine.filter((n) => n.kind === "folder").length - 1, modifiedAt: Math.max(...mine.filter((n) => n.kind === "file").map((n) => n.modifiedAt)) };
  });
  return {
    sample: true,
    sources: [
      { id: "src-workos", name: "WorkOS", path: "C:\\Users\\You\\Documents\\WorkOS", kind: "workos", excluded: ["Archive 2024"], indexedAt: now - 12 * 60000, fileCount: count("src-workos"), skipped: 3, warnings: [] },
      { id: "src-reels", name: "Reel library", path: "D:\\Studio\\Reel library", kind: "project", excluded: [], indexedAt: now - 12 * 60000, fileCount: count("src-reels"), skipped: 0, warnings: [] },
    ],
    projects, nodes, links,
  };
}

/** What a sample note says when it is opened. */
export function sampleNote(node: BrainNode, projectName: string): string | null {
  if (!node.readable) return null;
  return `# ${node.name.replace(/\.[a-z]+$/, "")}\n\nThis is a sample note in "${projectName}". When you connect your own WorkOS, the real text of the file appears here, read straight from your computer.\n\nNothing is uploaded. The Second Brain only ever reads.`;
}

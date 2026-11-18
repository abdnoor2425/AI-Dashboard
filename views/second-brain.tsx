"use client";
// Second Brain: your WorkOS, drawn. A WorkOS is folders of projects; inside each project are its files and their connections.
// "/second-brain" is the globe. "/second-brain/edit" is where a WorkOS or extra project folders are added and removed.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/lib/nav";
import { usePathname } from "@/lib/nav";
import { api, useApi, useApp } from "@/lib/client";
import { Empty, Icon, Load, Page, SampleTag, Section, Segmented, Skel, SkelRows } from "@/components/ui";
import { Globe, type GlobeHandle } from "@/components/brain-globe";
import { ago, factsOf, kindText, needsLook, recentFiles, sizeText, type Brain, type BrainNode, type BrainProject, type Facts } from "@/lib/brain";
import { sampleBrain, sampleNote } from "@/lib/brain-sample";

const isPreview = () => typeof globalThis !== "undefined" && "__KEYSTONE_LOCAL__" in globalThis;

/** The index for this workspace. With nothing connected yet (or in the preview) it is a made-up WorkOS, clearly marked. */
function useBrain() {
  const { boot } = useApp();
  const workspaceId = boot.workspace.id;
  const preview = isPreview();
  const q = useApi<Brain>(preview ? null : "brain", { workspaceId }, { keep: true });
  const now = useMemo(() => Date.now(), [q.data]);
  const real = q.data && q.data.sources.length ? q.data : null;
  const brain = useMemo(() => real || (preview || q.data ? sampleBrain(now) : null), [real, preview, q.data, now]);
  const facts = useMemo(() => (brain ? factsOf(brain) : null), [brain]);
  return { brain, facts, real: q.data || null, sample: !real, preview, workspaceId, now, error: q.error, reload: q.reload };
}

function ProjectPicker({ brain, facts, focus, onPick, open, setOpen }: { brain: Brain; facts: Facts; focus: string | null; onPick: (id: string | null) => void; open: boolean; setOpen: (v: boolean) => void }) {
  const [find, setFind] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const cur = focus ? facts.projectById.get(focus) : null;
  useEffect(() => {
    if (!open) return; setFind("");
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const f = find.trim().toLowerCase();
  return (
    <div className="brain-pick" ref={box}>
      <button className="brain-pick-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="brain-pick-cap">Showing</span><span className="brain-pick-val">{cur ? cur.name : "Everything in your WorkOS"}</span><Icon name="down" size={15} />
      </button>
      {open && (
        <div className="brain-pick-menu" role="listbox" aria-label="Project">
          {facts.projects.length > 8 && <input className="brain-find" autoFocus placeholder="Find a project" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find a project" />}
          {!f && <button role="option" aria-selected={!cur} className={"brain-opt" + (!cur ? " on" : "")} onClick={() => { onPick(null); setOpen(false); }}><i style={{ background: "#FFF3D2" }} /><span><b>Everything in your WorkOS</b><small>{facts.projects.length} projects · {facts.files.length} files</small></span>{!cur && <Icon name="check" size={15} />}</button>}
          {brain.sources.map((s) => {
            const list = facts.projects.filter((p) => p.sourceId === s.id && (!f || p.name.toLowerCase().includes(f)));
            if (!list.length) return null;
            return (
              <React.Fragment key={s.id}>
                <div className="brain-opt-cap">{s.kind === "workos" ? `Projects in ${s.name}` : "Project folder"}</div>
                {list.map((p) => {
                  const ties = facts.ties.get(p.id)?.size || 0;
                  return (
                    <button key={p.id} role="option" aria-selected={focus === p.id} className={"brain-opt" + (focus === p.id ? " on" : "")} onClick={() => { onPick(p.id); setOpen(false); }}>
                      <i style={{ background: facts.color.get(p.id) }} /><span><b>{p.name}</b><small>{p.files} files · {ties ? `connected to ${ties} ${ties === 1 ? "project" : "projects"}` : "no outside connections"}</small></span>{focus === p.id && <Icon name="check" size={15} />}
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
          {f && !facts.projects.some((p) => p.name.toLowerCase().includes(f)) && <div className="brain-none">No project called that.</div>}
        </div>
      )}
    </div>
  );
}

function FileSearch({ facts, onPick }: { facts: Facts; onPick: (n: BrainNode) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const f = q.trim().toLowerCase();
  const hits = useMemo(() => (f.length < 2 ? [] : [...facts.byId.values()].filter((n) => n.path && n.name.toLowerCase().includes(f)).slice(0, 8)), [f, facts]);
  return (
    <div className="brain-search" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <Icon name="search" size={15} />
      <input value={q} placeholder="Find a file or folder" aria-label="Find a file or folder" onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      {open && f.length >= 2 && (
        <div className="brain-pick-menu brain-hits">
          {hits.length ? hits.map((n) => (
            <button key={n.id} className="brain-opt" onClick={() => { onPick(n); setOpen(false); setQ(""); }}>
              <i style={{ background: facts.color.get(n.project) }} /><span><b>{n.name}</b><small>{kindText(n)} · {facts.projectById.get(n.project)?.name}</small></span>
            </button>
          )) : <div className="brain-none">Nothing with that name.</div>}
        </div>
      )}
    </div>
  );
}

function Rows({ title, color, items, more }: { title: string; color?: string; items: { key: string; label: string; note?: string; dot?: string; onClick: () => void }[]; more?: number }) {
  if (!items.length) return null;
  return (
    <div className="brain-group">
      <div className="brain-group-h">{color && <i style={{ background: color }} />}{title}<em>{items.length + (more || 0)}</em></div>
      {items.map((it) => <button key={it.key} className="brain-item" onClick={it.onClick}><span className="brain-item-l">{it.dot && <i style={{ background: it.dot }} />}<span>{it.label}</span></span>{it.note ? <em>{it.note}</em> : <Icon name="chevron" size={13} />}</button>)}
      {!!more && <div className="brain-more">and {more} more</div>}
    </div>
  );
}

function ProjectPanel({ p, brain, facts, now, onClose, onFocus, onSelect }: { p: BrainProject; brain: Brain; facts: Facts; now: number; onClose: () => void; onFocus: (id: string) => void; onSelect: (id: string) => void }) {
  const mine = useMemo(() => brain.nodes.filter((n) => n.project === p.id), [brain, p.id]);
  const files = mine.filter((n) => n.kind === "file");
  const links = files.reduce((a, n) => a + (facts.out.get(n.id)?.length || 0) + (facts.into.get(n.id)?.filter((l) => facts.byId.get(l.source)?.project !== p.id).length || 0), 0) + (facts.into.get(p.id)?.length || 0);
  const ties = [...(facts.ties.get(p.id) || [])].sort((a, b) => b[1] - a[1]);
  const folders = (facts.children.get(p.id) || []).map((id) => facts.byId.get(id)!).filter((n) => n?.kind === "folder");
  const under = (id: string): number => (facts.children.get(id) || []).reduce((a, k) => a + (facts.byId.get(k)?.kind === "file" ? 1 : under(k)), 0);
  const top = [...files].filter((n) => facts.degree.get(n.id)).sort((a, b) => (facts.degree.get(b.id) || 0) - (facts.degree.get(a.id) || 0)).slice(0, 5);
  const recent = [...files].sort((a, b) => b.modifiedAt - a.modifiedAt).slice(0, 4);
  const src = brain.sources.find((s) => s.id === p.sourceId);
  return (
    <aside className="brain-panel" aria-label={`Project: ${p.name}`}>
      <div className="flex items-center justify-between gap-2"><span className="brain-panel-cap" style={{ color: facts.color.get(p.id) }}>Project</span><button className="brain-x" onClick={onClose} aria-label="Back to everything"><Icon name="x" size={14} /></button></div>
      <h3 className="brain-panel-title">{p.name}</h3>
      <p className="brain-panel-sub">{src?.kind === "workos" ? `In ${src.name}` : "Its own folder"} · changed {ago(p.modifiedAt, now)}</p>
      <div className="brain-panel-figs"><span><b>{p.files}</b>files</span><span><b>{p.folders}</b>folders</span><span><b>{links}</b>connections</span></div>
      <Rows title="Connected projects" items={ties.slice(0, 8).map(([id, n]) => ({ key: id, label: facts.projectById.get(id)?.name || "Project", dot: facts.color.get(id), note: `${n} ${n === 1 ? "link" : "links"}`, onClick: () => onFocus(id) }))} more={Math.max(0, ties.length - 8)} />
      {!ties.length && <p className="brain-quiet">Nothing in this project links to another project yet.</p>}
      <Rows title="Folders" items={folders.slice(0, 8).map((n) => ({ key: n.id, label: n.name, note: `${under(n.id)} files`, onClick: () => onSelect(n.id) }))} more={Math.max(0, folders.length - 8)} />
      <Rows title="Most connected files" items={top.map((n) => ({ key: n.id, label: n.name, note: `${facts.degree.get(n.id)} links`, onClick: () => onSelect(n.id) }))} />
      <Rows title="Changed lately" items={recent.map((n) => ({ key: n.id, label: n.name, note: ago(n.modifiedAt, now).replace(" ago", ""), onClick: () => onSelect(n.id) }))} />
    </aside>
  );
}

function NodePanel({ n, brain, facts, now, sample, workspaceId, focus, onClose, onFocus, onSelect }: { n: BrainNode; brain: Brain; facts: Facts; now: number; sample: boolean; workspaceId: string; focus: string | null; onClose: () => void; onFocus: (id: string) => void; onSelect: (id: string) => void }) {
  const p = facts.projectById.get(n.project);
  const q = useApi<{ content: string | null }>(!sample && n.kind === "file" && n.readable ? "brain" : null, { workspaceId, action: "node", id: n.id });
  const text = sample ? sampleNote(n, p?.name || "") : q.data?.content ?? null;
  const to = (list: any[] | undefined, side: "source" | "target", kind?: string) => (list || []).filter((l) => !kind || l.kind === kind).map((l) => facts.byId.get(l[side])!).filter(Boolean);
  const row = (x: BrainNode) => ({ key: x.id, label: x.name, dot: facts.color.get(x.project), note: x.project !== n.project ? facts.projectById.get(x.project)?.name : undefined, onClick: () => (x.id === x.project && facts.projectById.has(x.id) ? onFocus(x.id) : onSelect(x.id)) });
  const kids = (facts.children.get(n.id) || []).map((id) => facts.byId.get(id)!).filter(Boolean);
  const parent = facts.byId.get(facts.parent.get(n.id) || "");
  const linksTo = to(facts.out.get(n.id), "target", "reference"), mentions = to(facts.out.get(n.id), "target", "mention"), from = to(facts.into.get(n.id), "source");
  return (
    <aside className="brain-panel" aria-label={n.name}>
      <div className="flex items-center justify-between gap-2">
        <button className="brain-back" onClick={() => (focus === n.project ? onClose() : p ? onFocus(p.id) : onClose())}><span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="chevron" size={12} /></span><i style={{ background: facts.color.get(n.project) }} />{p?.name || "Back"}</button>
        <button className="brain-x" onClick={onClose} aria-label="Close details"><Icon name="x" size={14} /></button>
      </div>
      <span className="brain-panel-cap" style={{ display: "block", marginTop: 14 }}>{kindText(n)}</span>
      <h3 className="brain-panel-title" style={{ fontSize: 20, overflowWrap: "anywhere" }}>{n.name}</h3>
      <p className="brain-panel-sub brain-path" style={{ color: "rgba(240,230,205,0.6)" }}>{n.path || n.name}</p>
      {n.kind === "file" && <p className="brain-panel-sub">Changed {ago(n.modifiedAt, now)} · {sizeText(n.size)}</p>}
      {n.kind === "file" && !linksTo.length && !mentions.length && !from.length && <p className="brain-quiet">This file is not linked to anything else yet.</p>}
      <Rows title="Links to" items={linksTo.slice(0, 10).map(row)} more={Math.max(0, linksTo.length - 10)} />
      <Rows title="Mentions" items={mentions.slice(0, 10).map(row)} />
      <Rows title="Linked from" items={from.slice(0, 10).map(row)} more={Math.max(0, from.length - 10)} />
      {n.kind === "folder" && <Rows title="Inside this folder" items={kids.slice(0, 12).map(row)} more={Math.max(0, kids.length - 12)} />}
      {parent && parent.id !== n.id && n.id !== n.project && <Rows title="Sits in" items={[row(parent)]} />}
      {n.kind === "file" && (
        <div className="brain-group">
          <div className="brain-group-h">What it says</div>
          {!n.readable ? <p className="brain-quiet" style={{ marginTop: 4 }}>This kind of file is shown by name only. Its contents are not read.</p>
            : !sample && q.loading && !q.data ? <Skel h={60} style={{ opacity: 0.3 }} />
            : !sample && q.error ? <p className="brain-quiet" style={{ marginTop: 4 }}>{q.error}</p>
            : text ? <pre className="brain-text" tabIndex={0}>{text.length > 6000 ? text.slice(0, 6000) + "\n…" : text}</pre> : <p className="brain-quiet" style={{ marginTop: 4 }}>This file is empty.</p>}
        </div>
      )}
    </aside>
  );
}

function Home() {
  const app = useApp();
  const b = useBrain();
  const globe = useRef<GlobeHandle>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [picker, setPicker] = useState(false);
  const name = app.boot.workspace?.brand?.name || app.boot.workspace?.name || "your business";
  // A rescan can remove what was open.
  useEffect(() => { if (b.facts && focus && !b.facts.projectById.has(focus)) setFocus(null); if (b.facts && selected && !b.facts.byId.has(selected)) setSelected(null); }, [b.facts]);
  const openProject = (id: string | null) => { setFocus(id); setSelected(null); };
  const pick = (n: BrainNode) => { if (n.id === n.project && b.facts?.projectById.has(n.id)) openProject(n.id); else { if (focus && n.project !== focus) setFocus(n.project); setSelected(n.id); } };

  const head = (
    <>
      <SampleTag show={b.sample} />
      <Link className="btn" href="/second-brain/edit"><Icon name="edit" size={15} />Edit sources</Link>
    </>
  );
  if (!b.brain || !b.facts) return <Page title="Second Brain" sub={`Everything ${name} knows, connected.`} actions={head}>{b.error ? <div className="card"><Empty art="connect" title="The Second Brain did not load"><p>{b.error}</p><button className="btn tinted" style={{ marginTop: 10 }} onClick={b.reload}>Try again</button></Empty></div> : <div className="brain-card" style={{ height: 560 }} role="status" aria-label="Loading" />}</Page>;
  const { brain, facts, now } = b;
  const proj = focus ? facts.projectById.get(focus) : null;
  const node = selected ? facts.byId.get(selected) : null;
  const fresh = recentFiles(facts, now), stale = needsLook(facts, now);
  const read = Math.max(...brain.sources.map((s) => s.indexedAt));
  const chips = facts.projects.slice(0, 7);

  return (
    <Page title="Second Brain" sub={`Your WorkOS, drawn. Every project, the files inside it and how they connect. Pick a project to open it.`} actions={head}>
      {b.sample && !b.preview && (
        <Link href="/second-brain/edit" className="notice glass rise" style={{ marginBottom: 16 }}><span style={{ color: "var(--accent)", display: "flex" }}><Icon name="plus" size={18} /></span><span style={{ flex: 1 }}>This is a sample WorkOS. Connect your own and this globe becomes your projects and files.</span><Icon name="chevron" size={15} className="chev" /></Link>
      )}
      <div className={"brain-card rise" + (proj ? " focused" : "") + (proj || node ? " with-panel" : "")}>
        <div className="brain-top">
          <div className="brain-top-l">
            <ProjectPicker brain={brain} facts={facts} focus={focus} onPick={openProject} open={picker} setOpen={setPicker} />
            <FileSearch facts={facts} onPick={pick} />
          </div>
          <div className="brain-stats"><span><b>{facts.projects.length}</b>projects</span><span><b>{facts.files.length.toLocaleString()}</b>files</span><span><b>{facts.connections.toLocaleString()}</b>connections</span><span className="brain-live"><i />Read {ago(read, now)}</span></div>
        </div>
        <div className="brain-mid">
        <Globe ref={globe} brain={brain} facts={facts} focus={focus} selected={selected} paused={paused} panel={!!(proj || node)} onSelect={setSelected} onFocus={openProject} />
        <div className="brain-tools">
          <span className="brain-hint">{proj ? "Drag to move" : "Drag to turn"}</span>
          <button className="brain-tool sq" onClick={() => globe.current?.zoom(-1)} aria-label="Zoom out">−</button>
          <button className="brain-tool sq" onClick={() => globe.current?.zoom(1)} aria-label="Zoom in">+</button>
          {!proj && <button className="brain-tool" onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</button>}
          <button className="brain-tool" onClick={() => { globe.current?.reset(); setSelected(null); }}>Reset</button>
        </div>
        {node ? <NodePanel key={node.id} n={node} brain={brain} facts={facts} now={now} sample={b.sample} workspaceId={b.workspaceId} focus={focus} onClose={() => setSelected(null)} onFocus={openProject} onSelect={(id) => pick(facts.byId.get(id)!)} />
          : proj ? <ProjectPanel p={proj} brain={brain} facts={facts} now={now} onClose={() => openProject(null)} onFocus={openProject} onSelect={setSelected} /> : null}
        </div>
        <div className="brain-legend">
          {proj && <button className="brain-area on" onClick={() => openProject(null)}><span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="chevron" size={12} /></span>Everything</button>}
          {chips.map((p) => <button key={p.id} className={"brain-area" + (focus === p.id ? " on" : "")} onClick={() => openProject(focus === p.id ? null : p.id)}><i style={{ background: facts.color.get(p.id) }} />{p.name}<em>{p.files}</em></button>)}
          {facts.projects.length > chips.length && <button className="brain-area" onClick={() => setPicker(true)}>All {facts.projects.length} projects<Icon name="down" size={13} /></button>}
        </div>
      </div>

      <div className="grid-3 brain-below" style={{ marginTop: 20 }}>
        <div className="card pad rise" style={{ ["--i" as any]: 1 }}>
          <div className="t-cap">New this week</div>
          <div className="brain-big num">{fresh.length}<small>{fresh.length === 1 ? "file changed" : "files changed"}</small></div>
          {fresh.length ? <ul className="brain-list">{fresh.slice(0, 3).map((n) => <li key={n.id}><button onClick={() => pick(n)}><b>{n.name}</b><span>{facts.projectById.get(n.project)?.name} · {ago(n.modifiedAt, now)}</span></button></li>)}</ul> : <p className="t-foot" style={{ marginTop: 14 }}>Nothing has changed in the last seven days.</p>}
        </div>
        <div className="card pad rise" style={{ ["--i" as any]: 2 }}>
          <div className="t-cap">Needs a look</div>
          <div className="brain-big num">{stale.length}<small>{stale.length === 1 ? "project going quiet" : "projects going quiet"}</small></div>
          {stale.length ? <ul className="brain-list">{stale.slice(0, 3).map((x) => <li key={x.id}><button onClick={() => openProject(x.id)}><b>{x.name}</b><span>{x.why}</span></button></li>)}</ul> : <p className="t-foot" style={{ marginTop: 14 }}>Every project has been touched lately and connects to another.</p>}
        </div>
        <button className="card pad tap rise brain-ask" style={{ ["--i" as any]: 3 }} onClick={() => app.openPalette()}>
          <div className="t-cap">Ask your Second Brain</div>
          <p className="brain-ask-q">"Which projects lean on {[...facts.projects].sort((x, y) => (facts.ties.get(y.id)?.size || 0) - (facts.ties.get(x.id)?.size || 0))[0]?.name || "this one"}?"</p>
          <span className="brain-ask-box"><Icon name="sparkle" size={16} />Ask in plain words<Icon name="chevron" size={15} /></span>
          <p className="t-foot faint" style={{ marginTop: 12 }}>It knows your projects, how they connect and what changed. It uses your own Claude Code or Codex plan.</p>
        </button>
      </div>
    </Page>
  );
}

type Listing = { path: string; name: string; parent: string | null; home: string; folders: { name: string; path: string }[] };

/** Step through the folders on this computer and pick one, instead of typing a path. */
function FolderBrowser({ workspaceId, onPick, onClose }: { workspaceId: string; onPick: (path: string) => void; onClose: () => void }) {
  const [at, setAt] = useState("");
  const q = useApi<Listing>("brain", { workspaceId, action: "browse", path: at }, { keep: true });
  const d = q.data;
  return (
    <div className="brain-browse inset">
      <div className="brain-browse-h">
        <button className="btn sm" disabled={!d?.parent} onClick={() => d?.parent && setAt(d.parent)}><span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="chevron" size={13} /></span>Up</button>
        <span className="brain-path" style={{ flex: 1, minWidth: 0 }}>{d?.path || "Opening…"}</span>
        <button className="btn sm" onClick={onClose}>Cancel</button>
        <button className="btn sm primary" disabled={!d} onClick={() => d && onPick(d.path)}>Use this folder</button>
      </div>
      {q.error && !d ? <p className="t-foot" style={{ padding: 14 }}>{q.error}</p> : !d ? <SkelRows n={3} /> : d.folders.length ? (
        <div className="brain-browse-list">{d.folders.map((f) => <button key={f.path} className="brain-browse-row" onClick={() => setAt(f.path)}><Icon name="files" size={15} /><span>{f.name}</span><Icon name="chevron" size={13} className="chev" /></button>)}</div>
      ) : <p className="t-foot" style={{ padding: 14 }}>There are no folders inside this one.</p>}
    </div>
  );
}

function Edit() {
  const b = useBrain();
  const [kind, setKind] = useState<"workos" | "project">("workos");
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [browse, setBrowse] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [remove, setRemove] = useState("");
  const locked = b.preview;
  const shown = b.preview ? b.brain : b.real; // on a real dashboard, never list the sample as if it were connected
  const sources = shown?.sources || [];
  const facts = useMemo(() => (shown ? factsOf(shown) : null), [shown]);

  async function change(body: any, done: string) {
    setBusy(body.action + (body.sourceId || "") + (body.path || "")); setMsg(null);
    try { await api("brain", { body: { workspaceId: b.workspaceId, ...body } }); setMsg({ ok: true, text: done }); setRemove(""); if (body.action === "connect") { setPath(""); setName(""); setBrowse(false); } }
    catch (e: any) { setMsg({ ok: false, text: e?.message || "That did not work." }); }
    finally { setBusy(""); }
  }
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const p = path.trim();
    if (!/^(?:[a-z]:[\\/]|\/)/i.test(p)) { setMsg({ ok: false, text: "Enter the full path of the folder, or use Browse to pick it." }); return; }
    change({ action: "connect", path: p, name: name.trim(), kind }, kind === "workos" ? "WorkOS connected. Every folder inside it is now a project." : "Project folder added.");
  };

  return (
    <Page title="Edit Second Brain" sub="Add or remove what your Second Brain reads. It only ever reads. Nothing here changes, moves or uploads your files."
      actions={<Link className="btn" href="/second-brain"><span style={{ display: "flex", transform: "rotate(180deg)" }}><Icon name="chevron" size={14} /></span>Back to the globe</Link>}>
      {locked && <div className="notice glass" style={{ marginBottom: 16 }}><span style={{ color: "var(--accent)", display: "flex" }}><Icon name="eye" size={18} /></span><span style={{ flex: 1 }}>This preview shows a sample WorkOS. On your own computer, these buttons connect your real folders.</span></div>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={"brain-msg" + (msg.ok ? " ok" : "")}>{msg.text}</p>}

      <Section title="Where it reads from" action={<span className="t-foot">{sources.length} of 8 sources</span>}>
        <div className="card group">
          {sources.map((s) => (
            <div className="row brain-src" key={s.id}>
              <span className="glyph"><Icon name={s.kind === "workos" ? "second-brain" : "files"} size={18} /></span>
              <span className="row-main">
                <span className="row-title">{s.name} <span className="chip line" style={{ marginLeft: 6 }}>{s.kind === "workos" ? "WorkOS" : "Project folder"}</span></span>
                <span className="row-sub brain-path">{s.path}</span>
                <span className="row-sub">{s.kind === "workos" ? `${facts?.projects.filter((p) => p.sourceId === s.id).length || 0} projects · ` : ""}{s.fileCount.toLocaleString()} files · read {ago(s.indexedAt, b.now)}{s.skipped ? ` · ${s.skipped} skipped for safety` : ""}</span>
                {s.warnings.map((w, i) => <span key={i} className="row-sub" style={{ color: "var(--warn)" }}>{w}</span>)}
              </span>
              {remove === s.id ? (
                <span className="flex items-center gap-2 flex-wrap"><span className="t-foot">Remove it? Your files stay where they are.</span><button className="btn sm brain-remove" disabled={locked || !!busy} onClick={() => change({ action: "disconnect", sourceId: s.id }, `${s.name} removed. Your files were not touched.`)}>Yes, remove</button><button className="btn sm" onClick={() => setRemove("")}>Keep</button></span>
              ) : (
                <>
                  <button className="btn sm" disabled={locked || !!busy} onClick={() => change({ action: "rescan", sourceId: s.id }, `${s.name} was read again.`)}><Icon name="refresh" size={14} />{busy === "rescan" + s.id ? "Reading…" : "Read again"}</button>
                  <button className="btn sm brain-remove" disabled={locked || !!busy} onClick={() => setRemove(s.id)}><Icon name="trash" size={14} />Remove</button>
                </>
              )}
            </div>
          ))}
          {!sources.length && <div style={{ padding: "22px 18px" }}><div className="row-title">Nothing is connected yet</div><div className="row-sub">Add your WorkOS below. The globe shows a sample until you do.</div></div>}
          <form className="brain-add" onSubmit={add}>
            <div className="brain-add-h">
              <div><div className="row-title">Add to your Second Brain</div><div className="row-sub">{kind === "workos" ? "Point at the top folder of your WorkOS. Every folder inside it becomes a project." : "For a project that lives outside your WorkOS. The folder itself becomes one project."}</div></div>
              <Segmented label="What are you adding" value={kind} onChange={setKind} options={[{ value: "workos", label: "A whole WorkOS" }, { value: "project", label: "One project folder" }]} />
            </div>
            <div className="brain-add-row">
              <input className="input" style={{ flex: 3, minWidth: 220 }} value={path} onChange={(e) => setPath(e.target.value)} spellCheck={false} placeholder={kind === "workos" ? "C:\\Users\\You\\Documents\\WorkOS" : "D:\\Projects\\Website rebuild"} aria-label="Folder path" disabled={locked} />
              <button type="button" className="btn" disabled={locked} onClick={() => setBrowse(!browse)}><Icon name="files" size={15} />Browse</button>
              <input className="input" style={{ flex: 1.4, minWidth: 150 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" aria-label="Name" disabled={locked} />
              <button className="btn primary" disabled={locked || !!busy || !path.trim()}><Icon name="plus" size={15} />{busy.startsWith("connect") ? "Reading…" : "Add"}</button>
            </div>
            {browse && !locked && <FolderBrowser workspaceId={b.workspaceId} onPick={(p) => { setPath(p); setBrowse(false); }} onClose={() => setBrowse(false)} />}
          </form>
        </div>
      </Section>

      {sources.some((s) => s.kind === "workos") && facts && (
        <div style={{ marginTop: 32 }}>
          <Section title="Projects in your Second Brain" i={1} action={<span className="t-foot">Leave out any that do not belong. Nothing is deleted.</span>}>
            <div className="card group">
              {sources.filter((s) => s.kind === "workos").map((s) => (
                <React.Fragment key={s.id}>
                  {facts.projects.filter((p) => p.sourceId === s.id && p.path).map((p) => (
                    <div className="row brain-map" key={p.id}>
                      <span className="brain-dot" style={{ background: facts.color.get(p.id) }} />
                      <span className="row-main"><span className="row-title">{p.name}</span><span className="row-sub">{p.files} {p.files === 1 ? "file" : "files"} · {p.folders} {p.folders === 1 ? "folder" : "folders"} · changed {ago(p.modifiedAt, b.now)}</span></span>
                      <button className="btn sm" disabled={locked || !!busy} onClick={() => change({ action: "leave-out", sourceId: s.id, path: p.path }, `${p.name} is left out.`)}>Leave out</button>
                    </div>
                  ))}
                  {s.excluded.map((x) => (
                    <div className="row brain-map out" key={s.id + x}>
                      <span className="brain-dot" />
                      <span className="row-main"><span className="row-title">{x}</span><span className="row-sub">Left out of the Second Brain</span></span>
                      <button className="btn sm tinted" disabled={locked || !!busy} onClick={() => change({ action: "leave-out", sourceId: s.id, path: x, leftOut: false }, `${x} is back in.`)}>Bring back</button>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </Section>
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <Section title="Always left out" i={2}>
          <div className="card pad">
            <p className="muted" style={{ marginBottom: 12 }}>These never enter the Second Brain, in any source. Larger files and other formats are still shown by name, but their contents are not read.</p>
            <div className="flex items-center gap-2 flex-wrap">{["Passwords, keys and tokens", "Hidden files and folders", "Shortcuts and links", "Code libraries and build folders"].map((x) => <span key={x} className="chip line">{x}</span>)}</div>
          </div>
        </Section>
      </div>
    </Page>
  );
}

export default function SecondBrain() {
  const path = usePathname() || "";
  return /\/edit\/?$/.test(path) ? <Edit /> : <Home />;
}

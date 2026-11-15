"use client";

import { useEffect, useRef, useState } from "react";
import { Empty, Load, Mark, Page, Section, Segmented, SkelRows } from "@/components/ui";
import { api, useApi, useApp } from "@/lib/client";

type Source = { id: string; name: string; path: string; indexedAt: number; fileCount: number; skipped: number; warnings: string[] };
type BrainNode = { id: string; sourceId: string; name: string; path: string; kind: "folder" | "file" };
type BrainIndex = {
  sources: Source[];
  projects: Source[];
  nodes: BrainNode[];
  links: { source: string; target: string; kind: "contains" | "reference" }[];
};
type Mutation = { action: "connect"; path: string; name: string } | { action: "rescan" | "disconnect"; sourceId: string };
const tabs = [{ value: "graph", label: "All knowledge" }, { value: "projects", label: "Projects" }, { value: "files", label: "Files" }];
const wrap = { overflowWrap: "anywhere" } as const;

export default function SecondBrain() {
  const { boot } = useApp();
  const workspaceId = boot.workspace.id;
  if ("__KEYSTONE_LOCAL__" in globalThis) {
    return <Page title="Second Brain"><div className="card"><Empty art="connect" title="Open Keystone locally to connect folders">
      <p>The static preview cannot access local folders. Start the Keystone server on the computer holding your files.</p>
      <p>On another computer, open the matching workspace and reconnect each project folder using its local path there.</p>
    </Empty></div></Page>;
  }
  return <Brain key={workspaceId} workspaceId={workspaceId} workspaceName={boot.workspace.brand.name} />;
}

function Brain({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) {
  const [tab, setTab] = useState("graph");
  const [project, setProject] = useState("");
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [manage, setManage] = useState(false);
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [review, setReview] = useState(false);
  const [remove, setRemove] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const q = useApi<BrainIndex>("brain", { workspaceId, revision });
  const data = q.data;
  const sourceById = new Map(data?.sources.map(source => [source.id, source]));
  const activeProject = data?.projects.find(item => item.id === project);
  const nodes = (data?.nodes || []).filter(node => !activeProject || node.sourceId === activeProject.id);
  const detail = nodes.find(node => node.id === selected);
  const pathOf = (node: BrainNode) => {
    const source = sourceById.get(node.sourceId);
    const relative = node.path.replace(/\\/g, "/");
    return relative && relative !== "." ? [source?.name, relative].filter(Boolean).join("/") : source?.name || node.name;
  };
  const search = query.trim().toLowerCase();
  const listed = nodes.filter(node => node.kind === "file" && pathOf(node).toLowerCase().includes(search));

  const select = (next: string, scope = "") => {
    setTab(next);
    setProject(scope);
    setSelected("");
    setQuery("");
  };

  async function change(mutation: Mutation) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("brain", { body: { workspaceId, ...mutation } });
      setRevision(value => value + 1);
      setRemove("");
      setReview(false);
      if (mutation.action === "connect") {
        setPath("");
        setName("");
      }
      setMessage({ connect: "Folder indexed.", rescan: "Index refreshed.", disconnect: "Folder disconnected." }[mutation.action]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Folder update failed.");
    } finally {
      setBusy(false);
    }
  }

  return <Page title="Second Brain" sub={`Explore the projects and files indexed for ${workspaceName}.`}
    actions={data?.sources.length ? <button className="btn tinted" onClick={() => setManage(value => !value)} aria-expanded={manage}>{manage ? "Close sources" : "Manage sources"}</button> : undefined}>
    <div className="stack">
      {message && <p role="status" className="t-foot">{message}</p>}
      {error && <p role="alert" className="t-foot">{error}</p>}
      <Load q={q} skeleton={<SkelRows n={3} />}>{() => <>
        {(manage || !data?.sources.length) && <Section title="Folder sources">
          <div className="card pad stack">
            {data?.sources.map(source => <div key={source.id} className="stack" style={{ gap: 8 }}>
              <h3 className="t-head">{source.name}</h3>
              <p className="t-foot muted" style={wrap}>{source.path}</p>
              <p className="t-foot">{source.fileCount} indexed files · {source.skipped} skipped · Last indexed {new Date(source.indexedAt).toLocaleString()}</p>
              {!!source.warnings.length && <details><summary>Indexing notes</summary><ul>{source.warnings.map((warning, i) => <li key={i} style={wrap}>{warning}</li>)}</ul></details>}
              <div className="flex items-center gap-2 flex-wrap">
                <button className="btn" disabled={busy} onClick={() => change({ action: "rescan", sourceId: source.id })}>Rescan</button>
                <button className="btn" disabled={busy} onClick={() => setRemove(source.id)}>Disconnect</button>
              </div>
              {remove === source.id && <div className="stack" style={{ gap: 8 }}>
                <p>Disconnect {source.name} and remove its index? Your original files stay in place.</p>
                <div className="flex items-center gap-2">
                  <button className="btn tinted" disabled={busy} onClick={() => change({ action: "disconnect", sourceId: source.id })}>Disconnect folder</button>
                  <button className="btn" disabled={busy} onClick={() => setRemove("")}>Cancel</button>
                </div>
              </div>}
            </div>)}
            <form className="stack" style={{ gap: 12 }} onSubmit={event => {
              event.preventDefault();
              setError("");
              if (!/^(?:[a-z]:[\\/]|\/)/i.test(path.trim()) || /^[\\/]{2}/.test(path.trim())) {
                setError("Enter a full local folder path.");
                return;
              }
              setReview(true);
            }}>
              <h3 className="t-head">Connect a project folder</h3>
              <p className="muted">Choose a specific folder on the computer running Keystone. Keystone indexes it read-only. Use Rescan when its files change.</p>
              <p className="t-foot muted">If you move to another computer, reconnect each project using the folder path on that computer.</p>
              {!review ? <>
                <label className="stack" style={{ gap: 4 }}>Local folder path
                  <input className="input" value={path} required placeholder={"C:\\Projects\\Client notes"} onChange={event => setPath(event.target.value)} spellCheck={false} />
                </label>
                <label className="stack" style={{ gap: 4 }}>Project name (optional)
                  <input className="input" value={name} onChange={event => setName(event.target.value)} />
                </label>
                <div><button className="btn tinted" disabled={busy}>Review folder</button></div>
              </> : <>
                <p style={wrap}><strong>{name.trim() || "Selected folder"}</strong> · {path.trim()}</p>
                <p className="muted">The index can include readable files and their links within this folder. Hidden and sensitive locations, dependency folders and symbolic links are excluded. Confirm you want {workspaceName} to access this folder.</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" className="btn tinted" disabled={busy} onClick={() => change({ action: "connect", path: path.trim(), name: name.trim() })}>{busy ? "Indexing…" : "Connect and index"}</button>
                  <button type="button" className="btn" disabled={busy} onClick={() => setReview(false)}>Edit folder</button>
                </div>
              </>}
            </form>
          </div>
        </Section>}
        {!!data?.sources.length && <>
          <div className="flex items-center gap-2 flex-wrap">
            <Segmented options={tabs} label="Second Brain view" value={tab} onChange={next => select(next, next === "projects" ? "" : project)} />
            {activeProject && <button className="btn" onClick={() => select(tab)} aria-label="Clear project filter">{activeProject.name} ×</button>}
          </div>
          {tab === "projects" && <Section title="Projects"><div className="grid-2">
            {data.projects.map(item => <div className="card pad stack" style={{ gap: 12 }} key={item.id}>
              <div className="flex items-center gap-2"><Mark name={item.name} /><h3 className="t-head">{item.name}</h3></div>
              <p className="muted">{item.fileCount} indexed files · {data.nodes.filter(node => node.sourceId === item.id && node.kind === "folder" && node.path).length} subfolders</p>
              <div className="flex items-center gap-2 flex-wrap">
                <button className="btn tinted" onClick={() => select("graph", item.id)}>Open graph</button>
                <button className="btn" onClick={() => select("files", item.id)}>Browse files</button>
              </div>
            </div>)}
          </div></Section>}
          {tab === "graph" && <Graph key={`${revision}:${activeProject?.id || "all"}`} workspaceId={workspaceId} project={activeProject?.id || ""}
            nodes={nodes} selected={detail?.id || ""} onSelect={setSelected} onFiles={() => select("files", project)} />}
          {tab === "files" && <Section title="Files">
            <input className="input" type="search" aria-label="Search files" placeholder="Search files…" value={query} onChange={event => setQuery(event.target.value)} />
            <div className="card group" style={{ marginTop: 12 }}>
              {!listed.length ? <Empty art="search" title={search ? "No matching files" : "No indexed files in this project"} /> :
                search ? listed.map(node => <FileRow key={node.id} node={node} path={pathOf(node)} onOpen={setSelected} />) :
                data.sources.map(source => {
                  const files = listed.filter(node => node.sourceId === source.id);
                  return files.length ? <FileTree key={source.id} files={files} pathOf={pathOf} onOpen={setSelected} /> : null;
                })}
            </div>
          </Section>}
          {detail && <Reader key={revision} workspaceId={workspaceId} node={detail} pathOf={pathOf} nodes={nodes} links={data.links}
            onSelect={setSelected} onClose={() => setSelected("")} />}
        </>}
      </>}</Load>
    </div>
  </Page>;
}

function Graph({ workspaceId, project, nodes, selected, onSelect, onFiles }: {
  workspaceId: string; project: string; nodes: BrainNode[]; selected: string; onSelect: (id: string) => void; onFiles: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const url = new URLSearchParams({ workspaceId, project });
  const command = (action: string, value = {}) => frame.current?.contentWindow?.postMessage({ type: "brain-command", action, ...value }, window.location.origin);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "brain-ready") setReady(true);
      if (event.data?.type === "brain-error") setError(true);
      if (event.data?.type === "brain-select") {
        const id = event.data.node?.id ?? event.data.id;
        if (nodes.some(node => node.id === id)) onSelect(id);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [nodes, onSelect]);

  useEffect(() => {
    if (ready && selected) command("select", { id: selected });
  }, [ready, selected]);

  useEffect(() => {
    if (ready || error) return;
    const timeout = window.setTimeout(() => setError(true), 15000);
    return () => window.clearTimeout(timeout);
  }, [ready, error]);

  return <Section><div className="card">
    <div className="row flush" style={{ flexWrap: "wrap" }}>
      <div className="row-main"><div className="row-title">Knowledge graph</div><div className="row-sub">Drag to rotate · Select a point to read its details below</div></div>
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn" disabled={!ready || error} onClick={() => { command("pause", { paused: !paused }); setPaused(!paused); }}>{paused ? "Resume" : "Pause"}</button>
        <button className="btn" disabled={!ready || error} onClick={() => { command("reset"); onSelect(""); }}>Reset view</button>
        <button className="btn tinted" disabled={!ready || error} onClick={() => { command("growth"); onSelect(""); setPaused(false); }}>Play / stop growth</button>
      </div>
    </div>
    {error ? <Empty art="connect" title="The knowledge graph could not load"><button className="btn tinted" onClick={onFiles}>Browse indexed files</button></Empty> :
      <iframe ref={frame} title="Knowledge graph" src={"/brain/index.html?" + url} onError={() => setError(true)}
        style={{ display: "block", width: "100%", height: "clamp(480px, 70dvh, 780px)", border: 0 }} />}
  </div></Section>;
}

function Reader({ workspaceId, node, pathOf, nodes, links, onSelect, onClose }: {
  workspaceId: string; node: BrainNode; pathOf: (node: BrainNode) => string; nodes: BrainNode[]; links: BrainIndex["links"];
  onSelect: (id: string) => void; onClose: () => void;
}) {
  const q = useApi<{ content: string | null }>(node.kind === "file" ? "brain" : null, { workspaceId, action: "node", id: node.id });
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, [node.id]);
  const connected = links.flatMap(link => {
    const outgoing = link.source === node.id;
    if (!outgoing && link.target !== node.id) return [];
    const target = nodes.find(item => item.id === (outgoing ? link.target : link.source));
    if (!target) return [];
    const relation = link.kind === "contains" ? (outgoing ? "Contains" : "Contained in") : (outgoing ? "References" : "Referenced by");
    return [{ target, relation }];
  });

  return <Section title={node.kind === "file" ? "File details" : "Folder details"} action={<button className="btn" onClick={onClose}>Close details</button>}>
    <article className="card pad stack" style={{ gap: 8 }}>
      <h3 className="t-head" ref={title} tabIndex={-1}>{node.name}</h3>
      <p className="t-foot muted" style={wrap}>{pathOf(node)}</p>
      {node.kind === "file" && <Load q={q} skeleton={<p>Reading file…</p>}>{({ content }) => content == null ?
        <p>This file is indexed by name. A text preview is unavailable.</p> :
        content.length ? <pre style={{ whiteSpace: "pre-wrap", ...wrap, maxHeight: "55dvh", overflow: "auto" }} tabIndex={0}>{content}</pre> :
        <p>This file is empty.</p>}</Load>}
      {!!connected.length && <div style={{ marginTop: 12 }}>
        <h4 className="t-head" style={{ marginBottom: 8 }}>Connections</h4>
        <div className="card group">{connected.map(({ target, relation }) => <button type="button" className="row flush" key={target.id + relation} onClick={() => onSelect(target.id)}>
          <span className="row-main"><span className="row-title">{target.name}</span><span className="row-sub">{relation}</span></span>
        </button>)}</div>
      </div>}
    </article>
  </Section>;
}

function FileRow({ node, path, onOpen }: { node: BrainNode; path: string; onOpen: (id: string) => void }) {
  return <button type="button" className="row flush" onClick={() => onOpen(node.id)}>
    <span className="row-main"><span className="row-title" style={wrap}>{node.name}</span><span className="row-sub" style={wrap}>{path}</span></span>
  </button>;
}

function FileTree({ files, pathOf, onOpen, depth = 0 }: { files: BrainNode[]; pathOf: (node: BrainNode) => string; onOpen: (id: string) => void; depth?: number }) {
  const folders = new Map<string, BrainNode[]>();
  const leaves: BrainNode[] = [];
  for (const node of files) {
    const parts = pathOf(node).split("/");
    if (depth >= parts.length - 1) leaves.push(node);
    else {
      const folder = folders.get(parts[depth]) || [];
      folder.push(node);
      folders.set(parts[depth], folder);
    }
  }
  return <>{Array.from(folders, ([name, nodes]) => <details key={name} open={depth === 0 ? true : undefined}>
    <summary className="row-title" style={{ ...wrap, cursor: "pointer", padding: "13px 16px" }}>{name} <span className="t-foot muted">· {nodes.length}</span></summary>
    <div style={{ marginLeft: 12 }}><FileTree files={nodes} pathOf={pathOf} onOpen={onOpen} depth={depth + 1} /></div>
  </details>)}{leaves.map(node => <FileRow key={node.id} node={node} path={pathOf(node)} onOpen={onOpen} />)}</>;
}

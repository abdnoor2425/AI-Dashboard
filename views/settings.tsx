"use client";
import React, { useEffect, useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { Fold, Icon, Load, Mark, Page, Section, Segmented, SkelRows, Switch } from "@/components/ui";

function Appearance({ d }: { d: any }) {
  const app = useApp();
  const [name, setName] = useState(d.brand.name);
  useEffect(() => setName(d.brand.name), [d.brand.name]);
  const post = (body: any, msg?: string) => api("settings", { method: "POST", body }).then(() => { app.reloadBoot(); msg && app.toast(msg); }, (e: any) => app.toast(e.message));
  return (
    <div className="card group">
      <div className="row"><span className="row-main"><span className="row-title" style={{ display: "block" }}>Appearance</span><span className="row-sub">Automatic is light by day and dark at night.</span></span>
        <Segmented label="Appearance" value={app.theme as any} onChange={(t) => app.setTheme(t)} options={[{ value: "system", label: "Automatic" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} /></div>
      <div className="row" style={{ flexWrap: "wrap" }}><span className="row-main" style={{ minWidth: 180 }}><span className="row-title" style={{ display: "block" }}>Sky</span><span className="row-sub">The background follows the clock. Pick a time of day to keep it there.</span></span>
        <Segmented label="Sky" value={app.sky as any} onChange={(k) => app.setSky(k)} options={[{ value: "live", label: "Live" }, { value: "dawn", label: "Dawn" }, { value: "day", label: "Day" }, { value: "sunset", label: "Sunset" }, { value: "night", label: "Night" }]} /></div>
      <div className="row"><span className="row-main"><span className="row-title" style={{ display: "block" }}>Accent colour</span><span className="row-sub">Used for buttons, charts and highlights.</span></span>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Accent colour">
          {Object.entries(d.accents).map(([id, a]: any) => <button key={id} role="radio" aria-checked={d.brand.accent === id} aria-label={a.name} title={a.name} className="swatch" style={{ background: a.light, color: a.light }} onClick={() => post({ accent: id })}>{d.brand.accent === id && <span style={{ color: "#fff", display: "grid" }}><Icon name="check" size={15} stroke={2.6} /></span>}</button>)}
        </div></div>
      <div className="row"><label className="row-main" htmlFor="brand-name"><span className="row-title" style={{ display: "block" }}>Name</span><span className="row-sub">Shown at the top of the sidebar.</span></label>
        <div className="flex gap-2" style={{ flex: "0 1 320px", minWidth: 0 }}><input id="brand-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />{name.trim() !== d.brand.name && name.trim().length > 1 && <button className="btn primary" onClick={() => post({ brandName: name.trim() }, "Name saved")}>Save</button>}</div></div>
    </div>
  );
}

function Pages({ d }: { d: any }) {
  const app = useApp();
  const toggle = (id: string, on: boolean) => api("settings", { method: "POST", body: { modules: { [id]: on } } }).then(() => app.reloadBoot(), (e: any) => app.toast(e.message));
  const list = d.modulesList.filter((m: any) => !m.core);
  return (
    <div className="card group two-col">
      {list.map((m: any) => (
        <div className="row" key={m.id}><span className="glyph"><Icon name={m.id} size={16} /></span><span className="row-main"><span className="row-title">{m.label}</span></span><Switch label={`Show ${m.label}`} checked={d.modules[m.id] !== false} onChange={(v) => toggle(m.id, v)} /></div>
      ))}
    </div>
  );
}

function Rubric({ d }: { d: any }) {
  const app = useApp();
  const [w, setW] = useState<Record<string, number>>(d.rubric.weights);
  const [open, setOpen] = useState(false);
  useEffect(() => setW(d.rubric.weights), [JSON.stringify(d.rubric.weights)]);
  const dirty = d.factors.some((f: any) => w[f.key] !== d.rubric.weights[f.key]);
  const total = d.factors.reduce((s: number, f: any) => s + w[f.key] * 5, 0);
  const save = () => api("settings", { method: "POST", body: { weights: w } }).then(() => app.toast("Ranking updated. The list is re-ranked."), (e: any) => app.toast(e.message));
  const reset = () => api("settings", { method: "POST", body: { resetRubric: true } }).then(() => app.toast("Back to the standard weights"), (e: any) => app.toast(e.message));
  return (
    <div className="card group">
      <button className="row flush" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="glyph accent"><Icon name="attention" size={16} /></span>
        <span className="row-main"><span className="row-title" style={{ display: "block" }}>How "Needs your attention" is ranked</span><span className="row-sub">Version {d.rubric.version} · owned by the {d.rubric.owner} · advice only, it never acts on its own</span></span>
        <Icon name="chevron" size={16} className={"caret" + (open ? " open" : "")} />
      </button>
      <Fold open={open}>
        <div className="row-detail stack" style={{ gap: 16 }}>
          <p className="muted" style={{ maxWidth: "66ch" }}>Each item gets 0 to 5 on five questions. Each answer is multiplied by its weight, and the total is a score out of 100. Something unknown is never counted as zero. It is marked "needs context" instead.</p>
          {d.factors.map((f: any) => (
            <div key={f.key} className="weight">
              <label htmlFor={"w-" + f.key}><span className="row-title">{f.label}</span><span className="row-sub" style={{ display: "block" }}>{f.hint}</span></label>
              <input id={"w-" + f.key} type="range" min={0} max={10} step={1} value={w[f.key]} onChange={(e) => setW({ ...w, [f.key]: Number(e.target.value) })} />
              <output className="num">×{w[f.key]}</output>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className={"t-foot " + (total === 100 ? "faint" : "")} style={total === 100 ? undefined : { color: "var(--warn)" }}>{total === 100 ? "The weights add up to a score out of 100." : `These weights add up to ${total}, so scores are scaled back to 100.`}</span>
            <div className="flex gap-2"><button className="btn" onClick={reset}>Use standard weights</button><button className="btn primary" disabled={!dirty} onClick={save}>Save as new version</button></div>
          </div>
        </div>
      </Fold>
    </div>
  );
}

function Workspaces({ d }: { d: any }) {
  const app = useApp();
  const q = useApi("workspaces");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", owner: "", kind: "", accent: "green" });
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const run = (p: Promise<any>, msg: string) => p.then(() => { app.reloadBoot(); app.toast(msg); }, (e: any) => app.toast(e.message));
  const create = () => run(api("workspaces", { method: "POST", body: form }).then(() => { setAdding(false); setForm({ name: "", owner: "", kind: "", accent: "green" }); }), `${form.name} created from the template`);
  return (
    <Load q={q} skeleton={<SkelRows n={3} />}>
      {(w) => (
        <div className="stack" style={{ gap: 12 }}>
          <div className="card group">
            {w.workspaces.map((x: any) => (
              <div className="row" key={x.id}>
                <Mark name={x.name} color={d.accents[x.accent]?.light} />
                <span className="row-main"><span className="row-title" style={{ display: "block" }}>{x.name}</span><span className="row-sub">{x.sample ? "Sample · " : "Your data · "}{x.kind === "client" ? "client workspace" : "owner workspace"} · {x.sites} website{x.sites === 1 ? "" : "s"} · ranking v{x.rubric}</span></span>
                {x.id === w.active ? <span className="chip accent">Open now</span> : <button className="btn tinted sm" onClick={() => run(api("workspaces/switch", { method: "POST", body: { id: x.id } }), `Switched to ${x.name}`)}>Open</button>}
                {x.id !== "main" && (confirmDel === x.id
                  ? <span className="flex gap-1"><button className="btn sm danger" onClick={() => { setConfirmDel(null); run(api("workspaces/delete", { method: "POST", body: { id: x.id } }), `${x.name} removed`); }}>Remove</button><button className="btn sm" onClick={() => setConfirmDel(null)}>Keep</button></span>
                  : <button className="icon-btn sm" aria-label={`Remove ${x.name}`} onClick={() => setConfirmDel(x.id)}><Icon name="trash" size={15} /></button>)}
              </div>
            ))}
          </div>
          <Fold open={adding}>
            <div className="card pad stack" style={{ gap: 12 }}>
              <div className="t-head">New workspace from the template</div>
              <div className="grid-2">
                <label><span className="t-cap">Business name</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} placeholder="Harbor Coffee Co." /></label>
                <label><span className="t-cap">Owner's first name</span><input className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} maxLength={40} placeholder="Jo" /></label>
                <label><span className="t-cap">Kind of business</span><input className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} maxLength={40} placeholder="Coffee roaster" /></label>
                <div><span className="t-cap">Accent colour</span><div className="flex gap-2 flex-wrap" style={{ marginTop: 6 }} role="radiogroup" aria-label="Workspace accent">{Object.entries(d.accents).map(([id, a]: any) => <button key={id} role="radio" aria-checked={form.accent === id} aria-label={a.name} className="swatch" style={{ background: a.light, color: a.light }} onClick={() => setForm({ ...form, accent: id })} />)}</div></div>
              </div>
              <p className="t-foot faint">A new workspace starts with the same pages and ranking rules, its own sample examples, and no connections. Nothing is copied from any other workspace.</p>
              <div className="flex gap-2 justify-end"><button className="btn" onClick={() => setAdding(false)}>Cancel</button><button className="btn primary" disabled={form.name.trim().length < 2} onClick={create}>Create workspace</button></div>
            </div>
          </Fold>
          {!adding && <div className="flex gap-2 flex-wrap"><button className="btn tinted" onClick={() => setAdding(true)}><Icon name="plus" size={16} />New workspace from the template</button>{!w.workspaces.some((x: any) => !x.sample) && <button className="btn" onClick={() => run(api("workspaces", { method: "POST", body: { name: "My business", owner: app.boot.workspace.owner, real: true } }), "Your own workspace is ready. Connect a tool to fill it.")}>Start with my own data</button>}</div>}
          <p className="t-foot faint" style={{ padding: "0 6px" }}>Sample workspaces are made-up examples to explore. A workspace with your own data starts empty and only ever shows what your connected tools report.</p>
        </div>
      )}
    </Load>
  );
}

function Data() {
  const app = useApp();
  const [json, setJson] = useState<string | null>(null);
  const [ask, setAsk] = useState<"workspace" | "all" | null>(null);
  const exportIt = async () => { try { const d = await api("export"); setJson(JSON.stringify(d, null, 2)); } catch (e: any) { app.toast(e.message); } };
  const copy = async () => { try { await navigator.clipboard.writeText(json || ""); app.toast("Copied"); } catch { app.toast("Select the text and copy it by hand"); } };
  const reset = (scope: "workspace" | "all") => api("reset", { method: "POST", body: { scope } }).then(() => { setAsk(null); app.reloadBoot(); app.toast(scope === "all" ? "Everything is back to the starting examples" : "This workspace is back to its starting examples"); }, (e: any) => app.toast(e.message));
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card group">
        <div className="row"><span className="glyph"><Icon name="download" size={16} /></span><span className="row-main"><span className="row-title" style={{ display: "block" }}>Export this workspace</span><span className="row-sub">Everything as one file you can read. Sign-ins and tokens are left out.</span></span><button className="btn tinted sm" onClick={exportIt}>Export</button></div>
        <div className="row"><span className="glyph"><Icon name="refresh" size={16} /></span><span className="row-main"><span className="row-title" style={{ display: "block" }}>Reset this workspace</span><span className="row-sub">Clears your changes here and brings back the starting examples.</span></span>
          {ask === "workspace" ? <span className="flex gap-1"><button className="btn sm danger" onClick={() => reset("workspace")}>Reset</button><button className="btn sm" onClick={() => setAsk(null)}>Cancel</button></span> : <button className="btn sm" onClick={() => setAsk("workspace")}>Reset</button>}</div>
        <div className="row"><span className="glyph bad"><Icon name="trash" size={16} /></span><span className="row-main"><span className="row-title" style={{ display: "block" }}>Delete all data</span><span className="row-sub">Removes every workspace and connection from this laptop.</span></span>
          {ask === "all" ? <span className="flex gap-1"><button className="btn sm danger" onClick={() => reset("all")}>Delete everything</button><button className="btn sm" onClick={() => setAsk(null)}>Cancel</button></span> : <button className="btn sm danger" onClick={() => setAsk("all")}>Delete</button>}</div>
      </div>
      <Fold open={!!json}>
        <div className="card pad stack" style={{ gap: 10 }}>
          <div className="flex items-center justify-between gap-2"><span className="t-head">Your export</span><span className="flex gap-2"><button className="btn sm tinted" onClick={copy}><Icon name="copy" size={14} />Copy</button><button className="btn sm" onClick={() => setJson(null)}>Close</button></span></div>
          <pre className="export num" tabIndex={0}>{json}</pre>
        </div>
      </Fold>
    </div>
  );
}

export default function Settings() {
  const q = useApi("settings");
  return (
    <Page title="Settings" sub="Make it yours. Changes save on this laptop straight away.">
      <Load q={q} skeleton={<SkelRows n={6} />}>
        {(d) => (
          <div className="stack">
            <Section title="Look"><Appearance d={d} /></Section>
            <Section title="Ranking" i={1}><Rubric d={d} /></Section>
            <Section title="Pages" i={2}><Pages d={d} /><p className="t-foot faint" style={{ padding: "10px 6px 0" }}>Overview, Attention, Connections, Setup and Settings always stay on.</p></Section>
            <Section title="Workspaces" i={3}><Workspaces d={d} /></Section>
            <Section title="Your data" i={4}><Data /><p className="t-foot faint" style={{ padding: "10px 6px 0" }}>Template version {d.workspace.templateVersion}. Each workspace keeps its own data, connections and ranking rules, and never sees another workspace.</p></Section>
          </div>
        )}
      </Load>
    </Page>
  );
}

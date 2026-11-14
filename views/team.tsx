"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, onWatchRequest, takeWatch, useApi, useApp } from "@/lib/client";
import { ago } from "@/lib/format";
import { HandoverScene } from "@/components/handover-scene";
import { Icon, Load, Page, SampleTag, Section, Segmented, SkelCards, Switch } from "@/components/ui";
import { BEARDS, Character, DEFAULT_LOOK, HAIRS, HAIR_COLORS, HAIR_COLOR_NAMES, Look, SKINS, SKIN_NAMES, TOPS, TOP_NAMES } from "@/components/character";

const DAY = 24 * 3600000;

function Swatches({ label, colors, names, value, onChange }: { label: string; colors: string[]; names: string[]; value: number; onChange: (n: number) => void }) {
  return (
    <div className="look-row"><span className="t-cap">{label}</span>
      <div className="swatches" role="radiogroup" aria-label={label}>
        {colors.map((c, n) => <button key={c} type="button" role="radio" aria-checked={value === n} aria-label={names[n]} title={names[n]} className="swatch" style={{ background: c }} onClick={() => onChange(n)} />)}
      </div>
    </div>
  );
}

/** The card that opens from a person: name, role, who they work under, and how their character looks. */
function PersonForm({ person, people, close }: { person: any | null; people: any[]; close: () => void }) {
  const app = useApp();
  const leader = !!person?.leader;
  const [name, setName] = useState(person?.name || "");
  const [role, setRole] = useState(person?.role || "");
  const [email, setEmail] = useState(person?.email || "");
  const [parent, setParent] = useState(person?.parent || people[0]?.id);
  const [look, setLook] = useState<Look>({ ...DEFAULT_LOOK, ...(person?.look || { skin: 2, top: (people.length * 2) % TOPS.length }) });
  const [busy, setBusy] = useState(false);
  const set = (k: Partial<Look>) => setLook((l) => ({ ...l, ...k }));
  const under = (id: string): string[] => people.filter((p) => p.parent === id).flatMap((p) => [p.id, ...under(p.id)]);
  const bosses = people.filter((p) => !person || (p.id !== person.id && !under(person.id).includes(p.id)));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api(person ? "team/" + person.id : "team", { method: "POST", body: { name, role, parent, look, email } }); app.toast(person ? "Saved" : `${name.trim()} added`); close(); }
    catch (err: any) { app.toast(err.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api("team/" + person.id, { method: "POST", body: { action: "remove" } }); app.toast(`${person.name} removed`); close(); }
    catch (err: any) { app.toast(err.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="stack" style={{ gap: 16 }}>
      <div className="inset person-preview">
        <Character look={look} size={112} label={`Character for ${name || "this person"}`} />
        <div style={{ minWidth: 0 }}>
          <div className="t-head" style={{ fontSize: 19 }}>{name.trim() || "New person"}</div>
          <span className={"chip " + (leader ? "leader" : "accent")} style={{ marginTop: 8 }}>{leader && <Icon name="star" size={13} />}{leader ? "The Leader" : role.trim() || "Team member"}</span>
        </div>
      </div>
      <div className="inset stack" style={{ gap: 12, padding: 18 }}>
        <label><span className="t-cap">Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="First name" autoComplete="off" /></label>
        {leader
          ? <p className="t-foot">The first person is always The Leader. Put your own name here.</p>
          : <>
            <label><span className="t-cap">Role</span><input className="input" value={role} onChange={(e) => setRole(e.target.value)} maxLength={40} placeholder="Any role, like Designer" autoComplete="off" /></label>
            <label><span className="t-cap">Email (optional)</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} placeholder="Only used to send them your alerts" autoComplete="off" /></label>
            <label><span className="t-cap">Works under</span><select className="input" value={parent} onChange={(e) => setParent(e.target.value)}>{bosses.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}</select></label>
          </>}
      </div>
      <div className="inset stack" style={{ gap: 14, padding: 18 }}>
        <Swatches label="Skin" colors={SKINS} names={SKIN_NAMES} value={look.skin} onChange={(n) => set({ skin: n })} />
        <div className="look-row"><span className="t-cap">Hair</span><div className="pills" role="radiogroup" aria-label="Hair">{HAIRS.map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={look.hair === v} className="pill" onClick={() => set({ hair: v })}>{t}</button>)}</div></div>
        <Swatches label="Hair colour" colors={HAIR_COLORS} names={HAIR_COLOR_NAMES} value={look.hairColor} onChange={(n) => set({ hairColor: n })} />
        <div className="look-row"><span className="t-cap">Beard</span><Segmented label="Beard" value={look.beard} onChange={(v) => set({ beard: v })} options={BEARDS.map(([value, label]) => ({ value, label }))} /></div>
        <Swatches label="Jacket" colors={TOPS} names={TOP_NAMES} value={look.top} onChange={(n) => set({ top: n })} />
        <div className="look-row"><span className="t-cap">Glasses</span><Switch label="Glasses" checked={look.glasses} onChange={(v) => set({ glasses: v })} /></div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn primary lg" disabled={busy || !name.trim()} style={{ flex: 1 }}>{person ? "Save" : "Add to the team"}</button>
        {person && !leader && <button type="button" className="btn lg danger" disabled={busy} onClick={remove}>Remove</button>}
      </div>
    </form>
  );
}

function PersonCard({ p, people, n, got }: { p: any; people: any[]; n: number; got: any[] }) {
  const app = useApp();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button ref={ref} data-person={p.id} className={"card tap person rise" + (p.leader ? " is-leader" : "")} style={{ ["--i" as any]: n }} onClick={() => app.openCard({ title: p.name, chip: "Your team", render: (close) => <PersonForm person={p} people={people} close={close} /> }, ref.current)} aria-label={`${p.name}, ${p.role}${got.length ? `, ${got.length} new ${got.length === 1 ? "task" : "tasks"}` : ""}. Open to edit`}>
      {got.length > 0 && <span className="person-tasks" title={got.map((h) => `${h.title} (from ${h.fromName})`).join("\n")}><Icon name="doc" size={13} />{got.length}</span>}
      <span className="person-edit" aria-hidden><Icon name="edit" size={14} /></span>
      <span className="person-face" style={{ ["--d" as any]: `${-n * 1.7}s` }}><Character look={p.look} size={p.leader ? 124 : 104} /></span>
      <span className="person-name">{p.name}</span>
      <span className={"chip " + (p.leader ? "leader" : "role")}>{p.leader && <Icon name="star" size={13} />}{p.role}</span>
    </button>
  );
}

function Branch({ p, people, order, recent }: { p: any; people: any[]; order: Map<string, number>; recent: any[] }) {
  const kids = people.filter((x) => x.parent === p.id);
  return (
    <li>
      <PersonCard p={p} people={people} n={order.get(p.id) || 0} got={recent.filter((h) => h.to === p.id)} />
      {kids.length > 0 && <ul>{kids.map((k) => <Branch key={k.id} p={k} people={people} order={order} recent={recent} />)}</ul>}
    </li>
  );
}

/** Recent handovers, each with its own Watch it live. */
function Handovers({ list, people, play }: { list: any[]; people: any[]; play: (ids: string[]) => void }) {
  const look = (id: string) => people.find((p) => p.id === id)?.look;
  return (
    <Section title="Handovers">
      <div className="card group">
        {list.map((h) => (
          <div key={h.id} className="row handover-row">
            <span className="handover-pair" aria-hidden="true"><Character look={look(h.from)} size={34} still /><Icon name="chevron" size={14} /><Character look={look(h.to)} size={34} still /></span>
            <span className="row-main">
              <span className="row-title" style={{ display: "block" }}>{h.title}</span>
              <span className="row-sub"><b style={{ fontWeight: 600, color: "var(--text)" }}>{h.fromName}</b> to <b style={{ fontWeight: 600, color: "var(--text)" }}>{h.toName}</b> · {h.via === "alert" ? "Alert" : "Linear"} · {ago(h.at)}</span>
            </span>
            <button className="btn sm tinted" onClick={() => play([h.id])} aria-label={`Watch it live: ${h.fromName} hands ${h.title} to ${h.toName}`}><Icon name="play" size={13} />Watch it live</button>
          </div>
        ))}
      </div>
      <p className="t-foot" style={{ marginTop: 10 }}>A handover is a Linear task you gave someone on your team, or an alert you sent them from an item. Change what everyone says in Settings.</p>
    </Section>
  );
}

export default function Team() {
  const app = useApp();
  const q = useApi("team");
  const addRef = useRef<HTMLButtonElement>(null);
  const [watch, setWatch] = useState<string[] | null>(null);
  const [plays, setPlays] = useState(0);
  const add = (people: any[]) => app.openCard({ title: "Add a person", chip: "Your team", render: (close) => <PersonForm person={null} people={people} close={close} /> }, addRef.current);
  const play = useCallback((ids: string[]) => { setWatch(ids); setPlays((n) => n + 1); }, []);
  // Pick up a Watch it live request from elsewhere in the app, now or while this page is open.
  useEffect(() => { const w = takeWatch(); if (w) play(w); return onWatchRequest(() => { const w2 = takeWatch(); if (w2) play(w2); }); }, [play]);
  const d = q.data;
  const scene = d && watch ? d.handovers.filter((h: any) => watch.includes(h.id)) : [];
  // Several people alerted at once come from one person: play them together.
  const together = scene.filter((h: any) => h.from === scene[0]?.from);
  return (
    <Page title="Your team" sub="Who leads, and who does what. Tap anyone to change their name, role or character." actions={<><SampleTag show={app.boot.workspace.sample} />{d && <button ref={addRef} className="btn primary" onClick={() => add(d.people)}><Icon name="plus" size={16} />Add person</button>}</>}>
      <Load q={q} skeleton={<SkelCards n={3} h={250} cols="grid-3" />}>
        {(d) => {
          const order = new Map<string, number>(d.people.map((p: any, n: number) => [p.id, n]));
          const recent = d.handovers.filter((h: any) => Date.now() - h.at < 7 * DAY);
          return (
            <>
              <div className="org-wrap">
                <ul className="org"><Branch p={d.people[0]} people={d.people} order={order} recent={recent} /></ul>
                {d.people.length === 1 && <p className="t-foot" style={{ textAlign: "center", marginTop: 22 }}>It is just you for now. Add the people you work with and they appear under you.</p>}
              </div>
              {d.handovers.length > 0 && <Handovers list={d.handovers.slice(0, 6)} people={d.people} play={play} />}
            </>
          );
        }}
      </Load>
      {d && together.length > 0 && <HandoverScene key={together.map((h: any) => h.id).join("|")} list={together} people={d.people} phrases={d.phrases} plays={plays} onReplay={() => setPlays((n) => n + 1)} onClose={() => setWatch(null)} />}
    </Page>
  );
}

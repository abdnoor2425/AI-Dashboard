"use client";
import React, { useRef, useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { Icon, Load, Page, SampleTag, Segmented, SkelCards, Switch } from "@/components/ui";
import { BEARDS, Character, DEFAULT_LOOK, HAIRS, HAIR_COLORS, HAIR_COLOR_NAMES, Look, SKINS, SKIN_NAMES, TOPS, TOP_NAMES } from "@/components/character";

const ROLE_TONES = ["mint", "coral", "violet", "amber"];

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
  const [parent, setParent] = useState(person?.parent || people[0]?.id);
  const [look, setLook] = useState<Look>({ ...DEFAULT_LOOK, ...(person?.look || { skin: 2, top: (people.length * 2) % TOPS.length }) });
  const [busy, setBusy] = useState(false);
  const set = (k: Partial<Look>) => setLook((l) => ({ ...l, ...k }));
  const under = (id: string): string[] => people.filter((p) => p.parent === id).flatMap((p) => [p.id, ...under(p.id)]);
  const bosses = people.filter((p) => !person || (p.id !== person.id && !under(person.id).includes(p.id)));
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api(person ? "team/" + person.id : "team", { method: "POST", body: { name, role, parent, look } }); app.toast(person ? "Saved" : `${name.trim()} added`); close(); }
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
            <label><span className="t-cap">Works under</span><select className="input" value={parent} onChange={(e) => setParent(e.target.value)}>{bosses.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}</select></label>
          </>}
      </div>
      <div className="inset stack" style={{ gap: 14, padding: 18 }}>
        <Swatches label="Skin" colors={SKINS} names={SKIN_NAMES} value={look.skin} onChange={(n) => set({ skin: n })} />
        <div className="look-row"><span className="t-cap">Hair</span><div className="pills" role="radiogroup" aria-label="Hair">{HAIRS.map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={look.hair === v} className="pill" onClick={() => set({ hair: v })}>{t}</button>)}</div></div>
        <Swatches label="Hair colour" colors={HAIR_COLORS} names={HAIR_COLOR_NAMES} value={look.hairColor} onChange={(n) => set({ hairColor: n })} />
        <div className="look-row"><span className="t-cap">Beard</span><Segmented label="Beard" value={look.beard} onChange={(v) => set({ beard: v })} options={BEARDS.map(([value, label]) => ({ value, label }))} /></div>
        <Swatches label="Top" colors={TOPS} names={TOP_NAMES} value={look.top} onChange={(n) => set({ top: n })} />
        <div className="look-row"><span className="t-cap">Glasses</span><Switch label="Glasses" checked={look.glasses} onChange={(v) => set({ glasses: v })} /></div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn primary lg" disabled={busy || !name.trim()} style={{ flex: 1 }}>{person ? "Save" : "Add to the team"}</button>
        {person && !leader && <button type="button" className="btn lg danger" disabled={busy} onClick={remove}>Remove</button>}
      </div>
    </form>
  );
}

function PersonCard({ p, people, n }: { p: any; people: any[]; n: number }) {
  const app = useApp();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button ref={ref} className={"card tap person rise" + (p.leader ? " is-leader" : "")} style={{ ["--i" as any]: n }} onClick={() => app.openCard({ title: p.name, chip: "Your team", render: (close) => <PersonForm person={p} people={people} close={close} /> }, ref.current)} aria-label={`${p.name}, ${p.role}. Open to edit`}>
      <span className="person-edit" aria-hidden><Icon name="edit" size={14} /></span>
      <span className="person-face" style={{ animationDelay: `${-n * 1.300}s` }}><Character look={p.look} size={p.leader ? 124 : 104} /></span>
      <span className="person-name">{p.name}</span>
      <span className={"chip " + (p.leader ? "leader" : "role " + ROLE_TONES[(n - 1) % ROLE_TONES.length])}>{p.leader && <Icon name="star" size={13} />}{p.role}</span>
    </button>
  );
}

function Branch({ p, people, order }: { p: any; people: any[]; order: Map<string, number> }) {
  const kids = people.filter((x) => x.parent === p.id);
  return (
    <li>
      <PersonCard p={p} people={people} n={order.get(p.id) || 0} />
      {kids.length > 0 && <ul>{kids.map((k) => <Branch key={k.id} p={k} people={people} order={order} />)}</ul>}
    </li>
  );
}

export default function Team() {
  const app = useApp();
  const q = useApi("team");
  const addRef = useRef<HTMLButtonElement>(null);
  const add = (people: any[]) => app.openCard({ title: "Add a person", chip: "Your team", render: (close) => <PersonForm person={null} people={people} close={close} /> }, addRef.current);
  return (
    <Page title="Your team" sub="Who leads, and who does what. Tap anyone to change their name, role or character." actions={<><SampleTag show={app.boot.workspace.sample} />{q.data && <button ref={addRef} className="btn primary" onClick={() => add(q.data.people)}><Icon name="plus" size={16} />Add person</button>}</>}>
      <Load q={q} skeleton={<SkelCards n={3} h={250} cols="grid-3" />}>
        {(d) => {
          const order = new Map<string, number>(d.people.map((p: any, n: number) => [p.id, n]));
          return (
            <div className="org-wrap">
              <ul className="org"><Branch p={d.people[0]} people={d.people} order={order} /></ul>
              {d.people.length === 1 && <p className="t-foot" style={{ textAlign: "center", marginTop: 22 }}>It is just you for now. Add the people you work with and they appear under you.</p>}
            </div>
          );
        }}
      </Load>
    </Page>
  );
}

"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, onWatchRequest, takeWatch, useApi, useApp } from "@/lib/client";
import { ago } from "@/lib/format";
import { HandoverScene } from "@/components/handover-scene";
import { Icon, Load, Page, SampleTag, Section, Segmented, SkelCards, SkelRows, Switch } from "@/components/ui";
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

function PersonCard({ p, n, got, picked, pick }: { p: any; n: number; got: any[]; picked: boolean; pick: (id: string) => void }) {
  return (
    <button data-person={p.id} aria-pressed={picked} className={"card tap person rise" + (p.leader ? " is-leader" : "") + (picked ? " is-picked" : "")} style={{ ["--i" as any]: n }} onClick={() => pick(p.id)} aria-label={`${p.name}, ${p.role}${got.length ? `, ${got.length} new ${got.length === 1 ? "task" : "tasks"}` : ""}. Show their tasks`}>
      {got.length > 0 && <span className="person-tasks" title={got.map((h) => `${h.title} (from ${h.fromName})`).join("\n")}><Icon name="doc" size={13} />{got.length}</span>}
      <span className="person-face" style={{ ["--d" as any]: `${-n * 1.7}s` }}><Character look={p.look} size={p.leader ? 124 : 104} /></span>
      <span className="person-name">{p.name}</span>
      <span className={"chip " + (p.leader ? "leader" : "role")}>{p.leader && <Icon name="star" size={13} />}{p.role}</span>
    </button>
  );
}

function Branch({ p, people, order, recent, picked, pick }: { p: any; people: any[]; order: Map<string, number>; recent: any[]; picked: string | null; pick: (id: string) => void }) {
  const kids = people.filter((x) => x.parent === p.id);
  return (
    <li>
      <PersonCard p={p} n={order.get(p.id) || 0} got={recent.filter((h) => h.to === p.id)} picked={picked === p.id} pick={pick} />
      {kids.length > 0 && <ul>{kids.map((k) => <Branch key={k.id} p={k} people={people} order={order} recent={recent} picked={picked} pick={pick} />)}</ul>}
    </li>
  );
}

const day = (t: number) => new Date(t).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
/** Shows the part of a line that matches the search. */
function Hit({ text, term }: { text: string; term: string }) {
  const i = term ? text.toLowerCase().indexOf(term) : -1;
  return i < 0 ? <>{text}</> : <>{text.slice(0, i)}<mark>{text.slice(i, i + term.length)}</mark>{text.slice(i + term.length)}</>;
}

/** What one person has on their plate: their Linear tasks and the emails you sent them, each opening in its own app. */
function Details({ person, people, onClose }: { person: any; people: any[]; onClose: () => void }) {
  const app = useApp();
  const q = useApi(`team/${person.id}/details`);
  const box = useRef<HTMLElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<"linear" | "email" | null>("linear");
  const [find, setFind] = useState("");
  useEffect(() => { box.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" }); }, [person.id]);
  const d = q.data;
  const term = find.trim().toLowerCase();
  const has = (...v: any[]) => !term || v.some((x) => String(x || "").toLowerCase().includes(term));
  const tasks: any[] = (d?.linear.list || []).filter((t: any) => has(t.title, t.key, t.state, t.project));
  const mails: any[] = (d?.email.list || []).filter((m: any) => has(m.subject));
  const first = person.name.split(" ")[0];
  const connect = (tool: string) => <a className="btn sm tinted" href="#connections">Connect {tool}</a>;
  const edit = () => app.openCard({ title: person.name, chip: "Your team", render: (close) => <PersonForm person={person} people={people} close={close} /> }, editRef.current);
  // Why a list is empty, in the person's own words, with the button that fixes it.
  const linearNote = !d ? "" : !d.linear.on ? "Linear is not connected yet." : d.linear.error ? d.linear.error : !d.linear.found ? `Nobody called ${person.name} was found in Linear. Add the email they use in Linear with Edit person.` : "";
  const emailNote = !d ? "" : !d.email.on ? "Gmail is not connected yet." : d.isOwner ? "This is you, so there are no emails to yourself here." : !d.email.hasEmail ? `Add an email for ${first} with Edit person, and the emails you sent them show here.` : d.email.error ? d.email.error : "";
  const sub = (k: "linear" | "email") => (!d ? "Loading" : k === "linear" ? (linearNote ? (d.linear.on ? "Needs a look" : "Not connected") : `${tasks.length === 1 ? "task" : "tasks"} assigned`) : emailNote ? (d.email.on ? (d.isOwner ? "Not for you" : "Needs an email") : "Not connected") : `${mails.length === 1 ? "email" : "emails"} you sent`);
  const count = (k: "linear" | "email") => (!d || (k === "linear" ? linearNote : emailNote) ? "–" : k === "linear" ? tasks.length : mails.length);
  return (
    <section ref={box} className="td rise" aria-label={`Details of tasks for ${person.name}`}>
      <div className="td-head">
        <div className="td-grow">
          <div className="t-cap">{person.role} · selected</div>
          <h2 className="td-title">Details of tasks for <em>{person.name}</em></h2>
        </div>
        <button ref={editRef} className="btn sm" onClick={edit}><Icon name="edit" size={13} />Edit person</button>
        {d?.linear.on && !d.sample && <a className="btn sm primary" href={`https://linear.new?assignee=${encodeURIComponent(d.isOwner ? "me" : person.name)}`} target="_blank" rel="noreferrer"><Icon name="plus" size={13} />Give a task</a>}
        <button className="td-x" onClick={onClose} aria-label="Close task details"><Icon name="x" size={14} /></button>
      </div>
      <label className="td-search"><Icon name="search" size={17} /><input value={find} onChange={(e) => setFind(e.target.value)} placeholder={`Search ${first}'s tasks and emails`} aria-label={`Search ${person.name}'s tasks and emails`} maxLength={80} />{find && <button type="button" className="td-clear" onClick={() => setFind("")} aria-label="Clear search"><Icon name="x" size={13} /></button>}</label>
      <div className="td-srcs">
        <button className="td-src" style={{ ["--c" as any]: "var(--td-linear)" }} aria-expanded={open === "linear"} onClick={() => setOpen(open === "linear" ? null : "linear")}><span className="td-k"><i />Linear</span><b>{count("linear")}</b><span>{sub("linear")}</span></button>
        <button className="td-src" style={{ ["--c" as any]: "var(--gold)" }} aria-expanded={open === "email"} onClick={() => setOpen(open === "email" ? null : "email")}><span className="td-k"><i />Email</span><b>{count("email")}</b><span>{sub("email")}</span></button>
        <button className="td-src" style={{ ["--c" as any]: "var(--good)" }} disabled><span className="td-k"><i />Slack</span><b>–</b><span>Coming once Slack can be connected</span></button>
      </div>
      {open && (
        <div className="td-card" key={open}>
          <div className="td-chead"><div className="td-grow"><b>{open === "linear" ? `Linear tasks for ${first}` : `Emails you sent ${first}`}</b><small>{!d ? "Loading" : (open === "linear" ? linearNote : emailNote) ? "Nothing to show yet" : `${open === "linear" ? tasks.length : mails.length} shown${term ? ` for "${find.trim()}"` : ""}`}</small></div><button className="td-x" onClick={() => setOpen(null)} aria-label="Close this list"><Icon name="x" size={14} /></button></div>
          {!d ? (q.error ? <p className="td-empty">{q.error}</p> : <div style={{ padding: 18 }}><SkelRows n={3} /></div>)
            : open === "linear"
              ? linearNote ? <div className="td-empty"><span>{linearNote}</span>{!d.linear.on && connect("Linear")}</div>
                : tasks.length === 0 ? <p className="td-empty">{term ? `No Linear task for ${first} matches "${find.trim()}".` : `Nothing in Linear is assigned to ${first} right now.`}</p>
                  : tasks.map((t) => (
                    <div key={t.id} className="td-row">
                      <div className="td-t"><b><Hit text={t.title} term={term} /></b><span><Hit text={[t.key, t.project, t.doneAt ? "done " + day(t.doneAt) : t.due ? "due " + day(t.due) : "no due date"].filter(Boolean).join(" · ")} term={term} /></span></div>
                      <span className={"td-tag " + t.tone}>{t.state}</span>
                      {/^https?:/.test(t.url) && <a className="btn sm" href={t.url} target="_blank" rel="noreferrer" aria-label={`See ${t.key || t.title} on Linear`}>See on Linear<Icon name="external" size={13} /></a>}
                    </div>
                  ))
              : emailNote ? <div className="td-empty"><span>{emailNote}</span>{!d.email.on && connect("Gmail")}</div>
                : mails.length === 0 ? <p className="td-empty">{term ? `No email to ${first} matches "${find.trim()}".` : d.sample ? `No example emails for ${first}.` : `None of your last 60 sent emails went to ${first}.`}</p>
                  : mails.map((m) => (
                    <div key={m.id} className="td-row">
                      <div className="td-t"><b><Hit text={m.subject} term={term} /></b><span>Sent {ago(m.at)}</span></div>
                      {/^https?:/.test(m.url) && <a className="btn sm" href={m.url} target="_blank" rel="noreferrer" aria-label={`See "${m.subject}" in Gmail`}>See in Gmail<Icon name="external" size={13} /></a>}
                    </div>
                  ))}
        </div>
      )}
      <p className="td-foot">{d?.sample ? "Example data. With your own tools connected, this shows the person's real Linear tasks and the emails you sent them." : "Linear shows tasks assigned to this person. Email shows what you sent them, found in your last 60 sent emails by the email on their card. Nothing is changed in either app."}</p>
    </section>
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
  const [picked, setPicked] = useState<string | null>(null);
  const pick = useCallback((id: string) => setPicked((now) => (now === id ? null : id)), []);
  const add = (people: any[]) => app.openCard({ title: "Add a person", chip: "Your team", render: (close) => <PersonForm person={null} people={people} close={close} /> }, addRef.current);
  const play = useCallback((ids: string[]) => { setWatch(ids); setPlays((n) => n + 1); }, []);
  // Pick up a Watch it live request from elsewhere in the app, now or while this page is open.
  useEffect(() => { const w = takeWatch(); if (w) play(w); return onWatchRequest(() => { const w2 = takeWatch(); if (w2) play(w2); }); }, [play]);
  const d = q.data;
  const scene = d && watch ? d.handovers.filter((h: any) => watch.includes(h.id)) : [];
  // Several people alerted at once come from one person: play them together.
  const together = scene.filter((h: any) => h.from === scene[0]?.from);
  return (
    <Page title="Your team" sub="Who leads, and who does what. Tap anyone to see their tasks, or to change their name, role or character." actions={<><SampleTag show={app.boot.workspace.sample} />{d && <button ref={addRef} className="btn primary" onClick={() => add(d.people)}><Icon name="plus" size={16} />Add person</button>}</>}>
      <Load q={q} skeleton={<SkelCards n={3} h={250} cols="grid-3" />}>
        {(d) => {
          const order = new Map<string, number>(d.people.map((p: any, n: number) => [p.id, n]));
          const recent = d.handovers.filter((h: any) => Date.now() - h.at < 7 * DAY);
          return (
            <>
              <div className="org-wrap">
                <ul className="org"><Branch p={d.people[0]} people={d.people} order={order} recent={recent} picked={picked} pick={pick} /></ul>
                {d.people.length === 1 && <p className="t-foot" style={{ textAlign: "center", marginTop: 22 }}>It is just you for now. Add the people you work with and they appear under you.</p>}
              </div>
              {(() => { const who = d.people.find((p: any) => p.id === picked); return who ? <Details key={who.id} person={who} people={d.people} onClose={() => setPicked(null)} /> : d.people.length > 1 ? <p className="t-foot td-hint">Tap a person to see their Linear tasks and the emails you sent them.</p> : null; })()}
              {d.handovers.length > 0 && <Handovers list={d.handovers.slice(0, 6)} people={d.people} play={play} />}
            </>
          );
        }}
      </Load>
      {d && together.length > 0 && <HandoverScene key={together.map((h: any) => h.id).join("|")} list={together} people={d.people} phrases={d.phrases} plays={plays} onReplay={() => setPlays((n) => n + 1)} onClose={() => setWatch(null)} />}
    </Page>
  );
}

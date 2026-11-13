"use client";
import React, { useEffect, useRef, useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { growFrom, shrinkTo } from "@/lib/motion";
import { ago, clock, dateLong, dueLabel } from "@/lib/format";
import { Icon, Menu, Skel } from "./ui";
import { Character } from "./character";
import { Logo, toolName } from "./logos";

/** The tool an item mainly came from. Work tools (Linear, Gmail, Slack) win over supporting files. */
export const mainSource = (item: any) => (item.sources || []).find((x: any) => ["linear", "gmail", "slack"].includes(x.tool)) || (item.sources || [])[0] || null;

const KIND: Record<string, string> = { decision: "Decision", approval: "Approval", reply: "Reply", risk: "Risk" };
const EVIDENCE: Record<string, { label: string; tone: string; text: string }> = {
  verified: { label: "Verified", tone: "good", text: "Checked against the original source." },
  "needs-context": { label: "Needs context", tone: "warn", text: "Some facts are missing, so the score is provisional." },
  stale: { label: "Stale", tone: "warn", text: "This has not been checked against its source recently." },
  conflicting: { label: "Conflicting", tone: "bad", text: "Two sources disagree. Check before acting." },
};

/** The default card: only the action, the next step and a deadline when one exists. Scores and sources stay behind a tap. */
export function AttentionRow({ item, showScope, team, rank }: { item: any; showScope?: boolean; team?: boolean; rank?: number }) {
  const from = mainSource(item);
  const app = useApp();
  const ref = useRef<HTMLButtonElement>(null);
  const due = dueLabel(team ? item.followUpDue : item.due);
  const urgent = due?.tone === "bad" && !team;
  return (
    <button ref={ref} className="row" data-item={item.id} onClick={() => app.openItem(item.id, ref.current)} aria-label={`${item.title}. ${item.nextStep}${due ? ". " + due.text : ""}. Open details`}>
      {rank ? <span className={"rank num" + (rank === 1 ? " first" : "")}>{rank}</span> : <span className={"glyph " + (urgent ? "bad" : team ? "" : "accent")}><Icon name={team ? "person" : item.kind} size={17} /></span>}
      <span className="row-main">
        <span className="row-title" style={{ display: "block" }}>{item.title}</span>
        <span className="row-sub">{team ? <><b style={{ fontWeight: 600, color: "var(--text)" }}>{item.owner}</b> · {item.nextStep}</> : <>{from && <span className="from"><Logo tool={from.tool} size={18} /><b>{toolName(from.tool)}</b></span>}{item.scopeLabel && <span className="site-tag">{item.scopeLabel}</span>}{item.nextStep}</>}</span>
      </span>
      {item.pin != null && <span title="You set this order" aria-label="Pinned by you" style={{ color: "var(--text-3)", display: "flex" }}><Icon name="pin" size={15} /></span>}
      {item.warn && !team && <span className="dot warn" role="img" aria-label="Needs checking before you act" title="Needs checking" />}
      {due && <span className={"chip num " + (due.tone === "calm" ? "" : due.tone)}>{team ? "Follow up " + due.text.replace(/^Today /, "today ").replace(/^Tomorrow /, "tomorrow ") : due.text}</span>}
      <Icon name="chevron" size={16} className="chev" />
    </button>
  );
}

const names = (l: string[]) => (l.length < 2 ? l.join("") : l.slice(0, -1).join(", ") + " and " + l[l.length - 1]);

/** For a Linear ticket: who it is assigned to, and a comment box that posts back to the ticket. */
function LinearBlock({ it, team, ai, act, busy }: { it: any; team: any[]; ai: string; act: (a: string, b?: any, m?: string) => Promise<void>; busy: boolean }) {
  const [text, setText] = useState("");
  const src = it.sources.find((x: any) => x.tool === "linear");
  const who = team.find((p) => p.name === it.assignee);
  const first = it.assignee ? String(it.assignee).split(" ")[0] : "the team";
  return (
    <div>
      <h3 className="t-head" style={{ marginBottom: 10 }}>On Linear</h3>
      <div className="inset" style={{ padding: 16 }}>
        <div className="flex items-center gap-3">
          {who ? <Character look={who.look} size={46} still /> : <span className="glyph" style={{ width: 46, height: 46, borderRadius: 23 }}><Icon name="person" size={20} /></span>}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="t-cap">{it.assignedByMe ? "You assigned this to" : "Assigned to"}</div>
            <div style={{ fontWeight: 700, fontSize: 16.5, letterSpacing: "-0.01em" }}>{it.assignee || "Nobody yet"}{who && <span className="t-foot" style={{ fontWeight: 500, marginLeft: 8 }}>{who.role}</span>}</div>
          </div>
          <span className="chip line num"><Logo tool="linear" size={16} />{src.ref}</span>
        </div>
        {(it.comments || []).map((c: any, i: number) => (
          <div key={i} className="said"><p>{c.text}</p><span className="t-cap"><Icon name="check" size={12} stroke={2.4} />Posted to {c.ref} {ago(c.at)}</span></div>
        ))}
        <label className="t-cap" htmlFor={"cm-" + it.id} style={{ display: "block", marginTop: 14 }}>Comment for {first}</label>
        <textarea id={"cm-" + it.id} className="input" rows={3} style={{ marginTop: 6 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={`Write what ${first} needs to know`} />
        <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginTop: 10 }}>
          <span className="t-foot faint flex items-center gap-2" style={{ flex: "1 1 180px" }}><Icon name="sparkle" size={14} />Goes straight onto {src.ref}. {ai} can post for you too.</span>
          <button className="btn primary" disabled={busy || text.trim().length < 2} onClick={async () => { await act("comment", { text }, `Comment posted on ${src.ref}`); setText(""); }}><Icon name="send" size={15} />Post to Linear</button>
        </div>
      </div>
    </div>
  );
}

/** Pick one or more people from Your team and send them a nudge about this item: a Linear mention, or an email when Linear cannot reach them. */
function AlertBlock({ it, team }: { it: any; team: any[] }) {
  const app = useApp();
  const others = team.slice(1);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const last = (it.alerts || [])[it.alerts?.length - 1];
  const how = last?.how ? [last.how.linear?.length ? `${names(last.how.linear)} on Linear` : "", last.how.email?.length ? `${names(last.how.email)} by email` : ""].filter(Boolean).join(", ") : "";
  const toggle = (id: string) => { setProblem(""); setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); };
  const needsMail = /permission to send from Gmail|allowed to send yet/i.test(problem);
  const send = async () => {
    setBusy(true); setProblem("");
    try {
      const r = await api(`attention/${it.id}/alert`, { method: "POST", body: { people: picked, note } });
      app.toast(r.warning || `Alert sent to ${names(r.to || [])}`);
      setOpen(false); setPicked([]); setNote("");
    } catch (e: any) { setProblem(e.message); } finally { setBusy(false); }
  };
  const allowMail = async () => {
    setBusy(true);
    try { const r = await api("connections/gmail", { method: "POST", body: { action: "connect", send: true } }); if (r?.redirect) window.location.href = r.redirect; else setProblem(r?.needs || "Connect Google on the Connections page first."); }
    catch (e: any) { setProblem(e.message); } finally { setBusy(false); }
  };
  return (
    <div>
      <h3 className="t-head" style={{ marginBottom: 10 }}>Alert your team</h3>
      {last && !open && <div className="sent" role="status"><span className="sent-tick"><Icon name="check" size={16} stroke={2.6} /></span><div><b>Alert sent to {names(last.to)}</b><span className="t-foot" style={{ display: "block" }}>{ago(last.at)}{how ? ` · ${how}` : ""}{last.note ? ` · "${last.note}"` : ""}</span></div></div>}
      {!open ? <button className="btn tinted lg" style={{ width: "100%", marginTop: last ? 10 : 0 }} onClick={() => setOpen(true)}><Icon name="attention" size={17} />{last ? "Alert someone else" : "Alert your team"}</button> : (
        <div className="inset" style={{ padding: 16 }}>
          {!others.length ? <p className="t-foot">Add people on the Your team page first, then you can alert them here.</p> : <>
            <div className="t-cap" style={{ marginBottom: 10 }}>Who should know? Pick one or more.</div>
            <div className="pick-grid" role="group" aria-label="People to alert">
              {others.map((p) => { const on = picked.includes(p.id); return (
                <button key={p.id} type="button" role="checkbox" aria-checked={on} className={"pick" + (on ? " on" : "")} onClick={() => toggle(p.id)}>
                  <Character look={p.look} size={40} still />
                  <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}><span style={{ display: "block", fontWeight: 680, fontSize: 14.5 }}>{p.name}</span><span className="t-cap" style={{ fontWeight: 500 }}>{p.role}</span></span>
                  <span className="pick-box">{on && <Icon name="check" size={13} stroke={3} />}</span>
                </button>
              ); })}
            </div>
            <input className="input" style={{ marginTop: 12 }} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Add a short note (optional)" aria-label="Note for the alert" />
            {problem && <div className="problem" role="alert"><span>{problem}</span>{needsMail && <button type="button" className="btn sm" disabled={busy} onClick={allowMail}>Allow Gmail to send alerts</button>}</div>}
            <div className="flex gap-2" style={{ marginTop: 12 }}>
              <button className="btn primary lg" style={{ flex: 1 }} disabled={busy || !picked.length} onClick={send}><Icon name="send" size={15} />{busy ? "Sending" : picked.length ? `Send alert to ${picked.length} ${picked.length === 1 ? "person" : "people"}` : "Send alert"}</button>
              <button className="btn lg" onClick={() => { setOpen(false); setProblem(""); }}>Cancel</button>
            </div>
            <p className="t-foot faint" style={{ marginTop: 10 }}>{it.sources.some((x: any) => x.tool === "linear") ? "They get a mention on the Linear ticket. Anyone not on Linear gets an email." : "They get a short email from your Gmail."}</p>
          </>}
        </div>
      )}
    </div>
  );
}

export function ItemSheet({ id, from, onClose }: { id: string; from: HTMLElement | null; onClose: () => void }) {
  const app = useApp();
  const q = useApi("attention", { scope: "all" });
  const teamQ = useApi("team");
  const aiQ = useApi("ai/status");
  const ref = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const fromRect = useRef(from?.getBoundingClientRect() || null);
  const all = q.data ? [...q.data.needsYou, ...q.data.team, ...q.data.verify, ...q.data.snoozed, ...q.data.done] : [];
  const item = all.find((i: any) => i.id === id);
  const last = useRef<any>(null);
  if (item) last.current = item;
  const it = item || last.current;

  useEffect(() => { if (ref.current) growFrom(ref.current, fromRect.current, { radius: 18 }); closeBtn.current?.focus({ preventScroll: true }); }, []);
  const close = async () => {
    if (closing) return; setClosing(true);
    const target = typeof document !== "undefined" ? document.querySelector<HTMLElement>(`[data-item="${id}"]`) : null;
    if (ref.current) await shrinkTo(ref.current, target?.getBoundingClientRect() || null);
    onClose(); (target || from)?.focus?.({ preventScroll: true });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input, [tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", key, true); return () => document.removeEventListener("keydown", key, true);
  });

  const act = async (action: string, body: any = {}, msg?: string, thenClose = false): Promise<void> => {
    setBusy(true);
    try { await api(`attention/${id}/${action}`, { method: "POST", body: { reason, ...body } }); if (msg) app.toast(msg); setReason(""); if (thenClose) close(); }
    catch (e: any) { app.toast(e.message); } finally { setBusy(false); }
  };
  const ev = it ? EVIDENCE[it.evidence] : null;
  const due = it ? dueLabel(it.due) : null;
  const isDone = it && (it.status !== "open" || it.dismissed);
  const snoozed = it?.snoozedUntil && it.snoozedUntil > Date.now();
  const mine = it?.waitingOn === "me";
  const team: any[] = teamQ.data?.people || [];
  const linear = it?.sources.some((x: any) => x.tool === "linear");
  const src = it ? mainSource(it) : null;
  const aiName = aiQ.data?.available ? ({ claude: "Claude Code", codex: "Codex" } as any)[aiQ.data.provider] || aiQ.data.provider : "Your AI";

  return (
    <>
      <div className={"scrim" + (closing ? " out" : "")} onClick={close} />
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={it ? it.title : "Details"}>
        <div className="sheet-head">
          <span className="chip accent">{it ? (mine ? KIND[it.kind] : "Waiting on " + it.owner) : "Loading"}</span>
          {src && <span className="chip"><Logo tool={src.tool} size={16} />{toolName(src.tool)}</span>}
          {it?.scopeLabel && <span className="chip">{it.scopeLabel}</span>}
          <span style={{ flex: 1 }} />
          <button ref={closeBtn} className="icon-btn" onClick={close} aria-label="Close details"><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body">
          {!it ? <div className="stack" style={{ gap: 14 }}><Skel h={28} w="80%" /><Skel w="60%" /><Skel h={120} r={18} /><Skel h={200} r={18} /></div> : (
            <div className="stack" style={{ gap: 18 }}>
              <div>
                <h2 className="t-mid" style={{ textWrap: "balance" as any }}>{it.title}</h2>
                <p style={{ fontSize: 16, marginTop: 8, color: "var(--text-2)" }}><b style={{ color: "var(--text)", fontWeight: 600 }}>Next step:</b> {it.nextStep}</p>
                <div className="flex gap-2 flex-wrap" style={{ marginTop: 12 }}>
                  {due && <span className={"chip num " + (due.tone === "calm" ? "" : due.tone)}><Icon name="clock" size={13} />{it.due < Date.now() ? "Was due " : "Due "}{dateLong(it.due)}, {clock(it.due)}</span>}
                  {!due && mine && <span className="chip">No fixed deadline</span>}
                  {it.pin != null && <span className="chip"><Icon name="pin" size={13} />Your order</span>}
                  {snoozed && <span className="chip warn">Snoozed until {dateLong(it.snoozedUntil)}</span>}
                  {isDone && <span className="chip good"><Icon name="check" size={13} />{it.dismissed ? "Dismissed" : "Done"}</span>}
                </div>
              </div>

              {it.consequence && <div className="quote"><div className="t-cap" style={{ marginBottom: 4 }}>If this waits</div>{it.consequence}</div>}

              {!it.complete && !isDone && q.data.factors.some((f: any) => it.factorsResolved[f.key] == null) && (
                <div className="inset" style={{ padding: "2px 16px 14px" }}><Facts item={it} factors={q.data.factors} onSave={(facts) => act("facts", { facts }, "Saved")} busy={busy} /></div>
              )}

              {linear && <LinearBlock it={it} team={team} ai={aiName} act={act} busy={busy} />}

              {!isDone && <AlertBlock it={it} team={team} />}

              <div>
                <h3 className="t-head" style={{ marginBottom: 10 }}>Sources{it.merged > 1 && <span className="t-foot" style={{ fontWeight: 500, marginLeft: 8 }}>{it.merged} records about the same thing, shown as one</span>}</h3>
                <div className="inset group">
                  {it.sources.map((s: any, i: number) => (
                    <a key={i} className="row flush" href={s.url || "#"} target={s.url && s.url !== "#" ? "_blank" : undefined} rel="noreferrer" onClick={(e) => { if (!s.url || s.url === "#") { e.preventDefault(); app.toast("Sample data has no real source to open."); } }} style={{ minHeight: 48, padding: "10px 14px" }}>
                      <Logo tool={s.tool} size={30} />
                      <span className="row-main"><span style={{ fontSize: 14.5, fontWeight: 560, display: "block" }}>{s.label}</span><span className="t-cap" style={{ fontWeight: 500 }}>{toolName(s.tool)}</span></span>
                      {s.ref && <span className="t-cap num">{s.ref}</span>}
                      <Icon name="external" size={15} className="chev" />
                    </a>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
        {it && (
          <div className="sheet-foot">
            {isDone ? <button className="btn" disabled={busy} onClick={() => act("reopen", {}, "Back in your list")}>Put back in my list</button> : (
              <>
                <button className="btn primary" disabled={busy} onClick={() => act("done", {}, "Done. Nice work.", true)}><Icon name="check" size={16} stroke={2.2} />Mark done</button>
                {snoozed ? <button className="btn" disabled={busy} onClick={() => act("unsnooze", {}, "Back in your list")}>Wake now</button> : (
                  <Menu align="left" up label="Snooze" button={(p) => <button className="btn" disabled={busy} {...p}><Icon name="clock" size={16} />Snooze</button>}>
                    {(c) => <div style={{ position: "relative" }}>{[[1, "Until tomorrow"], [3, "For 3 days"], [7, "For a week"]].map(([d, l]) => <button key={d} role="menuitem" className="menu-item" onClick={() => { c(); act("snooze", { days: d }, "Snoozed. It will come back by itself.", true); }}>{l}</button>)}</div>}
                  </Menu>
                )}
                <button className="btn plain" style={{ color: "var(--text-2)" }} disabled={busy} onClick={() => act("dismiss", {}, "Dismissed", true)}>Dismiss</button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** Lets the person answer what the sources could not: each unknown gets a 0 to 5 answer, never a silent zero. */
function Facts({ item, factors, onSave, busy }: { item: any; factors: any[]; onSave: (f: Record<string, number>) => void; busy: boolean }) {
  const unknown = factors.filter((f) => item.factorsResolved[f.key] == null);
  const [v, setV] = useState<Record<string, number>>({});
  if (!unknown.length) return null;
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--sep)" }}>
      <div className="t-cap" style={{ marginBottom: 8 }}>Fill in what you know</div>
      <div className="stack" style={{ gap: 10 }}>
        {unknown.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-3 flex-wrap">
            <span style={{ fontSize: 14.5, minWidth: 0 }}>{f.label}<span className="t-foot" style={{ display: "block" }}>{f.hint}</span></span>
            <span className="rate" role="radiogroup" aria-label={f.label + ", 0 to 5"}>{[0, 1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={v[f.key] === n} className="num" onClick={() => setV({ ...v, [f.key]: n })}>{n}</button>)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginTop: 12 }}><span className="t-foot faint">0 means none, 5 means the most.</span><button className="btn sm tinted" disabled={busy || !Object.keys(v).length} onClick={() => onSave(v)}>Save answers</button></div>
    </div>
  );
}

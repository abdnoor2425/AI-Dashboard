"use client";
import React, { useEffect, useRef, useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { growFrom, shrinkTo } from "@/lib/motion";
import { ago, clock, dateLong, dueLabel } from "@/lib/format";
import { Icon, Menu, Ring, Skel } from "./ui";

const KIND: Record<string, string> = { decision: "Decision", approval: "Approval", reply: "Reply", risk: "Risk" };
const EVIDENCE: Record<string, { label: string; tone: string; text: string }> = {
  verified: { label: "Verified", tone: "good", text: "Checked against the original source." },
  "needs-context": { label: "Needs context", tone: "warn", text: "Some facts are missing, so the score is provisional." },
  stale: { label: "Stale", tone: "warn", text: "This has not been checked against its source recently." },
  conflicting: { label: "Conflicting", tone: "bad", text: "Two sources disagree. Check before acting." },
};

/** The default card: only the action, the next step and a deadline when one exists. Scores and sources stay behind a tap. */
export function AttentionRow({ item, showScope, team }: { item: any; showScope?: boolean; team?: boolean }) {
  const app = useApp();
  const ref = useRef<HTMLButtonElement>(null);
  const due = dueLabel(team ? item.followUpDue : item.due);
  const urgent = due?.tone === "bad" && !team;
  return (
    <button ref={ref} className="row" data-item={item.id} onClick={() => app.openItem(item.id, ref.current)} aria-label={`${item.title}. ${item.nextStep}${due ? ". " + due.text : ""}. Open details`}>
      <span className={"glyph " + (urgent ? "bad" : team ? "" : "accent")}><Icon name={team ? "person" : item.kind} size={17} /></span>
      <span className="row-main">
        <span className="row-title" style={{ display: "block" }}>{item.title}</span>
        <span className="row-sub">{team ? <><b style={{ fontWeight: 600, color: "var(--text)" }}>{item.owner}</b> · {item.nextStep}</> : <>{showScope && item.scopeLabel ? item.scopeLabel + " · " : ""}{item.nextStep}</>}</span>
      </span>
      {item.pin != null && <span title="You set this order" aria-label="Pinned by you" style={{ color: "var(--text-3)", display: "flex" }}><Icon name="pin" size={15} /></span>}
      {item.warn && !team && <span className="dot warn" role="img" aria-label="Needs checking before you act" title="Needs checking" />}
      {due && <span className={"chip num " + (due.tone === "calm" ? "" : due.tone)}>{team ? "Follow up " + due.text.replace(/^Today /, "today ").replace(/^Tomorrow /, "tomorrow ") : due.text}</span>}
      <Icon name="chevron" size={16} className="chev" />
    </button>
  );
}

function FactorRow({ f, item, weight }: { f: any; item: any; weight: number }) {
  const v = item.factorsResolved[f.key], c = item.contributions[f.key], max = weight * 5;
  return (
    <div className="row flush" style={{ minHeight: 0, padding: "11px 14px", display: "block" }}>
      <div className="flex items-baseline justify-between gap-3">
        <span style={{ fontWeight: 560, fontSize: 14 }}>{f.label}</span>
        <span className="num" style={{ fontSize: 13.5, fontWeight: 600, color: v == null ? "var(--warn)" : "var(--text)" }}>{v == null ? "Unknown" : `${c} of ${max}`}</span>
      </div>
      <div className="bar-track" style={{ marginTop: 7, height: 6 }}>{v != null && <div className="bar-fill" style={{ width: `${(c / max) * 100}%` }} />}</div>
      <div className="t-foot" style={{ marginTop: 6 }}>{v == null ? "Not known yet, so it is left out. It is not counted as zero." : item.why?.[f.key] || `${f.hint}. Rated ${v} out of 5.`}</div>
    </div>
  );
}

export function ItemSheet({ id, from, onClose }: { id: string; from: HTMLElement | null; onClose: () => void }) {
  const app = useApp();
  const q = useApi("attention", { scope: "all" });
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

  const act = async (action: string, body: any = {}, msg?: string, thenClose = false) => {
    setBusy(true);
    try { await api(`attention/${id}/${action}`, { method: "POST", body: { reason, ...body } }); if (msg) app.toast(msg); setReason(""); if (thenClose) close(); }
    catch (e: any) { app.toast(e.message); } finally { setBusy(false); }
  };
  const ev = it ? EVIDENCE[it.evidence] : null;
  const due = it ? dueLabel(it.due) : null;
  const isDone = it && (it.status !== "open" || it.dismissed);
  const snoozed = it?.snoozedUntil && it.snoozedUntil > Date.now();
  const mine = it?.waitingOn === "me";

  return (
    <>
      <div className={"scrim" + (closing ? " out" : "")} onClick={close} />
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={it ? it.title : "Details"}>
        <div className="sheet-head">
          <span className="chip accent">{it ? (mine ? KIND[it.kind] : "Waiting on " + it.owner) : "Loading"}</span>
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

              <div>
                <h3 className="t-head" style={{ marginBottom: 10 }}>Why is this here now?</h3>
                <div className="inset" style={{ padding: 16, display: "flex", gap: 16, alignItems: "center" }}>
                  <Ring value={it.score / it.maxScore} size={84} stroke={9} id={"s" + it.id}><div><div className="num" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{it.score}</div><div className="t-cap" style={{ fontSize: 10.5 }}>of {it.maxScore}</div></div></Ring>
                  <div style={{ minWidth: 0 }}>
                    {!it.complete && <span className="chip warn" style={{ marginBottom: 8 }}>Provisional score</span>}
                    {it.pin != null && <div className="t-foot" style={{ marginBottom: 6 }}>You placed this by hand. The score is shown for reference only.</div>}
                    <ul style={{ display: "grid", gap: 6 }}>{it.topReasons.map((r: string, i: number) => <li key={i} className="flex gap-2" style={{ fontSize: 14.5 }}><span style={{ color: "var(--accent)", flex: "none", marginTop: 2 }}><Icon name="check" size={15} stroke={2.2} /></span>{r}</li>)}</ul>
                  </div>
                </div>
                <div className="inset group" style={{ marginTop: 10 }}>{q.data.factors.map((f: any) => <FactorRow key={f.key} f={f} item={it} weight={q.data.rubric.weights[f.key]} />)}</div>
              </div>

              <div>
                <h3 className="t-head" style={{ marginBottom: 10 }}>Evidence</h3>
                <div className="inset" style={{ padding: "14px 16px" }}>
                  <div className="flex items-center gap-2 flex-wrap"><span className={"chip " + ev!.tone}>{ev!.label}</span><span className="t-foot">Last checked {ago(it.lastVerified)}</span></div>
                  <p style={{ marginTop: 8, fontSize: 14.5 }}>{it.evidenceNote || ev!.text}</p>
                  {it.missing && <p className="t-foot" style={{ marginTop: 8 }}><b style={{ color: "var(--text)" }}>Still missing:</b> {it.missing}.{it.verifyOwner ? ` ${it.verifyOwner} can confirm it.` : ""}</p>}
                  {!it.complete && !isDone && <Facts item={it} factors={q.data.factors} onSave={(facts) => act("facts", { facts }, "Saved. The score is updated.")} busy={busy} />}
                </div>
              </div>

              <div>
                <h3 className="t-head" style={{ marginBottom: 10 }}>Sources{it.merged > 1 && <span className="t-foot" style={{ fontWeight: 500, marginLeft: 8 }}>{it.merged} records about the same thing, shown as one</span>}</h3>
                <div className="inset group">
                  {it.sources.map((s: any, i: number) => (
                    <a key={i} className="row flush" href={s.url || "#"} target={s.url && s.url !== "#" ? "_blank" : undefined} rel="noreferrer" onClick={(e) => { if (!s.url || s.url === "#") { e.preventDefault(); app.toast("Sample data has no real source to open."); } }} style={{ minHeight: 48, padding: "10px 14px" }}>
                      <span className="glyph" style={{ width: 28, height: 28 }}><Icon name={s.tool} size={15} /></span>
                      <span className="row-main"><span style={{ fontSize: 14.5, fontWeight: 520 }}>{s.label}</span></span>
                      {s.ref && <span className="t-cap num">{s.ref}</span>}
                      <Icon name="external" size={15} className="chev" />
                    </a>
                  ))}
                </div>
              </div>

              {mine && !isDone && (
                <div>
                  <h3 className="t-head" style={{ marginBottom: 10 }}>Change the order</h3>
                  <div className="inset" style={{ padding: 14 }}>
                    <label className="t-foot" htmlFor="override-reason">Reason (optional, saved with the change)</label>
                    <input id="override-reason" className="input" style={{ marginTop: 6 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: promised it today" maxLength={120} />
                    <div className="flex gap-2 flex-wrap" style={{ marginTop: 10 }}>
                      {it.pin == null ? <button className="btn sm" disabled={busy} onClick={() => act("pin", {}, "Pinned to the top")}><Icon name="pin" size={15} />Pin to top</button> : <button className="btn sm" disabled={busy} onClick={() => act("unpin", {}, "Back to automatic order")}><Icon name="refresh" size={15} />Back to automatic order</button>}
                      <button className="btn sm" disabled={busy} onClick={() => act("move", { dir: "up" }, "Moved up")}><Icon name="up" size={15} />Move up</button>
                      <button className="btn sm" disabled={busy} onClick={() => act("move", { dir: "down" }, "Moved down")}><Icon name="arrowdown" size={15} />Move down</button>
                    </div>
                    {it.override && <p className="t-foot" style={{ marginTop: 10 }}>{it.override.action} by {it.override.by}, {ago(it.override.at)}{it.override.why ? `: "${it.override.why}"` : ""}.</p>}
                  </div>
                </div>
              )}

              <p className="t-foot faint">Ranking only suggests an order. Nothing is sent, approved or changed until you do it yourself. Scoring rules version {q.data.rubric.version}, set by your {q.data.rubric.owner}. Last calculated {ago(q.data.calculatedAt)}. Item {it.id}, owner {it.owner}.</p>
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

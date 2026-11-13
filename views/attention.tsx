"use client";
import React, { useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { ago } from "@/lib/format";
import { AttentionRow } from "@/components/attention";
import { Empty, Fold, Icon, Load, Page, SampleTag, Section, Segmented, SkelRows } from "@/components/ui";

function AddItem({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const [f, setF] = useState({ title: "", nextStep: "", kind: "decision", due: "", waitingOn: "me" });
  const save = async () => {
    try { await api("attention", { method: "POST", body: { ...f, scope: app.scope.id === "all" ? null : app.scopeKey } }); app.toast("Added. Find it under Needs checking until you answer its questions."); onDone(); }
    catch (e: any) { app.toast(e.message); }
  };
  return (
    <div className="card pad stack" style={{ gap: 12 }}>
      <div className="t-head">Add something by hand</div>
      <div className="grid-2">
        <label><span className="t-cap">What is it?</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={140} placeholder="Approve the spring price list" /></label>
        <label><span className="t-cap">Next step</span><input className="input" value={f.nextStep} onChange={(e) => setF({ ...f, nextStep: e.target.value })} maxLength={160} placeholder="Read it and reply to Nancy" /></label>
        <label><span className="t-cap">Deadline (optional)</span><input className="input" type="datetime-local" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></label>
        <div><span className="t-cap" style={{ display: "block", marginBottom: 6 }}>Kind</span><Segmented label="Kind" value={f.kind} onChange={(kind) => setF({ ...f, kind })} options={[{ value: "decision", label: "Decision" }, { value: "approval", label: "Approval" }, { value: "reply", label: "Reply" }, { value: "risk", label: "Risk" }]} /></div>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Segmented label="Who has it" value={f.waitingOn} onChange={(waitingOn) => setF({ ...f, waitingOn })} options={[{ value: "me", label: "It needs me" }, { value: "other", label: "Someone else has it" }]} />
        <span className="flex gap-2"><button className="btn" onClick={onDone}>Cancel</button><button className="btn primary" disabled={f.title.trim().length < 3} onClick={save}>Add</button></span>
      </div>
    </div>
  );
}

export default function Attention() {
  const app = useApp();
  const q = useApi("attention", { scope: app.scopeKey });
  const [tab, setTab] = useState<"needsYou" | "team" | "verify" | "snoozed" | "done">("needsYou");
  const [logOpen, setLogOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const all = app.scope.id === "all";
  const blurb: Record<string, string> = {
    needsYou: "Decisions, approvals, replies and risks where your attention changes the outcome. The most important is first.",
    team: "Things other people are handling, with who has them and when to follow up. Nothing here is yours to do.",
    verify: "Items with missing, old or conflicting facts. Check these before acting on them.",
    snoozed: "Set aside for now. Each one comes back by itself.",
    done: "Finished or dismissed. You can put any of them back.",
  };
  return (
    <Page title="Needs your attention" sub={all ? "Ranked so the right things come first. Tap any card to see why it is there." : `For ${app.scopeLabel}. Tap any card to see why it is there.`} actions={<><SampleTag show={q.data?.sample} /><button className="btn tinted" onClick={() => setAdding((a) => !a)}><Icon name="plus" size={16} />Add</button></>}>
      <Load q={q} skeleton={<SkelRows n={7} />}>
        {(d) => {
          const list = d[tab] as any[];
          return (
            <div className="stack">
              <div style={{ overflowX: "auto", margin: "0 -4px", padding: "0 4px" }}>
                <Segmented label="Which list" value={tab} onChange={setTab} options={[
                  { value: "needsYou", label: "For you", count: d.needsYou.length }, { value: "team", label: "Waiting on others", count: d.team.length },
                  { value: "verify", label: "Needs checking", count: d.verify.length }, { value: "snoozed", label: "Snoozed", count: d.snoozed.length }, { value: "done", label: "Done" },
                ]} />
              </div>
              <Fold open={adding}>{adding && <AddItem onDone={() => setAdding(false)} />}</Fold>
              <Section key={tab}>
                <p className="t-foot" style={{ padding: "0 6px 12px", maxWidth: "70ch" }}>{blurb[tab]}</p>
                <div className="card group">
                  {list.length ? list.map((it) => <AttentionRow key={it.id} item={it} showScope={all} team={tab === "team"} />) : (
                    <Empty art={tab === "needsYou" ? "clear" : "quiet"} title={tab === "needsYou" ? "All clear" : tab === "verify" ? "Everything checks out" : "Nothing here"}><p>{tab === "needsYou" ? "Nothing needs you right now. Enjoy the quiet." : tab === "team" ? "You are not waiting on anyone." : tab === "verify" ? "Every item has the facts it needs." : tab === "snoozed" ? "You have not snoozed anything." : "Finished items will show up here."}</p></Empty>
                  )}
                </div>
              </Section>
              {d.overrides.length > 0 && (
                <div className="card group">
                  <button className="row flush" onClick={() => setLogOpen((o) => !o)} aria-expanded={logOpen}>
                    <span className="glyph"><Icon name="pin" size={16} /></span>
                    <span className="row-main"><span className="row-title" style={{ display: "block" }}>Order changes</span><span className="row-sub">Every time someone pinned, moved or snoozed an item, with who and why.</span></span>
                    <Icon name="chevron" size={16} className={"chev caret" + (logOpen ? " open" : "")} />
                  </button>
                  <Fold open={logOpen}><hr className="divider" />{d.overrides.map((o: any, i: number) => <div key={i} className="row flush" style={{ minHeight: 48 }}><span className="row-main"><span style={{ fontSize: 14.5, fontWeight: 540 }}>{o.title}</span><span className="row-sub">{o.action} by {o.by}{o.why ? `: "${o.why}"` : ""}</span></span><span className="t-foot faint">{ago(o.at)}</span></div>)}</Fold>
                </div>
              )}
              <p className="t-foot faint" style={{ padding: "0 6px" }}>Scoring rules version {d.rubric.version}, owned by your {d.rubric.owner}. Urgency counts most, then business impact, then what only you can unblock. You can change the weights in Settings. The order is a suggestion: nothing is sent or changed for you.</p>
            </div>
          );
        }}
      </Load>
    </Page>
  );
}

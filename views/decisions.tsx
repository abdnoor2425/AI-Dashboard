"use client";
import React, { useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { ago } from "@/lib/format";
import { Empty, Fold, Icon, Load, Page, SampleTag, Section, SkelRows, Status } from "@/components/ui";

function Session({ d, startOpen }: { d: any; startOpen: boolean }) {
  const app = useApp();
  const [open, setOpen] = useState(startOpen);
  const [outcome, setOutcome] = useState(d.outcome || "");
  const save = async () => { try { await api("decisions/" + d.id, { method: "POST", body: { outcome } }); app.toast(outcome ? "Decision saved" : "Reopened"); } catch (e: any) { app.toast(e.message); } };
  return (
    <div className="card group">
      <button className="row flush" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={"glyph " + (d.status === "decided" ? "good" : "accent")}><Icon name={d.status === "decided" ? "check" : "decisions"} size={17} /></span>
        <span className="row-main"><span className="row-title" style={{ display: "block" }}>{d.question}</span><span className="row-sub">{d.status === "decided" ? "Decided: " + d.outcome : "Still open"} · started {ago(d.createdAt)}</span></span>
        <Status>{d.status === "decided" ? "Decided" : "Open"}</Status>
        <Icon name="chevron" size={16} className={"chev caret" + (open ? " open" : "")} />
      </button>
      <Fold open={open}>
        <hr className="divider" />
        <div style={{ padding: 16 }} className="stack">
          <div className="grid-2">
            {d.advisors.map((a: any) => <div key={a.name} className="quote"><div className="flex items-center justify-between gap-2" style={{ marginBottom: 6 }}><span className="t-head" style={{ fontSize: 15 }}>{a.name}</span><span className="chip line">{a.stance}</span></div><p style={{ fontSize: 14.5 }} className="muted">{a.argument}</p></div>)}
          </div>
          {d.simulated && <p className="t-foot faint">This debate is simulated from fixed advisor roles. It is a thinking aid, not advice from live AI. Link Claude Code or Codex on the Connections page for a debate written about your real question.</p>}
          <div>
            <label className="t-head" htmlFor={"o-" + d.id} style={{ fontSize: 15 }}>What did you decide?</label>
            <div className="flex gap-2 flex-wrap" style={{ marginTop: 8 }}><input id={"o-" + d.id} className="input" style={{ flex: "1 1 260px", width: "auto" }} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Write the decision in one line" maxLength={300} /><button className="btn primary" onClick={save}>{d.status === "decided" ? "Update" : "Save decision"}</button></div>
            {d.nextActions.length > 0 && <><div className="t-cap" style={{ margin: "14px 0 6px" }}>Proposed next steps</div><ul style={{ display: "grid", gap: 5 }}>{d.nextActions.map((n: string) => <li key={n} className="flex gap-2" style={{ fontSize: 14.5 }}><span style={{ color: "var(--accent)", marginTop: 2 }}><Icon name="chevron" size={14} stroke={2.2} /></span>{n}</li>)}</ul></>}
          </div>
        </div>
      </Fold>
    </div>
  );
}

export default function Decisions() {
  const app = useApp();
  const q = useApi("decisions");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const start = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { const d = await api("decisions", { method: "POST", body: { question } }); setFresh(d.id); setQuestion(""); app.toast("The advisors have weighed in"); } catch (err: any) { app.toast(err.message); }
    setBusy(false);
  };
  return (
    <Page title="Decision Room" sub="Put a hard question to four advisors who see it differently. Every session is saved so you can come back to it." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <div className="stack">
        <Section>
          <form className="card pad" onSubmit={start}>
            <label htmlFor="new-decision" className="t-head">What are you deciding?</label>
            <textarea id="new-decision" className="input" rows={2} style={{ marginTop: 10 }} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="For example: Should we raise prices in January?" maxLength={300} />
            <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 12 }}><button className="btn primary" disabled={busy || question.trim().length < 8}><Icon name="decisions" size={16} />{busy ? "Thinking" : "Hear the advisors"}</button><span className="t-foot">The Operator, the Customer, the Skeptic and the Investor each give a view.</span></div>
          </form>
        </Section>
        <Load q={q} skeleton={<SkelRows n={3} />}>
          {(d) => <Section title="Saved sessions" i={1}><div className="stack" style={{ gap: 12 }}>{d.decisions.length ? d.decisions.map((x: any) => <Session key={x.id} d={x} startOpen={x.id === fresh} />) : <div className="card"><Empty title="No decisions yet"><p>Your first session will be saved here.</p></Empty></div>}</div></Section>}
        </Load>
      </div>
    </Page>
  );
}

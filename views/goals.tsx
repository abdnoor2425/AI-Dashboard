"use client";
import React, { useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { dateShort, withUnit } from "@/lib/format";
import { Fold, Icon, Load, Page, Ring, SampleTag, Section, SkelCards } from "@/components/ui";

function KR({ kr }: { kr: any }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(""), [note, setNote] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api("goals/checkin", { method: "POST", body: { krId: kr.id, value, note } }); app.toast("Check-in saved"); setValue(""); setNote(""); } catch (err: any) { app.toast(err.message); }
  };
  return (
    <div style={{ borderTop: "0.5px solid var(--sep)" }}>
      <button className="row flush" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ alignItems: "flex-start" }}>
        <span className="row-main">
          <span className="row-title" style={{ display: "block" }}>{kr.title}</span>
          <span className="flex items-center gap-3" style={{ marginTop: 8 }}>
            <span className="bar-track" style={{ flex: 1, maxWidth: 320 }}>{kr.progress != null && <span className="bar-fill" style={{ display: "block", width: `${Math.max(2, kr.progress * 100)}%` }} />}</span>
            <span className="num t-foot" style={{ color: kr.current == null ? "var(--warn)" : "var(--text)", fontWeight: 600, flex: "none" }}>{kr.current == null ? "No reading yet" : `${withUnit(kr.current, kr.unit)} of ${withUnit(kr.target, kr.unit)}`}</span>
          </span>
        </span>
        <span className="chip hide-sm">{kr.owner}</span>
        <Icon name="chevron" size={16} className={"chev caret" + (open ? " open" : "")} />
      </button>
      <Fold open={open}>
        <div style={{ padding: "0 16px 16px" }} className="grid-2">
          <div>
            <div className="t-cap" style={{ marginBottom: 6 }}>Check-ins</div>
            {kr.checkins.length ? [...kr.checkins].reverse().map((c: any, i: number) => <div key={i} className="flex gap-3" style={{ padding: "5px 0", fontSize: 14 }}><span className="faint num" style={{ width: 54, flex: "none" }}>{dateShort(c.at)}</span><span className="num" style={{ fontWeight: 620, width: 56, flex: "none" }}>{withUnit(c.value, kr.unit)}</span><span className="muted">{c.note}</span></div>) : <p className="muted" style={{ fontSize: 14 }}>No check-ins yet. Progress stays unknown until the first one.</p>}
            <p className="t-foot" style={{ marginTop: 10 }}>Started at {withUnit(kr.baseline, kr.unit)}, aiming for {withUnit(kr.target, kr.unit)}. Owner: {kr.owner}.{kr.links.length ? ` Linked work: ${kr.links.join(", ")}.` : ""}</p>
          </div>
          <form onSubmit={save} className="quote">
            <div className="t-head" style={{ fontSize: 15 }}>Add a check-in</div>
            <label className="t-foot" htmlFor={"v-" + kr.id} style={{ display: "block", marginTop: 8 }}>Current value{kr.unit ? ` (${kr.unit})` : ""}</label>
            <input id={"v-" + kr.id} className="input" inputMode="decimal" required value={value} onChange={(e) => setValue(e.target.value)} style={{ marginTop: 4 }} />
            <label className="t-foot" htmlFor={"n-" + kr.id} style={{ display: "block", marginTop: 8 }}>Note (optional)</label>
            <input id={"n-" + kr.id} className="input" value={note} onChange={(e) => setNote(e.target.value)} style={{ marginTop: 4 }} maxLength={200} />
            <button className="btn primary sm" style={{ marginTop: 12 }}>Save check-in</button>
          </form>
        </div>
      </Fold>
    </div>
  );
}

export default function Goals() {
  const app = useApp();
  const q = useApi("goals");
  return (
    <Page title="Goals" sub="What you are trying to change this quarter, and how far along each goal really is." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <Load q={q} skeleton={<SkelCards n={3} h={200} cols="stack" />}>
        {(d) => (
          <div className="stack">
            {d.goals.map((g: any, i: number) => (
              <Section key={g.id} i={i}>
                <div className="card group">
                  <div className="flex items-center gap-4" style={{ padding: 18 }}>
                    <Ring value={g.progress} size={76} stroke={9} id={g.id}><span className="num" style={{ fontSize: 17, fontWeight: 700 }}>{g.progress == null ? "?" : Math.round(g.progress * 100) + "%"}</span></Ring>
                    <div style={{ minWidth: 0 }}>
                      <div className="flex gap-2 flex-wrap" style={{ marginBottom: 6 }}>{g.top && <span className="chip accent">Top goal</span>}<span className="chip">{g.period}</span><span className="chip">{g.owner}</span></div>
                      <h2 className="t-mid" style={{ fontSize: 21, textWrap: "balance" as any }}>{g.title}</h2>
                    </div>
                  </div>
                  {g.krs.map((k: any) => <KR key={k.id} kr={k} />)}
                  <div style={{ borderTop: "0.5px solid var(--sep)", padding: "11px 16px" }} className="t-foot"><b style={{ color: "var(--text)", fontWeight: 600 }}>How this is worked out:</b> {g.how}</div>
                </div>
              </Section>
            ))}
            <p className="t-foot faint" style={{ padding: "0 6px" }}>Goals track what you are trying to change. Metrics watch the numbers you want to keep healthy. They are kept on separate pages on purpose.</p>
          </div>
        )}
      </Load>
    </Page>
  );
}

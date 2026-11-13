"use client";
import React, { useState } from "react";
import { useApi, useApp } from "@/lib/client";
import { ago, compact } from "@/lib/format";
import { Columns, Pips } from "@/components/charts";
import { Empty, Fold, Icon, Load, Mark, Page, SampleTag, Section, Segmented, SkelRows } from "@/components/ui";

const HOOKS = [["spoken", "Spoken hook"], ["text", "Text hook"], ["visual", "Visual hook"]];
function Card({ title, sc, note }: { title: string; sc: any; note: string }) {
  return (
    <div className="quote" style={{ background: "var(--card-2)" }}>
      <div className="flex items-center justify-between gap-2"><span className="t-head" style={{ fontSize: 15 }}>{title}</span><span className={"chip " + (sc.verdict === "PASS" ? "good" : "bad")}>{sc.verdict}</span></div>
      <div className="t-foot" style={{ marginBottom: 10 }}>{note}</div>
      <div className="t-cap" style={{ margin: "6px 0" }}>Hooks first</div>
      {HOOKS.map(([k, l]) => <div key={k} className="flex items-center justify-between" style={{ padding: "5px 0", fontSize: 14, fontWeight: 560 }}>{l}<Pips value={sc.hooks[k]} /></div>)}
      <div className="t-cap" style={{ margin: "12px 0 6px" }}>The other seven</div>
      {sc.buckets.map((b: any) => <div key={b.name} className="flex items-center justify-between" style={{ padding: "4px 0", fontSize: 14 }}>{b.name}<Pips value={b.score} /></div>)}
    </div>
  );
}
const cell = (v: any, f = compact) => (v == null ? <span className="faint">Not yet</span> : f(v));

function Reel({ r }: { r: any }) {
  const [open, setOpen] = useState(false);
  const app = useApp();
  const pts = [["24 hours", r.perf.h24], ["72 hours", r.perf.h72], ["7 days", r.perf.d7]] as [string, any][];
  const published = r.perf.h24 || r.publishedAt < Date.now() - 3600000 && r.final.verdict === "PASS";
  return (
    <div className="card group">
      <button className="row flush" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Mark name={r.siteName || "?"} color={r.color} />
        <span className="row-main"><span className="row-title" style={{ display: "block" }}>{r.title}</span><span className="row-sub">{r.siteName} · {r.platformName} · {published ? "published " + ago(r.publishedAt) : "not published"}</span></span>
        <span className="hide-sm flex items-center gap-3" aria-label="Hook scores">{HOOKS.map(([k]) => <Pips key={k} value={r.final.hooks[k]} />)}</span>
        <span className={"chip " + (r.final.verdict === "PASS" ? "good" : "bad")}>{r.final.verdict}</span>
        <Icon name="chevron" size={16} className={"chev caret" + (open ? " open" : "")} />
      </button>
      <Fold open={open}>
        <hr className="divider" />
        <div style={{ padding: 16 }} className="stack">
          <div className="grid-2"><Card title="Script" sc={r.script} note="Scored before filming: what was planned." /><Card title="Final video" sc={r.final} note="Scored on the finished edit: what was made." /></div>
          <div className="grid-2">
            <div>
              <div className="t-head" style={{ fontSize: 15 }}>Why it scored this way</div>
              <p className="muted" style={{ marginTop: 4, fontSize: 14.5 }}>{r.rationale}</p>
              <p className="t-foot" style={{ marginTop: 6 }}>Reviewed by {r.reviewer} with scorecard {r.rubric}.</p>
              {r.fixes.length > 0 && <><div className="t-cap" style={{ margin: "12px 0 6px" }}>Fixes before it can pass</div><ul style={{ display: "grid", gap: 6 }}>{r.fixes.map((f: string) => <li key={f} className="flex gap-2" style={{ fontSize: 14.5 }}><span style={{ color: "var(--bad)", marginTop: 2 }}><Icon name="chevron" size={14} stroke={2.2} /></span>{f}</li>)}</ul></>}
              <button className="btn tinted sm" style={{ marginTop: 14 }} onClick={() => app.toast("Sample data has no real video to open.")}><Icon name="play" size={14} />Open the exact video</button>
            </div>
            <div>
              <div className="t-head" style={{ fontSize: 15 }}>How it actually did</div>
              {r.perf.h24 ? (
                <>
                  <Columns cols={pts.map(([l, p]) => ({ label: l, value: p ? p.views : null }))} height={76} />
                  <div className="tbl-wrap" style={{ marginTop: 8 }}><table className="tbl" style={{ fontSize: 13.5 }}><thead><tr><th>Measured at</th><th className="r">Reach</th><th className="r">Watched to end</th><th className="r">Saves</th><th className="r">Shares</th><th className="r">Comments</th></tr></thead><tbody>{pts.map(([l, p]) => <tr key={l}><td>{l}</td><td className="r num">{cell(p?.reach)}</td><td className="r num">{cell(p?.retention, (v: number) => Math.round(v * 100) + "%")}</td><td className="r num">{cell(p?.saves)}</td><td className="r num">{cell(p?.shares)}</td><td className="r num">{cell(p?.comments)}</td></tr>)}</tbody></table></div>
                </>
              ) : <p className="muted" style={{ marginTop: 4, fontSize: 14.5 }}>Not published yet, so there are no results. Results appear 24 hours after it goes out.</p>}
            </div>
          </div>
          <div className="notice" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--text)" }}><span style={{ color: "var(--accent)", display: "flex" }}><Icon name="sparkle" size={18} /></span><span><b style={{ fontWeight: 620 }}>Next improvement:</b> {r.next}</span></div>
        </div>
      </Fold>
    </div>
  );
}

export default function Reels() {
  const app = useApp();
  const site = app.scope.mode === "sites" && app.scope.id !== "all" ? app.scope.id : "all";
  const q = useApi("reels", { site });
  const [f, setF] = useState<"all" | "HOLD" | "PASS">("all");
  return (
    <Page title="Reel scores" sub="Each reel is scored on its three hooks first, then seven more checks. PASS can be published. HOLD needs a fix." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <Load q={q} skeleton={<SkelRows n={6} />}>
        {(d) => {
          const list = d.reels.filter((r: any) => f === "all" || r.final.verdict === f);
          return (
            <div className="stack">
              <Segmented label="Filter reels" value={f} onChange={setF} options={[{ value: "all", label: "All", count: d.reels.length }, { value: "HOLD", label: "On hold", count: d.hold }, { value: "PASS", label: "Passed", count: d.pass }]} />
              <Section key={f}><div className="stack" style={{ gap: 12 }}>{list.length ? list.map((r: any) => <Reel key={r.id} r={r} />) : <div className="card"><Empty art="clear" title={f === "HOLD" ? "Nothing on hold" : "No reels here"}><p>{f === "HOLD" ? "Every scored reel has passed." : "Scored reels for this website show here."}</p></Empty></div>}</div></Section>
              <p className="t-foot faint" style={{ padding: "0 6px" }}>Scorecard {d.rubric}. {d.note} A missing result shows as "Not yet", never as 0. Scores made with a different scorecard version are not compared with these.</p>
            </div>
          );
        }}
      </Load>
    </Page>
  );
}

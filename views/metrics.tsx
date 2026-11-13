"use client";
import React, { useState } from "react";
import { useApi, useApp } from "@/lib/client";
import { ago, withUnit } from "@/lib/format";
import { Spark } from "@/components/charts";
import { Fold, Icon, Load, Page, SampleTag, SkelCards } from "@/components/ui";

const STATE: Record<string, [string, string]> = { missing: ["Not connected", "warn"], stale: ["Out of date", "warn"], conflicting: ["Sources disagree", "bad"] };

function Metric({ m, i }: { m: any; i: number }) {
  const [open, setOpen] = useState(false);
  const st = STATE[m.state];
  const pts = m.trend.map((v: number, n: number) => ({ t: n, v }));
  return (
    <div className="card rise" style={{ ["--i" as any]: i, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ display: "block", width: "100%", textAlign: "left", padding: "16px 16px 0" }}>
        <div className="flex items-center justify-between gap-2"><span className="t-head" style={{ fontSize: 15 }}>{m.name}</span>{st ? <span className={"chip " + st[1]}>{st[0]}</span> : <Icon name="chevron" size={15} className={"chev caret" + (open ? " open" : "")} />}</div>
        <div className="t-foot">{m.scopeLabel} · {m.period}</div>
        <div className="flex items-end justify-between gap-3" style={{ marginTop: 12 }}>
          <div className="t-big num" style={m.current == null ? { color: "var(--text-3)", fontSize: 26 } : undefined}>{withUnit(m.current, m.unit)}</div>
          {m.target != null && <div style={{ textAlign: "right" }}><div className="t-cap">{m.targetStatus === "approved" ? "Target" : "Proposed target"}</div><div className="num" style={{ fontSize: 16, fontWeight: 640, color: m.targetStatus === "approved" ? "var(--text)" : "var(--text-2)" }}>{withUnit(m.target, m.unit)}</div></div>}
        </div>
        <div style={{ margin: "8px -16px 0", height: 44 }}>{pts.length > 1 ? <Spark data={pts} height={44} color={m.state === "ok" ? "var(--accent)" : "var(--text-3)"} /> : <div style={{ height: 44, display: "grid", placeItems: "center" }} className="t-foot faint">No history to draw</div>}</div>
      </button>
      <Fold open={open}>
        <div style={{ padding: "12px 16px 16px", borderTop: "0.5px solid var(--sep)", fontSize: 14 }}>
          <p>{m.definition}</p>
          {m.note && <p style={{ marginTop: 8, color: st ? `var(--${st[1]})` : undefined }}>{m.note}</p>}
          <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 14px", marginTop: 10 }} className="t-foot">
            <dt>Started at</dt><dd className="num" style={{ color: "var(--text)" }}>{withUnit(m.baseline, m.unit)}</dd>
            <dt>Owner</dt><dd style={{ color: "var(--text)" }}>{m.owner}</dd>
            <dt>Comes from</dt><dd style={{ color: "var(--text)" }}>{m.source}</dd>
            <dt>Last checked</dt><dd style={{ color: "var(--text)" }}>{m.lastVerified ? ago(m.lastVerified) : "Never"}</dd>
            <dt>Target</dt><dd style={{ color: "var(--text)" }}>{m.target == null ? "None set" : m.targetStatus === "approved" ? "Approved" : "Proposed, not approved yet"}</dd>
          </dl>
        </div>
      </Fold>
    </div>
  );
}

export default function Metrics() {
  const app = useApp();
  const q = useApi("metrics");
  return (
    <Page title="Metrics" sub="The numbers you want to keep healthy. Tap one to see exactly what it measures and where it comes from." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <Load q={q} skeleton={<SkelCards n={6} h={180} cols="grid-auto" />}>
        {(d) => (
          <>
            <div className="grid-auto" style={{ alignItems: "start" }}>{d.metrics.map((m: any, i: number) => <Metric key={m.id} m={m} i={i} />)}</div>
            <p className="t-foot faint" style={{ padding: "16px 6px 0" }}>A number that cannot be measured shows as Unknown, never as 0. Finished tasks and AI usage are activity, so they are not shown here as business results.</p>
          </>
        )}
      </Load>
    </Page>
  );
}

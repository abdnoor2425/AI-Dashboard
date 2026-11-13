"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useApi, useApp } from "@/lib/client";
import { compact, full } from "@/lib/format";
import { AreaChart, HBars, Spark } from "@/components/charts";
import { AttentionRow } from "@/components/attention";
import { Delta, Icon, Load, Mark, Num, Page, SampleTag, Section, Segmented, SkelCards, SourceLine, Empty } from "@/components/ui";

function Detail({ site }: { site: string }) {
  const [range, setRange] = useState("28");
  const [tab, setTab] = useState<"visitors" | "leads">("visitors");
  const q = useApi("website", { site, range });
  const att = useApi(site === "all" ? null : "attention", { scope: "site:" + site });
  return (
    <Load q={q} skeleton={<SkelCards n={2} h={220} />}>
      {(d) => (
        <div className="stack">
          <Section>
            <div className="card pad">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex gap-8 flex-wrap">
                  {(["visitors", "leads"] as const).map((k) => (
                    <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} style={{ textAlign: "left", opacity: tab === k ? 1 : 0.55, transition: "opacity .2s" }}>
                      <div className="flex items-center gap-2"><span className="t-cap" style={{ fontSize: 13 }}>{k === "visitors" ? "Visitors" : "Leads"}</span><Delta d={d.deltas[k]} /></div>
                      <div className="t-big" style={{ marginTop: 6 }}><Num value={d.totals[k]} /></div>
                    </button>
                  ))}
                  <div><div className="t-cap" style={{ fontSize: 13 }}>Visitors who became leads</div><div className="t-big num" style={{ marginTop: 6 }}>{d.rate == null ? "Unknown" : (d.rate * 100).toFixed(1) + "%"}</div></div>
                </div>
                <Segmented label="Time range" value={range} onChange={setRange} options={[{ value: "7", label: "7 days" }, { value: "28", label: "28 days" }, { value: "90", label: "90 days" }]} />
              </div>
              <p className="muted" style={{ margin: "12px 0 4px", fontSize: 16 }}>{d.sentences[tab]}</p>
              <AreaChart data={d[tab]} label={tab === "visitors" ? "Visitors per day" : "Leads per day"} height={260} />
            </div>
            <SourceLine source={d.source} at={d.lastSync} extra={d.site?.gaProperty} />
          </Section>
          <div className="grid-2">
            <Section title="Where visitors come from" i={1}><div className="card pad"><HBars rows={d.sources.map((s: any) => ({ label: s.name, value: s.visitors, sub: Math.round(s.share * 100) + "%" }))} /></div></Section>
            {d.pages ? (
              <Section title="Top pages" i={2}><div className="card pad"><HBars rows={d.pages.map((p: any) => ({ label: <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{p.path}</code>, value: p.visitors, sub: (p.delta >= 0 ? "+" : "−") + Math.abs(Math.round(p.delta * 100)) + "%" }))} /></div></Section>
            ) : (
              <Section title="Pick a website for more" i={2}><div className="card pad muted">Top pages and brand details show when you choose one website from the menu at the top.</div></Section>
            )}
          </div>
          {att.data?.needsYou?.length > 0 && <Section title="Needs you on this website" i={3}><div className="card group">{att.data.needsYou.map((it: any) => <AttentionRow key={it.id} item={it} />)}</div></Section>}
          {d.site && <div className="flex gap-2 flex-wrap"><Link className="btn tinted" href="/social"><Icon name="social" size={16} />Social for {d.site.name}</Link><Link className="btn tinted" href="/reels"><Icon name="reels" size={16} />Reel scores</Link></div>}
        </div>
      )}
    </Load>
  );
}

function WebsiteInner() {
  const app = useApp();
  const one = app.scope.mode === "sites" && app.scope.id !== "all" ? app.scope.id : null;
  const list = useApi(one ? null : "websites");
  const site = app.boot.sites.find((s: any) => s.id === one);
  return (
    <Page title={site ? site.name : "Websites"} sub={site ? `${site.kind} · ${site.domain}` : `${app.boot.sites.length} websites found in your Google Analytics account. Pick one to focus the whole dashboard on it.`} actions={<SampleTag show={app.boot.workspace.sample} />}>
      {one ? <Detail site={one} key={one} /> : (
        <div className="stack">
          <Load q={list} skeleton={<SkelCards n={6} h={190} cols="grid-auto" />}>
            {(d) => (
              <div className="grid-auto">
                {d.sites.map((s: any, i: number) => (
                  <button key={s.id} className="card tap rise" style={{ ["--i" as any]: i, overflow: "hidden" }} onClick={() => app.setScope({ mode: "sites", id: s.id })} aria-label={`${s.name}: ${full(s.visitors)} visitors in the last 28 days. Open`}>
                    <div style={{ padding: "16px 16px 0" }}>
                      <div className="flex items-center gap-3"><Mark name={s.name} color={s.color} lg /><div style={{ minWidth: 0, flex: 1 }}><div className="t-head" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div><div className="t-foot">{s.domain}</div></div>{s.needsYou > 0 && <span className="chip accent num" title="Items that need you">{s.needsYou}</span>}</div>
                      <div className="flex items-end justify-between gap-3" style={{ marginTop: 16 }}>
                        <div><div className="t-cap">Visitors</div><div className="t-mid num" style={{ marginTop: 2 }}>{compact(s.visitors)}</div></div>
                        <Delta d={s.visitorsDelta} />
                        <div style={{ textAlign: "right" }}><div className="t-cap">Leads</div><div className="num" style={{ fontSize: 18, fontWeight: 650, marginTop: 2 }}>{compact(s.leads)}</div></div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}><Spark data={s.spark} color={s.visitorsDelta < -0.02 ? "var(--text-3)" : "var(--accent)"} height={52} /></div>
                  </button>
                ))}
              </div>
            )}
          </Load>
          <Section title="All websites together" i={4}><Detail site="all" /></Section>
        </div>
      )}
    </Page>
  );
}

export default function Website() {
  const app = useApp();
  if (app.boot.sites.length) return <WebsiteInner />;
  return <Page title="Websites"><div className="card"><Empty art="connect" title="No websites yet"><p>Connect Google Analytics and every website in your account appears here, each with its own numbers.</p><Link className="btn primary" style={{ marginTop: 14 }} href="/connections">Open Connections</Link></Empty></div></Page>;
}

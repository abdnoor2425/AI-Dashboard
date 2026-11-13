"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useApi, useApp } from "@/lib/client";
import { clock, compact, dayName } from "@/lib/format";
import { AreaChart, HBars, Spark } from "@/components/charts";
import { Delta, Empty, Fold, Icon, Load, Mark, Num, Page, SampleTag, Section, SkelCards, SourceLine } from "@/components/ui";

function SocialInner() {
  const app = useApp();
  const site = app.scope.mode === "sites" && app.scope.id !== "all" ? app.scope.id : "all";
  const q = useApi("social", { site });
  const [comp, setComp] = useState(false);
  return (
    <Page title="Social" sub={site === "all" ? "Reach and followers across every website's Metricool brand." : `What ${app.scopeLabel} is doing on social, from its Metricool brand.`} actions={<SampleTag show={app.boot.workspace.sample} />}>
      <Load q={q} skeleton={<SkelCards n={4} h={170} />}>
        {(d) => d.state !== "ok" ? (
          <div className="card"><Empty art="connect" title={d.state === "unconfirmed" ? "Confirm this website's Metricool brand" : "No Metricool brand matched yet"}><p>Metricool calls each website a brand. Match {app.scopeLabel} to its brand once and its social numbers show here.</p><Link href="/connections" className="btn primary" style={{ marginTop: 12 }}>Match the brand</Link></Empty></div>
        ) : (
          <div className="stack">
            <Section>
              <div className="card pad">
                <div className="flex gap-8 flex-wrap items-end">
                  <div><div className="flex items-center gap-2"><span className="t-cap" style={{ fontSize: 13 }}>Reach this week</span><Delta d={d.delta} /></div><div className="t-big" style={{ marginTop: 6 }}><Num value={d.totals.reach} /></div></div>
                  <div><div className="t-cap" style={{ fontSize: 13 }}>Followers</div><div className="t-big" style={{ marginTop: 6 }}><Num value={d.totals.followers} /></div></div>
                </div>
                <p className="muted" style={{ margin: "12px 0 4px", fontSize: 16 }}>{d.sentence}</p>
                <AreaChart data={d.reach} label="Reach per day" height={200} />
              </div>
              <SourceLine source={d.source} at={d.lastSync} extra="reach is added across networks, so one person can be counted twice" />
            </Section>

            {d.pending.length > 0 && <Link href="/connections" className="notice"><span className="dot warn" /><span style={{ flex: 1 }}>{d.pending.map((p: any) => p.name).join(", ")} {d.pending.length > 1 ? "are" : "is"} left out until {d.pending.length > 1 ? "their brands are" : "its brand is"} confirmed in Metricool.</span><Icon name="chevron" size={15} className="chev" /></Link>}

            <Section title="By network" i={1}>
              <div className="grid-auto">
                {d.networks.map((n: any, i: number) => (
                  <div key={n.id} className="card rise" style={{ ["--i" as any]: i, overflow: "hidden" }}>
                    <div style={{ padding: "16px 16px 0" }}>
                      <div className="flex items-center justify-between"><span className="t-head">{n.name}</span><Delta d={n.delta} /></div>
                      <div className="flex items-end justify-between" style={{ marginTop: 12 }}>
                        <div><div className="t-cap">Reach</div><div className="t-mid num">{compact(n.reach)}</div></div>
                        <div style={{ textAlign: "right" }}><div className="t-cap">Followers</div><div className="num" style={{ fontSize: 18, fontWeight: 650 }}>{compact(n.followers)} <span className="t-foot" style={{ color: n.followersDelta >= 0 ? "var(--good)" : "var(--bad)", fontWeight: 600 }}>{n.followersDelta >= 0 ? "+" : "−"}{Math.abs(n.followersDelta)}</span></div></div>
                      </div>
                    </div>
                    <div style={{ marginTop: 6 }}><Spark data={n.series} height={44} /></div>
                  </div>
                ))}
              </div>
            </Section>

            <div className="grid-2">
              <Section title="Best post this week" i={2}>
                {d.best ? (
                  <div className="card pad">
                    <div className="flex gap-4 items-start">
                      <div style={{ width: 76, height: 116, borderRadius: 14, flex: "none", background: "linear-gradient(160deg, color-mix(in srgb, var(--accent) 55%, #fff), var(--accent))", display: "grid", placeItems: "center", color: "#fff" }} aria-hidden="true"><Icon name="play" size={26} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div className="t-head">{d.best.title}</div>
                        <div className="t-foot" style={{ marginTop: 2 }}>{d.best.site} · {d.best.platform}</div>
                        <div className="t-mid num" style={{ marginTop: 10 }}>{compact(d.best.views)} <span className="t-foot" style={{ fontWeight: 500 }}>views</span></div>
                        <p style={{ marginTop: 8, fontSize: 14.5 }} className="muted">{d.best.why}</p>
                      </div>
                    </div>
                  </div>
                ) : <div className="card"><Empty title="No posts measured yet"><p>Posts show here a day after they go out.</p></Empty></div>}
              </Section>
              <Section title="Up next" i={3}>
                <div className="card group">
                  {d.upNext.length ? d.upNext.map((u: any) => <div className="row" key={u.id}><Mark name={u.site} color={u.color} /><span className="row-main"><span className="row-title" style={{ display: "block" }}>{u.title}</span><span className="row-sub">{u.site} · {u.network}</span></span><span className="chip num">{dayName(u.at)} {clock(u.at)}</span></div>) : <Empty title="Nothing scheduled"><p>Posts you schedule in Metricool show here.</p></Empty>}
                </div>
              </Section>
            </div>

            {d.perSite && <Section title="By website" i={4}><div className="card pad"><HBars rows={d.perSite.map((s: any) => ({ label: s.name, value: s.reach, color: s.color, sub: (s.delta >= 0 ? "+" : "−") + Math.abs(Math.round((s.delta || 0) * 100)) + "%" }))} /></div></Section>}

            {d.competitors.length > 0 && (
              <div className="card group">
                <button className="row flush" onClick={() => setComp((c) => !c)} aria-expanded={comp}><span className="glyph"><Icon name="eye" size={16} /></span><span className="row-main"><span className="row-title" style={{ display: "block" }}>Compare with competitors</span><span className="row-sub">Instagram and Facebook accounts you track in Metricool.</span></span><Icon name="chevron" size={16} className={"chev caret" + (comp ? " open" : "")} /></button>
                <Fold open={comp}><hr className="divider" /><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Network</th><th>Account</th><th className="r">Followers</th><th className="r">Reach this week</th></tr></thead><tbody>{d.competitors.flatMap((c: any) => c.rows.map((r: any, i: number) => <tr key={c.network + i}><td>{i === 0 ? c.network : ""}</td><td style={{ fontWeight: r.you ? 650 : 400 }}>{r.name}{r.you && <span className="chip accent" style={{ marginLeft: 8 }}>You</span>}</td><td className="r num">{compact(r.followers)}</td><td className="r num">{compact(r.reach)}</td></tr>))}</tbody></table></div></Fold>
              </div>
            )}
          </div>
        )}
      </Load>
    </Page>
  );
}

export default function Social() {
  const app = useApp();
  if (app.boot.sites.length) return <SocialInner />;
  return <Page title="Social"><div className="card"><Empty art="connect" title="No websites yet"><p>Social numbers belong to a website. Connect Google Analytics first, then Metricool.</p><Link className="btn primary" style={{ marginTop: 14 }} href="/connections">Open Connections</Link></Empty></div></Page>;
}

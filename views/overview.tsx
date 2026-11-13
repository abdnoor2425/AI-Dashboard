"use client";
import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi, useApp } from "@/lib/client";
import { compact, dateLong, full, pctText } from "@/lib/format";
import { AttentionRow } from "@/components/attention";
import { BarChart, Pips } from "@/components/charts";
import { Delta, Empty, Icon, Load, Mark, Num, Page, Ring, SampleTag, Section, Segmented, Skel, SkelRows } from "@/components/ui";
import { hrefOf } from "@/components/shell";

const PAGE_NAME: Record<string, string> = { website: "Website", social: "Social", goals: "Goals", connections: "Connections", attention: "Attention", inbox: "Inbox" };

/** What opens when a number is tapped: the number, how it moved, where it came from and a way to go deeper. */
function NumberDetail({ n, chart, close }: { n: any; chart: any; close: () => void }) {
  const router = useRouter();
  const series = n.id === "visitors" ? chart?.visitors?.series : n.id === "leads" ? chart?.leads?.series : null;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="inset" style={{ padding: 18 }}>
        <div className="flex items-center justify-between gap-2"><span className="t-cap">{n.period}</span><Delta d={n.delta} /></div>
        <div className="t-big" style={{ marginTop: 8, fontSize: 44 }}>{n.value == null ? <span className="faint" style={{ fontSize: 26 }}>Unknown</span> : <>{full(n.value)}{n.unit || ""}</>}</div>
        <p className="muted" style={{ marginTop: 8 }}>{n.sentence}</p>
      </div>
      {series?.length > 1 && <div className="inset" style={{ padding: "16px 16px 8px" }}><div className="t-cap" style={{ marginBottom: 8 }}>Day by day, last 28 days</div><BarChart data={series} height={190} label={n.label} /></div>}
      {n.ring !== undefined && n.value != null && <div className="inset flex items-center gap-4" style={{ padding: 18 }}><Ring value={n.ring} size={84} stroke={10} id="nd"><span className="num" style={{ fontWeight: 700 }}>{n.value}%</span></Ring><p className="muted">This is how far the top goal has come, measured from its key results.</p></div>}
      <dl className="facts inset" style={{ padding: 18 }}>
        <div><dt>Where it comes from</dt><dd>{n.source}</dd></div>
        <div><dt>Period</dt><dd>{n.period}</dd></div>
        <div><dt>Compared with</dt><dd>{n.delta == null ? "Nothing to compare with yet" : "The period just before"}</dd></div>
        <div><dt>If it is missing</dt><dd>It shows as Unknown. It is never filled in with a zero.</dd></div>
      </dl>
      <button className="btn primary lg" onClick={() => { close(); router.push(hrefOf(n.href)); }}>Open {PAGE_NAME[n.href] || n.href}<Icon name="chevron" size={16} stroke={2.2} /></button>
    </div>
  );
}

function Tile({ n, i, chart }: { n: any; i: number; chart: any }) {
  const app = useApp();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button ref={ref} className="card tap tile rise" style={{ ["--i" as any]: i + 3 }} onClick={() => app.openCard({ title: n.label, chip: n.source, render: (close) => <NumberDetail n={n} chart={chart} close={close} /> }, ref.current)} aria-label={`${n.label}: ${n.value == null ? "unknown" : n.value + (n.unit || "")}. ${n.sentence} Open details`}>
      <div className="flex items-center justify-between gap-2"><span className="t-cap" style={{ fontSize: 13 }}>{n.label}</span>{n.ring !== undefined ? (n.value != null && <span className="chip good">On the way</span>) : <Delta d={n.delta} />}</div>
      <div className="tile-v">{n.value == null ? <span className="faint" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>Unknown</span> : <><Num value={n.value} format={(v) => compact(Math.round(v))} />{n.unit || ""}</>}</div>
      <div className="t-foot tile-s">{n.ring !== undefined ? n.sentence : n.period}</div>
    </button>
  );
}

function ReelDetail({ reels, close }: { reels: any; close: () => void }) {
  const router = useRouter();
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="inset flex items-center gap-4" style={{ padding: 18 }}>
        <Ring value={reels.total ? reels.pass / reels.total : null} size={84} stroke={10} id="rd" tone="var(--good)"><div><div className="num" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{reels.pass}</div><div className="t-cap" style={{ fontSize: 10.5 }}>of {reels.total}</div></div></Ring>
        <p className="muted">{reels.pass} passed the scorecard. {reels.hold ? `${reels.hold} ${reels.hold === 1 ? "is" : "are"} on hold until the fixes are made.` : "None are on hold."}</p>
      </div>
      <div className="inset" style={{ overflow: "hidden" }}>
        {reels.list.map((r: any) => (
          <div className="row" key={r.id} style={{ alignItems: "flex-start" }}>
            <Mark name={r.siteName || "?"} color={r.color} />
            <span className="row-main"><span className="row-title" style={{ display: "block" }}>{r.title}</span><span className="row-sub">{r.siteName} · {r.views == null ? "no results yet" : compact(r.views) + " views"}</span>
              <span className="flex items-center gap-2" style={{ marginTop: 6 }}><span className="t-cap">Hooks</span><Pips value={r.hooks.spoken} /><Pips value={r.hooks.text} /><Pips value={r.hooks.visual} /></span>
              {r.verdict === "HOLD" && r.fixes?.[0] && <span className="t-foot" style={{ display: "block", marginTop: 6 }}>Fix first: {r.fixes[0]}</span>}
            </span>
            <span className={"chip " + (r.verdict === "PASS" ? "good" : "bad")}>{r.verdict === "PASS" ? "Pass" : "Hold"}</span>
          </div>
        ))}
      </div>
      <p className="t-foot faint">Scored with scorecard {reels.rubric}. Scores judge the edit. They do not predict how far a reel will travel.</p>
      <button className="btn primary lg" onClick={() => { close(); router.push("/reels"); }}>Open Reel scores<Icon name="chevron" size={16} stroke={2.2} /></button>
    </div>
  );
}

function ReelCard({ reels, i }: { reels: any; i: number }) {
  const app = useApp();
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button ref={ref} className="card tap side-card rise" style={{ ["--i" as any]: i }} onClick={() => app.openCard({ title: "Reels", chip: "Scorecard " + reels.rubric, render: (close) => <ReelDetail reels={reels} close={close} /> }, ref.current)} aria-label={`Reels: ${reels.pass} passed, ${reels.hold} on hold. Open details`}>
      <div className="flex items-center justify-between gap-2"><span className="side-title"><span className="tint coral"><Icon name="reels" size={17} /></span>Reels</span><Icon name="chevron" size={16} className="chev" /></div>
      <div className="flex items-end gap-3" style={{ marginTop: 16 }}>
        <span className="side-big num">{reels.pass}<small>of {reels.total} passed</small></span>
      </div>
      <div className="verdicts" aria-hidden="true">{reels.verdicts.map((v: string, n: number) => <i key={n} className={v === "PASS" ? "ok" : "hold"} />)}</div>
      <p className="t-foot" style={{ marginTop: 12 }}>{reels.hold ? <><b style={{ color: "var(--text)", fontWeight: 650 }}>{reels.hold} on hold</b> until the opening is fixed.</> : "Every recent reel passed the scorecard."}</p>
    </button>
  );
}

function TeamDetail({ team, count, close }: { team: any[]; count: number; close: () => void }) {
  const router = useRouter();
  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="muted">These are waiting on other people. Nothing here is yours to do yet. Tap one to see where it stands.</p>
      <div className="inset" style={{ overflow: "hidden" }}>{team.map((it: any) => <AttentionRow key={it.id} item={it} team />)}</div>
      {count > team.length && <button className="btn tinted" onClick={() => { close(); router.push("/attention"); }}>See all {count}</button>}
    </div>
  );
}

const AV = ["#E0A23B", "#4F8BFF", "#9B7BFF", "#2DBE8B", "#F2708B"];
function TeamCard({ team, count, i }: { team: any[]; count: number; i: number }) {
  const app = useApp();
  const ref = useRef<HTMLButtonElement>(null);
  const people = Array.from(new Set(team.map((t: any) => t.owner))).slice(0, 4) as string[];
  return (
    <button ref={ref} className="card tap side-card rise" style={{ ["--i" as any]: i }} onClick={() => app.openCard({ title: "With your team", chip: "Waiting on others", render: (close) => <TeamDetail team={team} count={count} close={close} /> }, ref.current)} aria-label={`With your team: ${count} things are waiting on other people. Open details`}>
      <div className="flex items-center justify-between gap-2"><span className="side-title"><span className="tint mint"><Icon name="clients" size={17} /></span>With your team</span><Icon name="chevron" size={16} className="chev" /></div>
      <div className="flex items-end justify-between gap-3" style={{ marginTop: 16 }}>
        <span className="side-big num">{count}<small>{count === 1 ? "thing in hand" : "things in hand"}</small></span>
        <span className="avatars" aria-hidden="true">{people.map((p, n) => <i key={p} style={{ background: AV[n % AV.length] }}>{p.split(" ").map((x) => x[0]).join("").slice(0, 2)}</i>)}</span>
      </div>
      <p className="t-foot" style={{ marginTop: 12 }}>{team[0] ? <><b style={{ color: "var(--text)", fontWeight: 650 }}>{team[0].owner}:</b> {team[0].nextStep}</> : "Nothing is waiting on anyone."}</p>
    </button>
  );
}

function AskCard({ i }: { i: number }) {
  const app = useApp();
  return (
    <button className="card tap side-card rise" style={{ ["--i" as any]: i }} onClick={() => app.openPalette()}>
      <div className="flex items-center justify-between gap-2"><span className="side-title"><span className="tint"><Icon name="sparkle" size={17} /></span>Ask your AI</span><Icon name="chevron" size={16} className="chev" /></div>
      <p className="muted" style={{ marginTop: 14, fontSize: 15 }}>Ask anything about this dashboard, in plain words. It answers from your own data.</p>
      <p className="t-foot faint" style={{ marginTop: 10 }}>Uses your own Claude Code or Codex plan.</p>
    </button>
  );
}

export default function Overview() {
  const app = useApp();
  const q = useApi("overview", { scope: app.scopeKey });
  const [metric, setMetric] = useState<"visitors" | "leads">("visitors");
  const sites = app.boot.sites as any[];
  const skeleton = (
    <>
      <div className="hero-card" style={{ minHeight: 230 }}><Skel h={14} w={160} style={{ opacity: 0.5 }} /><Skel h={46} w="54%" r={12} style={{ marginTop: 16, opacity: 0.5 }} /><Skel h={20} w="40%" style={{ marginTop: 14, opacity: 0.5 }} /></div>
      <div className="ov-grid" style={{ marginTop: 34 }}><SkelRows n={5} /><div className="stack"><div className="card pad" style={{ height: 178 }}><Skel w="40%" h={12} /><Skel w="60%" h={32} style={{ marginTop: 18 }} /></div><div className="card pad" style={{ height: 178 }}><Skel w="40%" h={12} /><Skel w="60%" h={32} style={{ marginTop: 18 }} /></div></div></div>
    </>
  );
  return (
    <Page title="Overview" hideHead>
      <Load q={q} skeleton={skeleton}>
        {(d) => {
          const all = app.scope.id === "all";
          const m = d.chart?.[metric];
          const side = [d.reels && <ReelCard key="r" reels={d.reels} i={2} />, d.teamCount > 0 && <TeamCard key="t" team={d.team} count={d.teamCount} i={3} />].filter(Boolean);
          if (side.length < 2) side.push(<AskCard key="a" i={2 + side.length} />);
          return (
            <>
              <div className="hero-card rise" data-phase={app.skyPhase}>
                <span className="hero-orb" aria-hidden="true" />
                <div style={{ position: "relative", minWidth: 0 }}>
                  <div className="flex items-center gap-3 flex-wrap"><span className="hero-date">{dateLong(Date.now())}</span><SampleTag show={d.sample} /></div>
                  <h1 className="hello">{d.greeting.hello}</h1>
                  <p className="hello-line">{d.greeting.line}</p>
                  {d.start && <button className="btn lg on-hero" style={{ marginTop: 22, maxWidth: "100%" }} onClick={(e) => app.openItem(d.start.id, e.currentTarget)}><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Start with: {d.start.title}</span><Icon name="chevron" size={16} stroke={2.4} /></button>}
                </div>
              </div>

              {!d.setupDone && <Link href="/setup" className="notice glass rise" style={{ marginTop: 16, ["--i" as any]: 1 }}><span style={{ color: "var(--accent)", display: "flex" }}><Icon name="setup" size={18} /></span><span style={{ flex: 1 }}>Finish setting up: tell the dashboard about you, your goals and your tools.</span><Icon name="chevron" size={15} className="chev" /></Link>}

              <div className="ov-grid" style={{ marginTop: 36 }}>
                <Section title="Needs your attention" i={1} action={d.totalNeedsYou > 0 && <Link className="link" href="/attention">See all {d.totalNeedsYou}</Link>}>
                  <div className="card group top5">
                    {d.top.length ? d.top.map((it: any, n: number) => <AttentionRow key={it.id} item={it} showScope={all} rank={n + 1} />) : <Empty art="clear" title="All clear"><p>Nothing needs you{all ? "" : ` for ${app.scopeLabel}`} right now.</p></Empty>}
                  </div>
                  <p className="t-foot on-sky" style={{ padding: "12px 6px 0" }}>Pulled from Linear, Gmail and Slack, then ranked for you. Tap a card to see why it is there.</p>
                </Section>
                <div className="stack" style={{ gap: 20, paddingTop: 38 }}>{side}</div>
              </div>

              {app.scope.mode === "sites" && (
                <div style={{ marginTop: 48 }}>
                  <Section title="How the websites are doing" i={3} action={<Link className="link" href="/website">Open Website</Link>}>
                    {sites.length > 0 && (
                      <div className="site-tabs" role="tablist" aria-label="Website">
                        <button role="tab" aria-selected={all} className={"site-tab" + (all ? " on" : "")} onClick={() => app.setScope({ mode: "sites", id: "all" })}><span className="all-dot"><Icon name="website" size={13} /></span>All websites</button>
                        {sites.map((s) => <button key={s.id} role="tab" aria-selected={app.scope.id === s.id} className={"site-tab" + (app.scope.id === s.id ? " on" : "")} onClick={() => app.setScope({ mode: "sites", id: s.id })}><i style={{ background: s.color }} />{s.name}</button>)}
                      </div>
                    )}
                    <div className="tiles">{d.numbers.map((n: any, i: number) => <Tile key={n.id} n={n} i={i} chart={d.chart} />)}</div>
                    <div className="card chart-card rise" style={{ ["--i" as any]: 6 }}>
                      {d.chart && m ? (
                        <>
                          <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 14 }}>
                            <div style={{ minWidth: 0 }}><div className="t-head" style={{ fontSize: 17 }}>{d.chart.name} {metric}</div><div className="t-foot">{full(m.total)} in the last 28 days{m.delta != null ? `, ${pctText(m.delta)} on the four weeks before` : ""}</div></div>
                            <Segmented label="Show" value={metric} onChange={setMetric} options={[{ value: "visitors", label: "Visitors" }, { value: "leads", label: "Leads" }]} />
                          </div>
                          <BarChart key={app.scopeKey + metric} data={m.series} label={`${d.chart.name} ${metric}`} />
                          <p className="t-foot faint" style={{ marginTop: 6 }}>From {d.chart.source}{d.sample ? ", sample data" : ""}. Pick a website above and this chart follows it.</p>
                        </>
                      ) : <Empty art="connect" title="No website numbers yet"><p>Connect Google Analytics and your websites and their charts appear here by themselves.</p><Link className="btn tinted" style={{ marginTop: 10 }} href="/connections">Open Connections</Link></Empty>}
                    </div>
                  </Section>
                </div>
              )}
              {app.scope.mode === "clients" && <div style={{ marginTop: 48 }}><Section title="Client work at a glance" i={3}><div className="tiles">{d.numbers.map((n: any, i: number) => <Tile key={n.id} n={n} i={i} chart={null} />)}</div></Section></div>}
            </>
          );
        }}
      </Load>
    </Page>
  );
}

"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi, useApp } from "@/lib/client";
import { clock, compact, dateLong, dayName } from "@/lib/format";
import { startOfDay } from "@/lib/rand";
import { AttentionRow } from "@/components/attention";
import { Spark } from "@/components/charts";
import { Delta, Empty, Fold, Icon, Load, Num, Page, Ring, SampleTag, Section, Skel, SkelRows } from "@/components/ui";
import { hrefOf } from "@/components/shell";

function Tile({ n, i }: { n: any; i: number }) {
  const router = useRouter();
  return (
    <button className="card tap tile rise" style={{ ["--i" as any]: i + 2 }} onClick={() => router.push(hrefOf(n.href))} aria-label={`${n.label}: ${n.value == null ? "unknown" : n.value + (n.unit || "")}. ${n.sentence} Open ${n.href}`}>
      <div className="flex items-center justify-between gap-2"><span className="t-cap" style={{ fontSize: 13 }}>{n.label}</span><Delta d={n.delta} /></div>
      {n.ring !== undefined ? (
        <div className="flex items-center gap-3" style={{ marginTop: 10 }}>
          <Ring value={n.ring} size={64} stroke={8} id={"g" + n.id}><span className="num" style={{ fontSize: 15, fontWeight: 700 }}>{n.value == null ? "?" : n.value + "%"}</span></Ring>
          <span style={{ fontSize: 14, fontWeight: 560, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.sentence}</span>
        </div>
      ) : (
        <>
          <div className="t-big" style={{ marginTop: 8 }}><Num value={n.value} format={(v) => compact(Math.round(v))} /></div>
          <div className="t-foot" style={{ marginTop: 6, paddingBottom: 10 }}>{n.sentence}</div>
        </>
      )}
      {n.spark?.length > 1 && <div className="tile-spark"><Spark data={n.spark} /></div>}
      {n.ring !== undefined && <div className="t-foot faint" style={{ marginTop: "auto", paddingBottom: 14 }}>{n.period}</div>}
    </button>
  );
}

export default function Overview() {
  const app = useApp();
  const q = useApi("overview", { scope: app.scopeKey });
  const [teamOpen, setTeamOpen] = useState(false);
  const skeleton = (
    <>
      <div className="hero"><div><Skel h={14} w={160} /><Skel h={44} w="62%" r={12} style={{ marginTop: 14 }} /><Skel h={20} w="44%" style={{ marginTop: 14 }} /></div><Skel h={112} w={112} r={56} /></div>
      <div className="ov-grid"><SkelRows n={5} /><div className="tiles">{[0, 1, 2, 3].map((i) => <div key={i} className="card pad" style={{ height: 168 }}><Skel w="40%" h={12} /><Skel w="60%" h={32} style={{ marginTop: 14 }} /><Skel w="85%" h={11} style={{ marginTop: 14 }} /></div>)}</div></div>
    </>
  );
  return (
    <Page title="Overview" hideHead>
      <Load q={q} skeleton={skeleton}>
        {(d) => {
          const all = app.scope.id === "all";
          const cleared = d.ring.total > 0 && d.ring.left === 0;
          return (
            <>
              <div className="hero rise">
                <div style={{ minWidth: 0 }}>
                  <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 12 }}><span className="t-cap" style={{ fontSize: 13 }}>{dateLong(Date.now())}</span><SampleTag show={d.sample} /></div>
                  <h1 className="hello">{d.greeting.hello}</h1>
                  <p className="hello-line">{d.greeting.line}</p>
                  {d.start && <button className="btn primary lg" style={{ marginTop: 20, maxWidth: "100%" }} onClick={(e) => app.openItem(d.start.id, e.currentTarget)}><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Start with: {d.start.title}</span><Icon name="chevron" size={16} stroke={2.2} /></button>}
                </div>
                <div className="kring-wrap" role="img" aria-label={`Today: ${d.ring.done} cleared, ${d.ring.left} still need you`}>
                  <Ring value={d.ring.total ? d.ring.done / d.ring.total : 1} id="today" tone={cleared || !d.ring.total ? "var(--good)" : undefined}>
                    {cleared || !d.ring.total ? <span style={{ color: "var(--good)" }}><Icon name="check" size={34} stroke={2.4} /></span> : <div><div className="num" style={{ fontSize: 30, fontWeight: 720, letterSpacing: "-0.04em", lineHeight: 1 }}>{d.ring.left}</div><div className="t-cap" style={{ fontSize: 11 }}>to go</div></div>}
                  </Ring>
                  <div><div className="t-head">Today</div><div className="t-foot" style={{ maxWidth: "16ch" }}>{!d.ring.total ? "Nothing is due today." : `${d.ring.done ? `${d.ring.done} cleared so far.` : "Nothing cleared yet."} ${cleared ? "You are done." : "The ring fills as you go."}`}</div></div>
                </div>
              </div>

              {(d.notices.broken.length > 0 || !d.setupDone) && (
                <div className="grid gap-2 rise" style={{ marginBottom: 18, ["--i" as any]: 1 }}>
                  {!d.setupDone && <Link href="/setup" className="notice"><span style={{ color: "var(--accent)", display: "flex" }}><Icon name="setup" size={18} /></span><span style={{ flex: 1 }}>Finish setting up: tell the dashboard about you, your goals and your tools.</span><Icon name="chevron" size={15} className="chev" /></Link>}
                  {d.notices.broken.map((b: any) => <Link key={b.id} href="/connections" className="notice"><span className="dot bad" /><span style={{ flex: 1 }}><b style={{ color: "var(--text)", fontWeight: 600 }}>{b.name}</b> needs attention. {b.detail}</span><Icon name="chevron" size={15} className="chev" /></Link>)}
                </div>
              )}

              <div className="ov-grid">
                <div className="stack">
                  <Section title="Needs your attention" i={1} action={d.totalNeedsYou > 0 && <Link className="link" href="/attention">See all {d.totalNeedsYou}</Link>}>
                    <div className="card group">
                      {d.top.length ? d.top.map((it: any) => <AttentionRow key={it.id} item={it} showScope={all} />) : <Empty art="clear" title="All clear"><p>Nothing needs you{all ? "" : ` for ${app.scopeLabel}`} right now.</p></Empty>}
                    </div>
                    <p className="t-foot faint" style={{ padding: "10px 6px 0" }}>Ranked for you. Tap a card to see why it is there and where it came from.</p>
                  </Section>

                  {d.teamCount > 0 && (
                    <Section i={3}>
                      <div className="card group">
                        <button className="row flush" onClick={() => setTeamOpen((o) => !o)} aria-expanded={teamOpen}>
                          <span className="glyph"><Icon name="clients" size={17} /></span>
                          <span className="row-main"><span className="row-title" style={{ display: "block" }}>Team is handling {d.teamCount} {d.teamCount === 1 ? "thing" : "things"}</span><span className="row-sub">Waiting on other people. Nothing for you to do yet.</span></span>
                          <Icon name="chevron" size={16} className={"chev caret" + (teamOpen ? " open" : "")} />
                        </button>
                        <Fold open={teamOpen}><hr className="divider" />{d.team.map((it: any) => <AttentionRow key={it.id} item={it} team />)}{d.teamCount > d.team.length && <Link href="/attention" className="row flush link" style={{ justifyContent: "center", minHeight: 44 }}>See all {d.teamCount}</Link>}</Fold>
                      </div>
                    </Section>
                  )}
                </div>

                <div className="stack">
                  <div className="tiles">{d.numbers.map((n: any, i: number) => <Tile key={n.id} n={n} i={i} />)}</div>
                  <Section title="Today" i={5} action={<Link className="link" href="/calendar">Calendar</Link>}>
                    <div className="card group">
                      {d.today.meetings.length + d.today.due.length === 0 && <Empty art="quiet" title="A quiet day"><p>No meetings and nothing due today.</p></Empty>}
                      {d.today.due.map((e: any) => <div className="row" key={e.id}><span className="glyph bad"><Icon name="flag" size={16} /></span><span className="row-main"><span className="row-title" style={{ display: "block" }}>{e.title}</span><span className="row-sub">Due today</span></span><span className="chip bad num">{clock(e.start)}</span></div>)}
                      {d.today.meetings.map((e: any) => <div className="row" key={e.id}><span className="glyph"><Icon name="calendar" size={16} /></span><span className="row-main"><span className="row-title" style={{ display: "block" }}>{e.title}</span><span className="row-sub">{e.with ? "With " + e.with : e.kind === "focus" ? "Time kept free" : ""}</span></span><span className="chip num">{startOfDay(e.start) === startOfDay(Date.now()) ? "" : dayName(e.start) + " "}{clock(e.start)}</span></div>)}
                    </div>
                  </Section>
                  {d.notices.newSuggestions > 0 && <Link href="/suggestions" className="notice rise" style={{ ["--i" as any]: 6 }}><span style={{ color: "var(--warn)", display: "flex" }}><Icon name="suggestions" size={18} /></span><span style={{ flex: 1 }}>{d.notices.newSuggestions} idea{d.notices.newSuggestions > 1 ? "s" : ""} to make this dashboard more useful</span><Icon name="chevron" size={15} className="chev" /></Link>}
                </div>
              </div>
            </>
          );
        }}
      </Load>
    </Page>
  );
}

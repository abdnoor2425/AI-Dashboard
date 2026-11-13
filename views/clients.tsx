"use client";
import React from "react";
import { useApi, useApp } from "@/lib/client";
import { ago, clock, dateShort, dayName, dueLabel } from "@/lib/format";
import { AttentionRow } from "@/components/attention";
import { Empty, Icon, Load, Mark, Page, SampleTag, Section, SkelCards, Status } from "@/components/ui";

function One({ id }: { id: string }) {
  const q = useApi("clients", { id });
  return (
    <Load q={q} skeleton={<SkelCards n={4} h={200} />}>
      {(d) => {
        const c = d.clients[0];
        if (!c) return <div className="card"><Empty art="search" title="Client not found" /></div>;
        return (
          <div className="stack">
            <Section title="Needs you"><div className="card group">{c.needsYou.length ? c.needsYou.map((it: any) => <AttentionRow key={it.id} item={it} />) : <Empty art="clear" title="All clear"><p>Nothing is waiting on you for {c.name}.</p></Empty>}{c.waiting.map((it: any) => <AttentionRow key={it.id} item={it} team />)}</div></Section>
            <div className="grid-2">
              <Section title="Tasks" i={1}><div className="card group">{c.tasks.map((t: any) => <div className="row flush" key={t.id}><span className="row-main"><span className="row-title" style={{ display: "block" }}>{t.title}</span><span className="row-sub">{t.owner} · due {dateShort(t.due)}</span></span><Status>{t.status}</Status></div>)}</div></Section>
              <Section title="Updates" i={2}><div className="card group">{c.updates.map((u: any) => <div className="row flush" key={u.id}><span className="row-main"><span style={{ fontSize: 14.5 }}>{u.text}</span></span><span className="t-foot faint" style={{ flex: "none" }}>{ago(u.at)}</span></div>)}</div></Section>
              <Section title="Files" i={3}><div className="card group">{c.files.map((f: any) => <div className="row" key={f.id}><span className="glyph"><Icon name="doc" size={16} /></span><span className="row-main"><span className="row-title" style={{ display: "block" }}>{f.name}</span></span><span className="t-foot faint">{ago(f.modified)}</span></div>)}</div></Section>
              <Section title="Meetings" i={4}><div className="card group">{c.meetings.map((m: any) => <div className="row" key={m.id}><span className="glyph"><Icon name="calendar" size={16} /></span><span className="row-main"><span className="row-title" style={{ display: "block" }}>{m.title}</span></span><span className="chip num">{dayName(m.start)} {clock(m.start)}</span></div>)}</div></Section>
            </div>
            <p className="t-foot faint" style={{ padding: "0 6px" }}>This is your view of {c.name}. When {c.contact} runs their own copy of this dashboard, it holds only their data and never sees yours or another client's.</p>
          </div>
        );
      }}
    </Load>
  );
}

export default function Clients() {
  const app = useApp();
  const one = app.scope.mode === "clients" && app.scope.id !== "all" ? app.scope.id : null;
  const q = useApi(one ? null : "clients");
  const cl = app.boot.clients.find((c: any) => c.id === one);
  return (
    <Page title={cl ? cl.name : "Clients"} sub={cl ? cl.sub : "Who needs a reply, what is waiting for approval and what is due next."} actions={<SampleTag show={app.boot.workspace.sample} />}>
      {one ? <One id={one} key={one} /> : (
        <Load q={q} skeleton={<SkelCards n={3} h={210} cols="grid-auto" />}>
          {(d) => d.clients.length ? (
            <div className="grid-auto">
              {d.clients.map((c: any, i: number) => {
                const due = dueLabel(c.nextDue);
                return (
                  <button key={c.id} className="card tap pad rise" style={{ ["--i" as any]: i }} onClick={() => app.setScope({ mode: "clients", id: c.id })} aria-label={`${c.name}. ${c.replies} replies owed, ${c.approvals} approvals waiting. Open`}>
                    <div className="flex items-center gap-3"><Mark name={c.name} color={c.color} lg /><div style={{ minWidth: 0 }}><div className="t-head">{c.name}</div><div className="t-foot">{c.sub}</div></div></div>
                    <div className="flex gap-6" style={{ marginTop: 18 }}>
                      <div><div className="t-mid num" style={{ color: c.replies ? "var(--text)" : "var(--text-3)" }}>{c.replies}</div><div className="t-cap">{c.replies === 1 ? "Reply owed" : "Replies owed"}</div></div>
                      <div><div className="t-mid num" style={{ color: c.approvals ? "var(--text)" : "var(--text-3)" }}>{c.approvals}</div><div className="t-cap">{c.approvals === 1 ? "Approval waiting" : "Approvals waiting"}</div></div>
                    </div>
                    <div className="flex items-center justify-between gap-2" style={{ marginTop: 16, paddingTop: 12, borderTop: "0.5px solid var(--sep)" }}><span className="t-foot">Next due</span>{due ? <span className={"chip num " + (due.tone === "calm" ? "" : due.tone)}>{due.text}</span> : <span className="t-foot faint">Nothing scheduled</span>}</div>
                  </button>
                );
              })}
            </div>
          ) : <div className="card"><Empty title="No clients here"><p>This workspace is for one business, so there is no client list.</p></Empty></div>}
        </Load>
      )}
    </Page>
  );
}

"use client";
import React, { useState } from "react";
import Link from "next/link";
import { api, useApi, useApp } from "@/lib/client";
import { ago, clock, compact, dateShort, dayName } from "@/lib/format";
import { DAY, startOfDay } from "@/lib/rand";
import { HBars } from "@/components/charts";
import { Empty, Fold, Icon, Load, Mark, Page, SampleTag, Section, Segmented, SkelCards, SkelRows, Status } from "@/components/ui";

export function Inbox() {
  const app = useApp();
  const q = useApi("inbox", { scope: app.scopeKey });
  const [f, setF] = useState<"reply" | "all">("reply");
  return (
    <Page title="Inbox" sub="Email and Slack messages in one list. The ones that need a reply come first." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <Load q={q} skeleton={<SkelRows n={6} />}>
        {(d) => {
          const list = d.messages.filter((m: any) => f === "all" || m.needsReply);
          return (
            <div className="stack">
              <Segmented label="Filter" value={f} onChange={setF} options={[{ value: "reply", label: "Needs a reply", count: d.messages.filter((m: any) => m.needsReply).length }, { value: "all", label: "Everything", count: d.messages.length }]} />
              <Section key={f}><div className="card group">
                {list.length ? list.map((m: any) => (
                  <div className="row" key={m.id} style={{ alignItems: "flex-start" }}>
                    <span className="glyph" title={m.tool === "gmail" ? "Email" : "Slack"}><Icon name={m.tool} size={16} /></span>
                    <span className="row-main"><span className="flex items-baseline gap-2 flex-wrap"><span className="row-title">{m.from}</span><span className="t-foot">{m.subject}</span></span><span className="row-sub">{m.preview}</span>{m.scopeLabel && <span className="t-cap" style={{ display: "block", marginTop: 4 }}>{m.scopeLabel}</span>}</span>
                    <span style={{ textAlign: "right", flex: "none", display: "grid", gap: 6, justifyItems: "end" }}><span className="t-foot faint">{ago(m.at)}</span>{m.needsReply && <span className="chip accent">Needs reply</span>}</span>
                  </div>
                )) : <Empty art="clear" title="Inbox clear"><p>Nobody is waiting on a reply.</p></Empty>}
              </div></Section>
              <p className="t-foot faint" style={{ padding: "0 6px" }}>The dashboard only reads. Replies are always written and sent by you, in your own email or Slack.</p>
            </div>
          );
        }}
      </Load>
    </Page>
  );
}

export function Calendar() {
  const app = useApp();
  const q = useApi("calendar", { scope: app.scopeKey });
  return (
    <Page title="Calendar" sub="Meetings and deadlines for the next seven days." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <Load q={q} skeleton={<SkelCards n={4} h={220} cols="grid-auto" />}>
        {(d) => (
          <div style={{ overflowX: "auto", margin: "0 -4px", padding: "4px 4px 16px" }}>
            <div className="cal">
              {Array.from({ length: d.days }, (_, i) => {
                const day = d.start + i * DAY, evs = d.events.filter((e: any) => startOfDay(e.start) === startOfDay(day + DAY / 2));
                return (
                  <div key={i} className={"cal-day rise" + (i === 0 ? " today" : "")} style={{ ["--i" as any]: i }}>
                    <div className="t-cap" style={{ color: i === 0 ? "var(--accent)" : undefined }}>{i === 0 ? "Today" : dayName(day + DAY / 2)}</div>
                    <div className="num" style={{ fontSize: 22, fontWeight: 680, letterSpacing: "-0.03em" }}>{new Date(day + DAY / 2).getDate()}</div>
                    {evs.map((e: any) => <div key={e.id} className={"ev " + e.kind}><div style={{ fontWeight: 600 }}>{e.title}</div><div className="muted num">{e.kind === "deadline" ? "Due " : ""}{clock(e.start)}</div></div>)}
                    {!evs.length && <div className="t-foot faint" style={{ marginTop: 10 }}>Free</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Load>
    </Page>
  );
}

export function Files() {
  const app = useApp();
  const q = useApi("files", { scope: app.scopeKey });
  return (
    <Page title="Files" sub="Recent files from Google Drive, newest first." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <Load q={q} skeleton={<SkelRows n={6} />}>
        {(d) => <div className="card group">{d.files.length ? d.files.map((f: any) => <div className="row" key={f.id}><span className="glyph"><Icon name={f.type} size={16} /></span><span className="row-main"><span className="row-title" style={{ display: "block" }}>{f.name}</span><span className="row-sub">{f.owner}{f.scopeLabel ? " · " + f.scopeLabel : ""}</span></span><span className="t-foot faint">{ago(f.modified)}</span></div>) : <Empty title="No files here"><p>Files show once Google Drive is connected.</p></Empty>}</div>}
      </Load>
    </Page>
  );
}

export function Outputs() {
  const app = useApp();
  const q = useApi("outputs", { scope: app.scopeKey });
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Page title="Outputs" sub="Every finished document in one place, with the task it came from and which version was approved." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <div className="stack">
        <div style={{ position: "relative", maxWidth: 420 }}><span style={{ position: "absolute", left: 12, top: 10, color: "var(--text-3)" }}><Icon name="search" size={18} /></span><input id="outputs-search" className="input" style={{ paddingLeft: 38 }} placeholder="Find a document" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Find a document" /></div>
        <Load q={q} skeleton={<SkelRows n={5} />}>
          {(d) => {
            const list = d.outputs.filter((o: any) => (o.title + o.task + o.scopeLabel + o.owner).toLowerCase().includes(term.toLowerCase()));
            return (
              <div className="card group">
                {list.length ? list.map((o: any) => (
                  <div key={o.id} style={{ position: "relative" }} className="row-wrap">
                    <button className="row" onClick={() => setOpen(open === o.id ? null : o.id)} aria-expanded={open === o.id}>
                      <span className="glyph"><Icon name="outputs" size={16} /></span>
                      <span className="row-main"><span className="row-title" style={{ display: "block" }}>{o.title}</span><span className="row-sub">{o.scopeLabel} · {o.owner} · task {o.task}</span></span>
                      <span className="hide-sm t-foot">{o.latestApproved ? `Approved: ${o.latestApproved.version}` : "Nothing approved yet"}</span>
                      <Status>{o.latest.state}</Status>
                      <Icon name="chevron" size={16} className={"chev caret" + (open === o.id ? " open" : "")} />
                    </button>
                    <Fold open={open === o.id}><div style={{ padding: "0 16px 14px 60px" }}>{o.revisions.map((r: any) => <div key={r.version} className="flex items-center gap-3" style={{ padding: "6px 0", fontSize: 14 }}><span className="num" style={{ fontWeight: 620, width: 54 }}>{r.version}</span><Status>{r.state}</Status><span className="faint">{ago(r.at)}</span>{o.latestApproved?.version === r.version && <span className="t-cap" style={{ color: "var(--good)" }}>Latest approved</span>}</div>)}</div></Fold>
                    <hr className="divider" style={{ marginLeft: 60 }} />
                  </div>
                )) : <Empty art="search" title="Nothing matches"><p>Try a different word.</p></Empty>}
              </div>
            );
          }}
        </Load>
      </div>
    </Page>
  );
}

export function Skills() {
  const app = useApp();
  const q = useApi("skills");
  return (
    <Page title="Skills" sub="Small, repeatable playbooks your AI can run. Each one says what it needs and what it is allowed to touch." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <Load q={q} skeleton={<SkelCards n={6} h={200} cols="grid-auto" />}>
        {(d) => (
          <div className="grid-auto">
            {d.skills.map((s: any, i: number) => (
              <div key={s.id} className="card pad rise" style={{ ["--i" as any]: i, display: "flex", flexDirection: "column", gap: 8, opacity: s.status === "Unavailable" ? 0.75 : 1 }}>
                <div className="flex items-center justify-between gap-2"><span className="glyph accent"><Icon name="skills" size={17} /></span><Status>{s.status}</Status></div>
                <h2 className="t-head">{s.name}</h2>
                <p className="muted" style={{ fontSize: 14.5 }}>{s.purpose}</p>
                <dl className="t-foot" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", marginTop: "auto", paddingTop: 8 }}>
                  <dt>Needs</dt><dd style={{ color: "var(--text)" }}>{s.inputs}</dd><dt>Uses</dt><dd style={{ color: "var(--text)" }}>{s.tools.join(", ")}</dd><dt>Access</dt><dd style={{ color: "var(--text)" }}>{s.permissions}</dd><dt>Version</dt><dd style={{ color: "var(--text)" }}>{s.version} · {s.owner}</dd>
                </dl>
                <div className="quote" style={{ padding: "9px 12px", fontSize: 13.5 }}><span className="t-cap">Try saying</span><br />"{s.example}"</div>
                {s.note && <p className="t-foot" style={{ color: "var(--bad)" }}>{s.note}</p>}
              </div>
            ))}
          </div>
        )}
      </Load>
    </Page>
  );
}

export function Suggestions() {
  const app = useApp();
  const q = useApi("suggestions");
  const set = async (id: string, status: string) => { try { await api("suggestions/" + id, { method: "POST", body: { status } }); app.toast(status === "accepted" ? "Marked for you to act on" : status === "dismissed" ? "Dismissed" : "Put back"); } catch (e: any) { app.toast(e.message); } };
  return (
    <Page title="Suggestions" sub="A short list of ideas to make this dashboard more useful. Each one says why. Nothing changes unless you do it." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <Load q={q} skeleton={<SkelRows n={4} />}>
        {(d) => {
          const fresh = d.suggestions.filter((s: any) => s.status === "new"), rest = d.suggestions.filter((s: any) => s.status !== "new");
          return (
            <div className="stack">
              {fresh.length ? fresh.map((s: any, i: number) => (
                <div key={s.id} className="card pad rise" style={{ ["--i" as any]: i }}>
                  <div className="flex gap-3 items-start"><span className="glyph warn"><Icon name="suggestions" size={17} /></span><div style={{ minWidth: 0, flex: 1 }}>
                    <h2 className="t-head">{s.title}</h2><p className="muted" style={{ marginTop: 4 }}>{s.reason}</p>
                    <div className="flex gap-2 flex-wrap" style={{ marginTop: 10 }}><span className="chip">Gives you: {s.benefit}</span><span className="chip">Takes: {s.effort}</span><span className="chip">{s.owner}</span></div>
                    <div className="flex gap-2 flex-wrap" style={{ marginTop: 14 }}><Link className="btn primary sm" href={"/" + (s.link === "preferences" ? "settings" : s.link)} onClick={() => set(s.id, "accepted")}>Take me there</Link><button className="btn sm" onClick={() => set(s.id, "accepted")}>I will do it later</button><button className="btn plain sm" style={{ color: "var(--text-2)" }} onClick={() => set(s.id, "dismissed")}>Dismiss</button></div>
                  </div></div>
                </div>
              )) : <div className="card"><Empty art="clear" title="No new ideas"><p>The dashboard will suggest something when it spots a gap.</p></Empty></div>}
              {rest.length > 0 && <Section title="Already handled"><div className="card group">{rest.map((s: any) => <div className="row flush" key={s.id}><span className="row-main"><span className="row-title" style={{ display: "block" }}>{s.title}</span><span className="row-sub">{s.status === "accepted" ? "Accepted" : "Dismissed"}</span></span><button className="btn sm" onClick={() => set(s.id, "new")}>Put back</button></div>)}</div></Section>}
              <p className="t-foot faint" style={{ padding: "0 6px" }}>{d.note}</p>
            </div>
          );
        }}
      </Load>
    </Page>
  );
}

export function Usage() {
  const app = useApp();
  const q = useApi("usage");
  return (
    <Page title="AI usage" sub="What your AI plans cost and where the usage went. Plans are a fixed price. Extra spend is counted separately." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <Load q={q} skeleton={<SkelCards n={3} h={150} cols="grid-3" />}>
        {(d) => {
          const byTask = [...d.entries].filter((e: any) => e.tokens != null).sort((a: any, b: any) => b.tokens - a.tokens).slice(0, 6);
          const over = d.extraSpend > d.budget.monthlyExtra;
          return (
            <div className="stack">
              <div className="grid-3">
                {d.plans.map((p: any, i: number) => <div key={p.provider} className="card pad rise" style={{ ["--i" as any]: i }}><div className="flex items-center justify-between"><span className="t-head">{p.provider}</span><Status>{p.status}</Status></div><div className="t-big num" style={{ marginTop: 12 }}>${p.monthly}<span className="t-foot" style={{ fontWeight: 500 }}> a month</span></div><div className="t-foot" style={{ marginTop: 6 }}>{p.plan} plan{p.status === "Connected" ? ". Summaries and answers run on this." : ". Link it on the Connections page."}</div></div>)}
                <div className="card pad rise" style={{ ["--i" as any]: 2 }}><div className="flex items-center justify-between"><span className="t-head">Extra spend</span><span className={"chip " + (over ? "bad" : "good")}>{over ? "Over budget" : "Within budget"}</span></div><div className="t-big num" style={{ marginTop: 12 }}>${d.extraSpend.toFixed(2)}<span className="t-foot" style={{ fontWeight: 500 }}> of ${d.budget.monthlyExtra}</span></div><div className="bar-track" style={{ marginTop: 12 }}><div className="bar-fill" style={{ width: `${Math.min(100, (d.extraSpend / d.budget.monthlyExtra) * 100)}%`, background: over ? "var(--bad)" : undefined }} /></div><div className="t-foot" style={{ marginTop: 8 }}>{d.budget.note}</div></div>
              </div>
              <Section title="Where the usage went" i={3}><div className="card pad"><HBars rows={byTask.map((e: any) => ({ label: e.task, value: e.tokens, sub: "tokens" }))} /></div></Section>
              <Section title="Every entry" i={4}>
                <div className="card tbl-wrap"><table className="tbl"><thead><tr><th>Task</th><th>For</th><th>Ran on</th><th className="r">Tokens</th><th className="r">Cost</th><th>When</th></tr></thead><tbody>
                  {d.entries.map((e: any) => <tr key={e.id}><td style={{ fontWeight: 560 }}>{e.task}</td><td>{e.scopeLabel}</td><td>{e.provider}</td><td className="r num">{e.tokens == null ? <span style={{ color: "var(--warn)" }}>Unknown</span> : compact(e.tokens)}</td><td className="r num">{e.kind === "plan" ? <span className="faint">{e.tokens == null ? "Unknown" : "In plan"}</span> : e.cost == null ? "Unknown" : `$${e.cost.toFixed(2)}${e.estimated ? " est." : ""}`}</td><td className="faint">{dateShort(e.at)}</td></tr>)}
                </tbody></table></div>
              </Section>
              <p className="t-foot faint" style={{ padding: "0 6px" }}>{d.note} {d.unknown > 0 ? `${d.unknown} entr${d.unknown > 1 ? "ies have" : "y has"} no usage reported and shows as Unknown.` : ""}</p>
            </div>
          );
        }}
      </Load>
    </Page>
  );
}

"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api, useApi, useApp } from "@/lib/client";
import { Icon, Load, Page, Section, SkelCards } from "@/components/ui";
import { hrefOf } from "@/components/shell";

const STEPS = [
  { title: "About you", sub: "So the dashboard can speak to you by name." },
  { title: "Your goals", sub: "Up to five. They shape what counts as important." },
  { title: "Connect your tools", sub: "Start with one. You can add the rest any time." },
];

function Wizard({ d }: { d: any }) {
  const app = useApp();
  const [step, setStep] = useState(Math.min(d.setup.step || 0, 2));
  const [about, setAbout] = useState(d.setup.about);
  const [goals, setGoals] = useState<string[]>(d.setup.goals.length ? d.setup.goals : [""]);
  const [done, setDone] = useState(false);
  useEffect(() => { setAbout(d.setup.about); }, [d.setup.about.name, d.setup.about.role, d.setup.about.business]);
  const save = (body: any) => api("setup", { method: "POST", body }).catch((e: any) => app.toast(e.message));
  const go = async (n: number) => {
    await save({ about, goals: goals.filter((g) => g.trim()), step: Math.min(n, 2) });
    if (n > 2) { await save({ done: true }); setDone(true); app.reloadBoot(); } else setStep(n);
  };
  const connected = d.connections.filter((c: any) => c.status === "connected").length;
  if (done) return (
    <div className="card pad setup-card rise" style={{ textAlign: "center", padding: "44px 24px" }}>
      <span className="done-badge"><Icon name="check" size={30} stroke={2.4} /></span>
      <h2 className="t-mid" style={{ marginTop: 16 }}>You are set up</h2>
      <p className="muted" style={{ margin: "6px auto 20px", maxWidth: "40ch" }}>Your Overview is ready. It will keep itself up to date from the tools you connected.</p>
      <Link className="btn primary lg" href={hrefOf("overview")}>Open Overview</Link>
    </div>
  );
  return (
    <div className="card pad setup-card">
      <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-label="Setup progress">{STEPS.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
      <div key={step} className="rise" style={{ marginTop: 22 }}>
        <div className="t-cap">Step {step + 1} of 3</div>
        <h2 className="t-mid" style={{ marginTop: 4 }}>{STEPS[step].title}</h2>
        <p className="muted" style={{ marginBottom: 18 }}>{STEPS[step].sub}</p>
        {step === 0 && (
          <div className="stack" style={{ gap: 14 }}>
            <label><span className="t-cap">Your name</span><input className="input" value={about.name || ""} onChange={(e) => setAbout({ ...about, name: e.target.value })} maxLength={40} autoComplete="given-name" /></label>
            <label><span className="t-cap">Your role</span><input className="input" value={about.role || ""} onChange={(e) => setAbout({ ...about, role: e.target.value })} placeholder="Founder, owner, marketing lead" maxLength={60} /></label>
            <label><span className="t-cap">Your business</span><input className="input" value={about.business || ""} onChange={(e) => setAbout({ ...about, business: e.target.value })} maxLength={60} /></label>
          </div>
        )}
        {step === 1 && (
          <div className="stack" style={{ gap: 10 }}>
            {goals.map((g, i) => (
              <div className="flex gap-2 items-center" key={i}>
                <span className="goal-n num">{i + 1}</span>
                <input className="input" value={g} onChange={(e) => setGoals(goals.map((x, j) => (j === i ? e.target.value : x)))} placeholder={i === 0 ? "For example: grow leads by 20% this quarter" : "Another goal"} maxLength={140} aria-label={`Goal ${i + 1}`} />
                {goals.length > 1 && <button className="icon-btn sm" onClick={() => setGoals(goals.filter((_, j) => j !== i))} aria-label={`Remove goal ${i + 1}`}><Icon name="x" size={15} /></button>}
              </div>
            ))}
            {goals.length < 5 && <div><button className="btn plain sm" onClick={() => setGoals([...goals, ""])}><Icon name="plus" size={15} />Add a goal</button></div>}
          </div>
        )}
        {step === 2 && (
          <div className="stack" style={{ gap: 12 }}>
            <div className="card group inset">
              {d.connections.slice(0, 6).map((c: any) => (
                <div className="row" key={c.id}>
                  <span className="glyph"><Icon name={c.tool} size={16} /></span>
                  <span className="row-main"><span className="row-title" style={{ display: "block" }}>{c.name}</span><span className="row-sub">{c.gives}</span></span>
                  {c.status === "connected" ? <span className="chip good">Connected</span> : <Link className="btn tinted sm" href={hrefOf("connections")}>Connect</Link>}
                </div>
              ))}
            </div>
            <p className="t-foot faint">{connected} connected. Google Analytics found {d.sitesFound} website{d.sitesFound === 1 ? "" : "s"}, and each one gets its own view automatically.</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2" style={{ marginTop: 26 }}>
        <button className="btn plain" onClick={() => setStep(step - 1)} disabled={step === 0}>Back</button>
        <button className="btn primary" onClick={() => go(step + 1)} disabled={step === 0 && !(about.name || "").trim()}>{step === 2 ? "Finish" : "Continue"}</button>
      </div>
    </div>
  );
}

export default function Setup() {
  const q = useApi("setup");
  return (
    <Page title="Setup" sub="Three short steps. About two minutes.">
      <Load q={q} skeleton={<SkelCards n={1} h={380} cols="" />}>
        {(d) => (
          <div className="setup-wrap">
            <Section><Wizard d={d} /></Section>
            <Section i={1}>
              <div className="stack" style={{ gap: 10 }}>
                {[["person", "Private by design", "Your data and sign-ins live in one folder on this laptop. There is no cloud account."], ["eye", "Read only", "The dashboard looks at your tools. It never sends, posts or changes anything in them."], ["sparkle", "Your own AI plan", "Answers come from the Claude Code or Codex plan you already have. No extra key to buy."]].map(([ic, t, s]) => (
                  <div className="flex gap-3 items-start" key={t}><span className="glyph"><Icon name={ic} size={16} /></span><div><div className="row-title">{t}</div><div className="t-foot" style={{ marginTop: 2 }}>{s}</div></div></div>
                ))}
              </div>
            </Section>
          </div>
        )}
      </Load>
    </Page>
  );
}

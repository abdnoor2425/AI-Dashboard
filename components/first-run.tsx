"use client";
// First run: what someone sees the first time they open AI-Dashboard. A short welcome, Google sign-in,
// connecting their tools, a profile, and then their own data loading in. Never sample data.
import React, { useEffect, useRef, useState } from "react";
import { api, useApi } from "@/lib/client";
import { Logo } from "./logos";
import { Icon } from "./ui";
import { BrandMark } from "./brand";

const STEPS = [["signin", "Sign in"], ["connect", "Tools"], ["ai", "Your AI"], ["profile", "Profile"], ["welcome", "Welcome"]] as const;
const Check = ({ size = 14 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const Arrow = () => <span aria-hidden="true" className="fr-arrow">→</span>;
const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
);
const Tile = ({ children, navy }: { children: React.ReactNode; navy?: boolean }) => <span className={"fr-tile" + (navy ? " navy" : "")}>{children}</span>;
const BrainTile = () => <Tile navy><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#E0B663" strokeWidth="1.6"><circle cx="12" cy="12" r="7.5" /><ellipse cx="12" cy="12" rx="3.2" ry="7.5" /><path d="M4.5 12h15" /></g><circle cx="16" cy="8" r="1.3" fill="#F3D493" /><circle cx="8" cy="15" r="1.1" fill="#F3D493" /></svg></Tile>;
const AiTile = () => <Tile navy><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c.6 4.6 1.6 5.6 6.4 6.4C13.6 11.2 12.6 12.2 12 17c-.6-4.8-1.6-5.8-6.4-6.6C10.4 9.6 11.4 8.6 12 4z" fill="#E0B663" /><circle cx="18" cy="17" r="1.6" fill="#E0B663" /></svg></Tile>;
const ToolTile = ({ tool }: { tool: string }) => <span className="fr-logo"><Logo tool={tool} size={48} /></span>;

function Top({ step, skip, dark }: { step?: string; skip?: { label: string; on: () => void }; dark?: boolean }) {
  const at = STEPS.findIndex(([id]) => id === step);
  return (
    <header className={"fr-top" + (dark ? " dark" : "")}>
      <div className="fr-brand"><BrandMark size={36} /><span>AI-Dashboard</span></div>
      {step && (
        <ol className="fr-steps" aria-label="Setup steps">
          {STEPS.map(([id, label], i) => (
            <li key={id} className={i === at ? "on" : i < at ? "done" : ""} aria-current={i === at ? "step" : undefined}>
              <span className="n">{i < at ? <Check size={12} /> : i + 1}</span><span className="lbl">{label}</span>
            </li>
          ))}
        </ol>
      )}
      {skip ? <button className="fr-skip" onClick={skip.on}>{skip.label}</button> : <span className="fr-skip-space" />}
    </header>
  );
}

function Problem() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("problem");
      if (p) { setMsg(p); window.history.replaceState(null, "", window.location.pathname); }
    } catch { /* nothing to show */ }
  }, []);
  if (!msg) return null;
  return <div className="fr-problem" role="alert"><span>{msg}</span><button className="fr-x" onClick={() => setMsg(null)} aria-label="Dismiss"><Icon name="x" size={16} /></button></div>;
}

/* ---------- Welcome and the three cards about the app ---------- */

function Intro({ start, busy }: { start: () => void; busy: boolean }) {
  const [i, setI] = useState(0);
  if (i === 0) {
    return (
      <div className="fr-screen navy">
        <div className="fr-glow" />
        <div className="fr-hello">
          <div className="fr-hello-mark"><BrandMark size={112} /></div>
          <div className="fr-cap light">Welcome to</div>
          <h1 className="fr-serif fr-hero">AI-Dashboard</h1>
          <p className="fr-lede light">Your whole business on one calm page. Your tools, your numbers and your AI, all in one place on your own computer.</p>
          <button className="fr-btn cream lg" onClick={() => setI(1)}>Get started <Arrow /></button>
          <p className="fr-note light">Takes about two minutes</p>
        </div>
      </div>
    );
  }
  const cards = [
    { cap: "What it does", title: "Everything that matters, on one page.", body: "Your emails, tasks, website numbers and social reach come together. It ranks the five things that need you most today.", art: <ArtOnePage /> },
    { cap: "Your AI", title: "Ask anything about your business.", body: "Link the AI you already pay for. Ask what to do next, and it answers from your own numbers. No extra keys or bills.", art: <ArtAi /> },
    { cap: "Private by design", title: "Your data never leaves this computer.", body: "AI-Dashboard runs on your own computer. Your sign-ins and numbers are kept here, and only you can see them.", art: <ArtPrivate /> },
  ];
  const c = cards[i - 1];
  return (
    <div className="fr-screen">
      <div className="fr-sun" />
      <Top skip={{ label: "Skip intro", on: start }} />
      <main className="fr-story" key={i}>
        <div className="fr-story-text">
          <div className="fr-cap">{c.cap}</div>
          <h1 className="fr-serif fr-title">{c.title}</h1>
          <p className="fr-lede">{c.body}</p>
        </div>
        <div className="fr-story-art" aria-hidden="true">{c.art}</div>
      </main>
      <footer className="fr-foot">
        <div className="fr-dots" aria-label={`Card ${i} of 3`}>{[1, 2, 3].map((d) => <i key={d} className={d === i ? "on" : ""} />)}</div>
        <div className="fr-actions">
          <button className="fr-btn ghost" onClick={() => setI(i - 1)}>Back</button>
          <button className="fr-btn primary" disabled={busy} onClick={() => (i < 3 ? setI(i + 1) : start())}>{i < 3 ? "Continue" : "Let’s set it up"} <Arrow /></button>
        </div>
      </footer>
    </div>
  );
}

function ArtOnePage() {
  const rows = [["Reply to the new client about scope", "Gmail · due tomorrow"], ["Approve the launch post", "Linear · today 5 PM"], ["Visitors are up 14% this week", "Google Analytics"]];
  return (
    <div className="fr-art-one">
      <div className="fr-card fr-art-card">
        <div className="fr-cap">Needs your attention</div>
        {rows.map(([t, s], n) => <div className="fr-art-row" key={t}><span className={"fr-rank" + (n === 0 ? " first" : "")}>{n + 1}</span><div><b>{t}</b><span>{s}</span></div></div>)}
        <div className="fr-art-nums">{[["Visitors", "114k"], ["Leads", "3,227"], ["Reach", "283k"]].map(([a, b]) => <div key={a}><div className="fr-cap sm">{a}</div><div className="fr-serif fr-num">{b}</div></div>)}</div>
      </div>
      {[["gmail", "a"], ["analytics", "b"], ["linear", "c"], ["drive", "d"], ["metricool", "e"], ["slack", "f"]].map(([t, pos]) => <span key={t} className={"fr-float " + pos}><Logo tool={t} size={48} /></span>)}
    </div>
  );
}
function ArtAi() {
  return (
    <div className="fr-card fr-art-ai">
      <div className="fr-art-ai-head"><AiTile /><div><b>Ask your AI</b><span>Claude Code · linked</span></div><span className="fr-chip good">● Your own plan</span></div>
      <div className="fr-bubble me">What should I do first today?</div>
      <div className="fr-bubble ai">Reply to the new client first. They asked about scope two days ago and the deadline is tomorrow. After that, approve the launch post so it goes out at 5 PM.</div>
      <div className="fr-chips">{["Claude", "Codex", "ChatGPT", "Any AI you use"].map((x) => <span key={x} className="fr-chip plain">{x}</span>)}</div>
    </div>
  );
}
function ArtPrivate() {
  return (
    <div className="fr-card fr-art-private">
      <div className="fr-art-ai-head"><Tile navy><Icon name="files" size={24} /></Tile><div><b className="fr-serif" style={{ fontSize: 28, fontWeight: 500 }}>This computer</b><span>Where everything is kept</span></div></div>
      {[["Your data stays here", "Nothing is uploaded to us or anyone else."], ["Read only", "It reads your tools. It never changes them."], ["You stay in control", "Disconnect any tool with one click."]].map(([a, b]) => (
        <div className="fr-tick" key={a}><span className="ok"><Check /></span><div><b>{a}</b><span>{b}</span></div></div>
      ))}
    </div>
  );
}

/* ---------- Sign in ---------- */

function SignIn({ go }: { go: (step: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const google = async () => {
    setBusy(true); setProblem("");
    try { const r = await api("firstrun/google", { method: "POST", body: {} }); if (r.redirect) { window.location.href = r.redirect; return; } setProblem(r.needs || "Google sign-in is not available."); }
    catch (e: any) { setProblem(e.message); }
    setBusy(false);
  };
  return (
    <div className="fr-screen">
      <div className="fr-sun" />
      <Top step="signin" />
      <main className="fr-center">
        <div className="fr-card fr-signin">
          <div className="fr-signin-mark"><BrandMark size={72} /></div>
          <h1 className="fr-serif fr-title sm">Sign in to get started</h1>
          <p className="fr-lede sm">Use the Google account you run your business with. We use it for your name and email, and to connect your Google tools in the next step.</p>
          <button className="fr-btn google" onClick={google} disabled={busy} autoFocus>{busy ? <span className="spinner" /> : <GoogleG />} Continue with Google</button>
          {problem && <p className="fr-err" role="alert">{problem}</p>}
          <Problem />
          <div className="fr-or"><span />or<span /></div>
          <button className="fr-link" onClick={() => go("connect")}>Continue without Google</button>
          <p className="fr-fine">Google will show “Google hasn’t verified this app” once.<br />Click <b>Advanced</b>, then <b>Go to AI-Dashboard</b>.</p>
        </div>
      </main>
    </div>
  );
}

/* ---------- Connect your tools ---------- */

function Row({ icon, name, sub, children }: { icon: React.ReactNode; name: string; sub: string; children: React.ReactNode }) {
  return <div className="fr-card fr-tool">{icon}<div className="fr-tool-text"><b>{name}</b><span>{sub}</span></div><div className="fr-tool-act">{children}</div></div>;
}
const Connected = () => <span className="fr-chip good"><Check /> Connected</span>;

function Connect({ boot, go }: { boot: any; go: (step: string) => void }) {
  const q = useApi("connections");
  const brainQ = useApi("brain", { workspaceId: boot.workspace.id });
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const list: any[] = q.data?.connections || [];
  const conn = (id: string) => list.find((c) => c.id === id);
  const sources = brainQ.data?.sources || [];

  const connectGoogle = async (id: string) => {
    setBusy(id); setErr({});
    try { const r = await api("connections/" + id, { method: "POST", body: { action: "connect" } }); if (r?.redirect) { window.location.href = r.redirect; return; } if (r?.needs) setErr({ [id]: r.needs }); }
    catch (e: any) { setErr({ [id]: e.message }); }
    setBusy(null);
  };
  const connectToken = async (id: string) => {
    setBusy(id); setErr({});
    try {
      const r = await api("connections/" + id, { method: "POST", body: { action: "connect", token: form[id + ".token"], userId: form[id + ".user"] } });
      if (r?.needs) setErr({ [id]: r.needs }); else setOpen(null);
    } catch (e: any) { setErr({ [id]: e.message }); }
    setBusy(null);
  };
  const addBrain = async () => {
    setBusy("brain"); setErr({});
    try { await api("brain", { method: "POST", body: { workspaceId: boot.workspace.id, action: "connect", path: form.brain || "", kind: "workos" } }); setOpen(null); brainQ.reload(); }
    catch (e: any) { setErr({ brain: e.message }); }
    setBusy(null);
  };

  const googleRow = (id: string, sub: string) => {
    const c = conn(id); if (!c) return null;
    return (
      <Row key={id} icon={<ToolTile tool={c.tool} />} name={c.name} sub={err[id] || sub}>
        {c.status === "connected" ? <Connected /> : <button className="fr-btn primary sm" disabled={busy === id} onClick={() => connectGoogle(id)}>{c.status === "error" ? "Sign in again" : "Connect"}</button>}
      </Row>
    );
  };
  const tokenRow = (id: string, sub: string, help: string) => {
    const c = conn(id); if (!c) return null;
    const on = c.status === "connected";
    return (
      <div key={id} className={"fr-tool-wrap" + (open === id ? " open" : "")}>
        <Row icon={<ToolTile tool={c.tool} />} name={c.name} sub={sub}>
          {on ? <Connected /> : <button className="fr-btn ghost sm" onClick={() => setOpen(open === id ? null : id)} aria-expanded={open === id}>{open === id ? "Cancel" : "Connect"}</button>}
        </Row>
        {open === id && !on && (
          <div className="fr-card fr-form">
            {id === "metricool" && <label><span>User ID</span><input id="fr-metricool-user" className="fr-input" inputMode="numeric" autoComplete="off" value={form[id + ".user"] || ""} onChange={(e) => setForm({ ...form, [id + ".user"]: e.target.value })} /></label>}
            <label><span>{id === "linear" ? "Personal API key" : "API token"}</span><input id={"fr-" + id + "-token"} className="fr-input" type="password" autoComplete="off" value={form[id + ".token"] || ""} onChange={(e) => setForm({ ...form, [id + ".token"]: e.target.value })} /></label>
            <div className="fr-form-foot"><span>{err[id] || help}</span><button className="fr-btn primary sm" disabled={busy === id || !form[id + ".token"]} onClick={() => connectToken(id)}>{busy === id ? "Checking…" : "Connect"}</button></div>
          </div>
        )}
      </div>
    );
  };
  const count = ["google-analytics", "gmail", "drive", "calendar", "linear", "metricool"].filter((id) => conn(id)?.status === "connected").length + (sources.length ? 1 : 0);

  return (
    <div className="fr-screen scroll">
      <div className="fr-sun" />
      <Top step="connect" skip={{ label: "Do this later", on: () => go("ai") }} />
      <main className="fr-wide">
        <div className="fr-head">
          <div>
            <div className="fr-cap">{boot.firstRun?.email ? `Signed in as ${boot.firstRun.email}` : "Your tools"}</div>
            <h1 className="fr-serif fr-title md">Connect your tools</h1>
            <p className="fr-lede sm">Click Connect on each one you use. Each asks for read-only access, and you can add more later.</p>
          </div>
          <div className="fr-count"><span className="fr-serif">{count} <small>of 7</small></span><span className="fr-cap sm">connected</span></div>
        </div>
        <Problem />
        <div className="fr-cap fr-group">Google</div>
        <div className="fr-grid">
          {googleRow("google-analytics", "Your websites, visitors and leads")}
          {googleRow("gmail", "Emails that need a reply")}
          {googleRow("drive", "Recent files and documents")}
          {googleRow("calendar", "Meetings this week")}
        </div>
        <div className="fr-cap fr-group">Your other tools</div>
        <div className="fr-grid">
          {tokenRow("linear", "Tasks and approvals", "In Linear: Settings, Security & access, Personal API keys.")}
          {tokenRow("metricool", "Social reach for each brand", "Needs Metricool's Advanced plan. Find both under Account settings, API.")}
          <div className={"fr-tool-wrap" + (open === "brain" ? " open" : "")}>
            <Row icon={<BrainTile />} name="Second Brain" sub={sources.length ? `${sources.length} folder${sources.length > 1 ? "s" : ""} added` : "Your WorkOS and project folders"}>
              {sources.length ? <Connected /> : <button className="fr-btn ghost sm" onClick={() => setOpen(open === "brain" ? null : "brain")} aria-expanded={open === "brain"}>{open === "brain" ? "Cancel" : "Connect"}</button>}
            </Row>
            {open === "brain" && !sources.length && (
              <div className="fr-card fr-form">
                <label><span>Your WorkOS folder</span><input id="fr-brain-path" className="fr-input" placeholder={navigatorPath()} autoComplete="off" value={form.brain || ""} onChange={(e) => setForm({ ...form, brain: e.target.value })} /></label>
                <div className="fr-form-foot"><span>{err.brain || "Paste the full path. Each folder inside it becomes a project. Read only."}</span><button className="fr-btn primary sm" disabled={busy === "brain" || !form.brain} onClick={addBrain}>{busy === "brain" ? "Reading…" : "Add"}</button></div>
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="fr-foot">
        <button className="fr-btn ghost" onClick={() => go("signin")}>Back</button>
        <button className="fr-btn primary" onClick={() => go("ai")}>Continue <Arrow /></button>
      </footer>
    </div>
  );
}
function navigatorPath() {
  try { return /Win/i.test(navigator.platform) ? "C:\\Users\\you\\Documents\\WorkOS" : "/Users/you/Documents/WorkOS"; } catch { return "/Users/you/Documents/WorkOS"; }
}

/* ---------- Connect your AI ---------- */

// Simple marks for each AI. They name the app; they are not the companies' own logos.
export function AiMark({ id }: { id: string }) {
  const tile = (bg: string, child: React.ReactNode, fg = "#fff") => <span className="fr-tile fr-aimark" style={{ background: bg, color: fg }}>{child}</span>;
  const rays = <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">{[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5].map((a) => <path key={a} d="M12 4.2v15.6" transform={`rotate(${a} 12 12)`} />)}</g></svg>;
  if (id === "claude-code") return tile("#C8643F", rays);
  if (id === "claude-app") return tile("#F4E9DC", rays, "#C8643F");
  if (id === "codex") return tile("#111", <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7l5 5-5 5M12.5 17H19" /></svg>);
  if (id === "gemini") return tile("#EEF2FD", <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="fr-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4C8DF6" /><stop offset="1" stopColor="#9B72E8" /></linearGradient></defs><path d="M12 2.5c.9 5.2 4.3 8.6 9.5 9.5-5.2.9-8.6 4.3-9.5 9.5-.9-5.2-4.3-8.6-9.5-9.5 5.2-.9 8.6-4.3 9.5-9.5z" fill="url(#fr-gem)" /></svg>);
  if (id === "cursor") return tile("#1A1A1A", <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5l12.5 7.2-5.6 1.5-2.7 5.3z" fill="currentColor" /></svg>);
  if (id === "chatgpt") return tile("#F1F1EF", <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 6.5a2 2 0 012-2h11a2 2 0 012 2v8a2 2 0 01-2 2H11l-4.5 3.5v-3.5a2 2 0 01-2-2z" /></svg>, "#111");
  return tile("#F1F1EF", <span style={{ fontWeight: 700, fontSize: 17 }}>{(id[0] || "?").toUpperCase()}</span>, "#111");
}

function AiStep({ go }: { go: (step: string) => void }) {
  const q = useApi("ai/agents");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [question, setQuestion] = useState("What can you see on my dashboard?");
  const [answer, setAnswer] = useState<{ text: string; by: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const agents: any[] = q.data?.agents || [];
  const found = agents.filter((a) => a.installed && a.kind !== "cloud");
  const missing = agents.filter((a) => !a.installed && a.kind !== "cloud");
  const cloud = agents.filter((a) => a.kind === "cloud");
  const answerers = found.filter((a) => a.answers && a.connected);
  const answerWith = q.data?.answerWith || answerers[0]?.id || null;
  const connect = async (id: string) => {
    setBusy(id); setErr({});
    try { await api("ai/agents/" + id, { method: "POST", body: { action: "connect" } }); q.reload(); }
    catch (e: any) { setErr({ [id]: e.message }); }
    setBusy(null);
  };
  const pick = async (id: string) => { try { await api("ai/answer", { method: "POST", body: { id } }); q.reload(); setAnswer(null); } catch (e: any) { setErr({ panel: e.message }); } };
  const ask = async () => {
    setAsking(true); setAnswer(null);
    try { const r = await api("ai/ask", { method: "POST", body: { question } }); setAnswer({ text: r.answer, by: r.provider && r.provider !== "rules" ? r.provider : "" }); }
    catch (e: any) { setAnswer({ text: e.message, by: "" }); }
    setAsking(false);
  };
  const connectedCount = found.filter((a) => a.connected).length;
  const row = (a: any) => (
    <Row key={a.id} icon={<AiMark id={a.id} />} name={a.name} sub={err[a.id] || a.sub}>
      {a.kind === "cloud" ? <span className="fr-chip plain">Not yet</span>
        : !a.installed ? <a className="fr-btn ghost sm" href={a.getUrl} target="_blank" rel="noreferrer">Get it <span aria-hidden="true">↗</span></a>
        : a.connected ? <Connected />
        : <button className="fr-btn primary sm" disabled={busy === a.id} onClick={() => connect(a.id)}>{busy === a.id ? "Connecting…" : "Connect"}</button>}
    </Row>
  );
  const chosen = found.find((a) => a.id === answerWith);
  return (
    <div className="fr-screen scroll">
      <div className="fr-sun" />
      <Top step="ai" skip={{ label: "Do this later", on: () => go("profile") }} />
      <main className="fr-wide">
        <div className="fr-head">
          <div>
            <div className="fr-cap">Your AI</div>
            <h1 className="fr-serif fr-title md">Connect your AI</h1>
            <p className="fr-lede sm">Ask about your business in plain words, like “What needs me today?”. Answers come from the AI plan you already pay for. No API keys and nothing extra to buy.</p>
          </div>
          {found.length > 0 && <div className="fr-count"><span className="fr-serif">{connectedCount} <small>of {found.length}</small></span><span className="fr-cap sm">connected</span></div>}
        </div>
        <div className="fr-ai">
          <div className="fr-ai-list">
            {!q.data && <div className="fr-card fr-tool fr-ai-wait"><span className="fr-spin dark" /> Looking for AI apps on this computer…</div>}
            {found.length > 0 && <><div className="fr-cap fr-group first">Found on this computer</div><div className="fr-stack">{found.map(row)}</div></>}
            {missing.length > 0 && <><div className={"fr-cap fr-group" + (found.length ? "" : " first")}>Not on this computer</div><div className="fr-stack">{missing.map(row)}</div></>}
            {cloud.length > 0 && <><div className="fr-cap fr-group">Not possible yet</div><div className="fr-stack muted">{cloud.map(row)}</div><p className="fr-note">ChatGPT and Grok run in the cloud, so they can’t reach a dashboard that lives on your computer yet. We’ll add them when they can.</p></>}
          </div>
          <aside className="fr-ai-panel">
            <div className="fr-cap light">Answers in your dashboard</div>
            {answerers.length ? (
              <>
                <p className="fr-ai-p">Pick the AI that writes answers inside AI-Dashboard. The others still work from their own app.</p>
                <div className="fr-ai-pick" role="radiogroup" aria-label="Answers come from">
                  {answerers.map((a) => <button key={a.id} role="radio" aria-checked={answerWith === a.id} className={answerWith === a.id ? "on" : ""} onClick={() => pick(a.id)}><AiMark id={a.id} /><span>{a.name}</span>{answerWith === a.id && <Check />}</button>)}
                </div>
                <div className="fr-ai-try">
                  <div className="fr-cap light">Try it</div>
                  <form className="fr-ai-ask" onSubmit={(e) => { e.preventDefault(); ask(); }}>
                    <input aria-label="Ask a question" value={question} onChange={(e) => setQuestion(e.target.value)} />
                    <button className="fr-btn cream sm" disabled={asking || question.trim().length < 3}>{asking ? <span className="fr-spin" /> : "Ask"}</button>
                  </form>
                  {asking && <div className="fr-ai-answer wait"><span className="fr-dots"><i /><i /><i /></span> {chosen?.name || "Your AI"} is reading your dashboard…</div>}
                  {answer && <div className="fr-ai-answer"><p>{answer.text}</p>{answer.by && <span>Answered by your {answer.by} plan</span>}</div>}
                </div>
              </>
            ) : (
              <div className="fr-ai-empty">
                <p className="fr-ai-p">{found.length ? "Connect Claude Code, Codex or Gemini CLI and it answers your questions right here." : "No AI app was found on this computer yet."}</p>
                <p className="fr-ai-p dim">The dashboard still works without one. Until you add one, answers come from simple built-in rules.</p>
              </div>
            )}
            <div className="fr-ai-safe"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg><span>Your AI can only read the dashboard. It can’t send, change or delete anything.</span></div>
          </aside>
        </div>
      </main>
      <footer className="fr-foot">
        <button className="fr-btn ghost" onClick={() => go("connect")}>Back</button>
        <button className="fr-btn primary" onClick={() => go("profile")}>Continue <Arrow /></button>
      </footer>
    </div>
  );
}

/* ---------- Profile ---------- */

function Profile({ boot, go, reloadBoot }: { boot: any; go: (step: string) => void; reloadBoot: () => void }) {
  const fr = boot.firstRun || {};
  const [name, setName] = useState(fr.name || "");
  const [role, setRole] = useState("");
  const [business, setBusiness] = useState("");
  const [theme, setTheme] = useState(boot.theme || "system");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Websites arrive from Google Analytics in the background, so look again every few seconds.
  useEffect(() => { const t = setInterval(reloadBoot, 4000); return () => clearInterval(t); }, []);
  const save = async () => {
    setBusy(true); setErr("");
    try { await api("firstrun/profile", { method: "POST", body: { name, role, business, theme } }); reloadBoot(); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  };
  const ga = boot.sites || [];
  return (
    <div className="fr-screen scroll">
      <div className="fr-sun" />
      <Top step="profile" />
      <main className="fr-center">
        <div className="fr-card fr-profile">
          <div className="fr-avatar-col">
            {fr.picture ? <img className="fr-avatar" src={fr.picture} alt="" referrerPolicy="no-referrer" /> : <div className="fr-avatar fr-serif">{(name || "?").trim().charAt(0).toUpperCase() || "?"}</div>}
            <div className="fr-avatar-note">{fr.picture ? "From your Google account" : "Your initial"}</div>
          </div>
          <form className="fr-profile-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <h1 className="fr-serif fr-title sm">Tell us about you</h1>
            <p className="fr-lede sm">This is how the dashboard greets you and names your work.</p>
            <div className="fr-fields">
              <label><span>Your name</span><input id="fr-name" className="fr-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus /></label>
              <label><span>Your role</span><input id="fr-role" className="fr-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Founder" /></label>
              <label className="wide"><span>Business name</span><input id="fr-business" className="fr-input" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Your company" autoComplete="organization" /></label>
            </div>
            <div className="fr-label">Your websites <small>· found in Google Analytics</small></div>
            <div className="fr-sites">{ga.length ? ga.map((s: any) => <span key={s.id} className="fr-site"><span className="ok"><Check /></span>{s.name}</span>) : <span className="fr-empty">Connect Google Analytics and your websites appear here by themselves.</span>}</div>
            <div className="fr-label">Look</div>
            <div className="fr-seg" role="radiogroup" aria-label="Look">
              {[["system", "Follows the time of day"], ["light", "Light"], ["dark", "Dark"]].map(([id, label]) => <button type="button" key={id} role="radio" aria-checked={theme === id} className={theme === id ? "on" : ""} onClick={() => setTheme(id)}>{label}</button>)}
            </div>
            {err && <p className="fr-err" role="alert">{err}</p>}
            <button type="submit" hidden />
          </form>
        </div>
      </main>
      <footer className="fr-foot">
        <button className="fr-btn ghost" onClick={() => go("ai")}>Back</button>
        <button className="fr-btn primary" disabled={busy || !name.trim() || business.trim().length < 2} onClick={save}>Continue <Arrow /></button>
      </footer>
    </div>
  );
}

/* ---------- Welcome: their own data loads in ---------- */

function Welcome({ boot }: { boot: any }) {
  const q = useApi("connections");
  const aiQ = useApi("ai/status");
  const brainQ = useApi("brain", { workspaceId: boot.workspace.id });
  const started = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { api("sync", { method: "POST", body: {} }).catch(() => {}); }, []);
  useEffect(() => { const t = setInterval(() => { q.reload(); setNow(Date.now()); }, 1500); return () => clearInterval(t); }, []);
  const tools: any[] = (q.data?.connections || []).filter((c: any) => c.status === "connected" || c.status === "error");
  const rows = tools.map((c) => ({ key: c.id, icon: <ToolTile tool={c.tool} />, name: c.name, state: c.status === "error" ? "bad" : c.lastSync ? "done" : "run", sub: c.status === "error" ? "Needs attention. Fix it later on Connections" : c.lastSync ? c.detail : "Bringing in your data" }));
  const sources = brainQ.data?.sources || [];
  if (sources.length) rows.push({ key: "brain", icon: <BrainTile />, name: "Second Brain", state: "done", sub: `${brainQ.data.projects?.length || 0} projects mapped` });
  if (aiQ.data) rows.push({ key: "ai", icon: <AiTile />, name: "Your AI", state: "done", sub: aiQ.data.available ? `${aiQ.data.provider} is ready for questions` : "Add Claude Code or Codex any time" });
  const ready = rows.filter((r) => r.state !== "run").length;
  const elapsed = now - started.current;
  const finished = !!q.data && (!rows.some((r) => r.state === "run") || elapsed > 60000) && elapsed > 2500;
  const pct = rows.length ? Math.round((ready / rows.length) * 100) : finished ? 100 : 30;
  const open = async () => { if (leaving) return; setLeaving(true); try { await api("firstrun/finish", { method: "POST", body: {} }); } catch { /* opens anyway */ } window.location.href = "/"; };
  useEffect(() => { if (finished) { const t = setTimeout(open, 1600); return () => clearTimeout(t); } }, [finished]);
  const first = (boot.workspace.owner || "").split(" ")[0];
  return (
    <div className="fr-screen navy scroll">
      <div className="fr-glow" />
      <Top step="welcome" dark />
      <main className="fr-welcome">
        <div className="fr-welcome-text">
          <div className="fr-cap light">You’re all set</div>
          <h1 className="fr-serif fr-hero md">Welcome{first && first !== "You" ? `, ${first}` : ""}.</h1>
          <p className="fr-lede light">{finished ? "Your dashboard is ready. Opening it now." : "We’re bringing in your numbers for the first time. This takes about a minute, and your dashboard opens by itself when it’s ready."}</p>
          <div className="fr-progress" role="progressbar" aria-valuenow={finished ? 100 : pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: (finished ? 100 : pct) + "%" }} /></div>
          <div className="fr-progress-txt"><span>{rows.length ? `${ready} of ${rows.length} ready` : "Getting things ready"}</span>{finished && <button className="fr-btn cream sm" onClick={open} disabled={leaving}>Open your dashboard <Arrow /></button>}</div>
        </div>
        <div className="fr-load" aria-live="polite">
          <div className="fr-cap light">Bringing in your data</div>
          {rows.map((r) => (
            <div className="fr-load-row" key={r.key}>
              <span className="fr-load-icon">{r.icon}</span>
              <div className="fr-load-text"><b>{r.name}</b><span>{r.sub}</span></div>
              {r.state === "done" ? <span className="fr-ok"><Check /></span> : r.state === "bad" ? <span className="fr-bad">!</span> : <span className="fr-spin" />}
            </div>
          ))}
          {!rows.length && <p className="fr-load-empty">No tools connected yet. You can add them any time from Connections.</p>}
        </div>
      </main>
    </div>
  );
}

/* ---------- The flow ---------- */

export function FirstRun({ boot, reloadBoot }: { boot: any; reloadBoot: () => void }) {
  const step = boot.firstRun?.step || "intro";
  const [busy, setBusy] = useState(false);
  const go = async (to: string) => { try { await api("firstrun/step", { method: "POST", body: { step: to } }); } finally { reloadBoot(); } };
  const start = async () => { setBusy(true); try { await api("firstrun/start", { method: "POST", body: {} }); reloadBoot(); } finally { setBusy(false); } };
  useEffect(() => { window.scrollTo(0, 0); }, [step]);
  return (
    <div className="fr">
      {step === "intro" && <Intro start={start} busy={busy} />}
      {step === "signin" && <SignIn go={go} />}
      {step === "connect" && <Connect boot={boot} go={go} />}
      {step === "ai" && <AiStep go={go} />}
      {step === "profile" && <Profile boot={boot} go={go} reloadBoot={reloadBoot} />}
      {step === "welcome" && <Welcome boot={boot} />}
    </div>
  );
}

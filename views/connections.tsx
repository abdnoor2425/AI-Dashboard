"use client";
import React, { useEffect, useRef, useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { ago } from "@/lib/format";
import { Empty, Icon, Load, Mark, Page, SampleTag, Section, SkelCards, SkelRows } from "@/components/ui";
import { Logo } from "@/components/logos";

const LABEL: Record<string, { text: string; tone: string }> = {
  connected: { text: "Connected", tone: "good" }, manual: { text: "Manual", tone: "warn" },
  error: { text: "Needs attention", tone: "bad" }, off: { text: "Not connected", tone: "" }, soon: { text: "Coming later", tone: "" },
};
const HOW: Record<string, string> = {
  google: "Sign in with Google. The dashboard asks for read-only access and keeps the sign-in on this laptop.",
  oauth: "Sign in on the tool's own page. The dashboard asks for read-only access.",
  token: "Paste the access token from the tool's settings. It is saved on this laptop only and never leaves it.",
  file: "Upload or point to the file. Nothing is sent anywhere.",
  soon: "This tool is planned but not built yet, so it is shown honestly as not available.",
};

export function CopyLine({ text, label }: { text: string; label: string }) {
  const app = useApp();
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); app.toast("Copied"); }
    catch { app.toast("Select the text and copy it by hand"); }
  };
  return (
    <div className="codeline">
      <code>{text}</code>
      <button className="icon-btn sm" onClick={copy} aria-label={"Copy " + label}><Icon name="copy" size={16} /></button>
    </div>
  );
}

/** Everything about one tool, shown in the detail card: what it gives, how it connects, and the connect form. */
function ToolDetail({ id, close }: { id: string; close: () => void }) {
  const app = useApp();
  const q = useApi("connections");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(""); const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState(""); const [clientSecret, setClientSecret] = useState("");
  const c = q.data?.connections.find((x: any) => x.id === id);
  if (!c) return <SkelRows n={3} />;
  const google = q.data.google;
  const soon = c.auth === "soon";
  const s = soon ? LABEL.soon : LABEL[c.status] || LABEL.off;
  const needsKeys = c.auth === "google" && google && !google.ready && c.status === "off";
  const needsToken = c.auth === "token" && c.status !== "connected";
  const act = async (action: "connect" | "disconnect") => {
    setBusy(true);
    try {
      const r = await api("connections/" + c.id, { method: "POST", body: { action, token: token || undefined, userId: userId || undefined, clientId: clientId || undefined, clientSecret: clientSecret || undefined } });
      if (r?.redirect) { window.location.href = r.redirect; return; }
      if (r?.needs) { app.toast(r.needs); return; }
      app.toast(action === "connect" ? `${c.name} connected` : `${c.name} disconnected`); setToken("");
      if (action === "disconnect") close();
    } catch (e: any) { app.toast(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="inset flex items-center gap-4" style={{ padding: 18 }}>
        <Logo tool={c.tool} size={56} />
        <div style={{ minWidth: 0, flex: 1 }}><span className={"chip " + s.tone}>{s.text}</span><p className="muted" style={{ marginTop: 6 }}>{c.status === "off" || soon ? c.gives : c.detail}{c.lastSync ? `, checked ${ago(c.lastSync)}` : ""}</p></div>
      </div>
      <dl className="facts inset" style={{ padding: 18 }}>
        <div><dt>Gives you</dt><dd>{c.gives}</dd></div>
        <div><dt>Account</dt><dd>{c.account || "None yet"}</dd></div>
        <div><dt>Access</dt><dd>Read only</dd></div>
        <div><dt>How it connects</dt><dd>{HOW[c.auth] || HOW.oauth}</dd></div>
      </dl>
      {needsKeys && (
        <div className="inset stack" style={{ gap: 12, padding: 18 }}>
          <p className="t-foot">One-time step: create a free "OAuth client" in your own Google Cloud account and add this return address to it. The README walks through it in two minutes.</p>
          <CopyLine label="return address" text={google.redirectUri} />
          <label><span className="t-cap">Google client ID</span><input className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" /></label>
          <label><span className="t-cap">Client secret</span><input className="input" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" /></label>
          <button className="btn primary lg" disabled={busy || !clientId || !clientSecret} onClick={() => act("connect")}>Sign in with Google</button>
          <p className="t-foot faint">One Google sign-in connects Analytics, Gmail and Drive together, all read only.</p>
        </div>
      )}
      {needsToken && (
        <div className="inset stack" style={{ gap: 12, padding: 18 }}>
          {c.id === "metricool" && <label><span className="t-cap">User ID</span><input className="input" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="1234567" inputMode="numeric" autoComplete="off" /></label>}
          <label><span className="t-cap">Access token</span><input className="input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token" autoComplete="off" /></label>
          <button className="btn primary lg" disabled={busy || (!app.boot.workspace.sample && !token)} onClick={() => act("connect")}>Connect {c.name}</button>
          {c.id === "metricool" && <p className="t-foot faint">Metricool only allows this on its Advanced or Custom plan. The token is under Account settings, API, in Metricool.</p>}
        </div>
      )}
      {c.status === "off" && !soon && !needsKeys && !needsToken && <button className="btn primary lg" disabled={busy} onClick={() => act("connect")}>Connect {c.name}</button>}
      {c.status === "error" && !needsToken && <button className="btn primary lg" disabled={busy} onClick={() => act("connect")}>Sign in again</button>}
      {soon && <p className="t-foot">This tool is planned. It will appear here as soon as it is built, and nothing is pretended in the meantime.</p>}
      {c.status !== "off" && !soon && <div><button className="btn sm danger" disabled={busy} onClick={() => act("disconnect")}>Disconnect {c.name}</button></div>}
    </div>
  );
}

function ToolCard({ c, i }: { c: any; i: number }) {
  const app = useApp();
  const ref = useRef<HTMLButtonElement>(null);
  const soon = c.auth === "soon";
  const s = soon ? LABEL.soon : LABEL[c.status] || LABEL.off;
  return (
    <button ref={ref} className={"card tap tool-card rise" + (c.status === "off" || soon ? " is-off" : "")} style={{ ["--i" as any]: i }} onClick={() => app.openCard({ title: c.name, chip: "Connection", render: (close) => <ToolDetail id={c.id} close={close} /> }, ref.current)} aria-label={`${c.name}: ${s.text}. Open details`}>
      <div className="flex items-start justify-between gap-2"><Logo tool={c.tool} size={48} /><span className={"chip " + s.tone}>{s.tone && <span className={"dot " + s.tone} style={{ width: 6, height: 6 }} />}{s.text}</span></div>
      <div className="tool-name">{c.name}</div>
      <div className="t-foot tool-sub">{c.status === "error" ? c.detail : c.gives}</div>
      <div className="tool-foot"><span className="t-cap">{c.status === "connected" && c.lastSync ? "Checked " + ago(c.lastSync) : soon ? "Not built yet" : c.status === "error" ? "Needs you" : c.status === "off" ? "Read only" : c.account || ""}</span><span className="tool-go">{c.status === "off" && !soon ? "Connect" : "Details"}<Icon name="chevron" size={14} stroke={2.2} /></span></div>
    </button>
  );
}

function AiCard() {
  const q = useApi("ai/status");
  const d = q.data;
  const path = d?.mcpPath || "/path/to/keystone/mcp/server.mjs";
  return (
    <div className="card pad ai-card">
      <div className="flex items-start gap-3">
        <span className="tint" style={{ width: 48, height: 48, borderRadius: 15 }}><Icon name="sparkle" size={22} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="flex items-center gap-2 flex-wrap"><h3 className="t-head">Your AI plan</h3>{d && <span className={"chip " + (d.available ? "good" : "")}>{d.available ? `${d.provider} linked` : "Not linked"}</span>}</div>
          <p className="muted" style={{ marginTop: 4, maxWidth: "62ch" }}>The dashboard never asks for a paid API key. Link the Claude Code or Codex plan you already pay for, then ask it anything about this dashboard, in the app or in your own terminal.</p>
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="stack" style={{ gap: 8 }}><div className="t-cap">Claude Code</div><CopyLine label="Claude Code command" text={`claude mcp add keystone -- node ${path}`} /></div>
        <div className="stack" style={{ gap: 8 }}><div className="t-cap">Codex</div><CopyLine label="Codex command" text={`codex mcp add keystone -- node ${path}`} /></div>
      </div>
      <p className="t-foot faint" style={{ marginTop: 12 }}>Run one line once, in the terminal on this laptop. After that, try asking: "What needs my attention today?" {d?.note ? d.note : ""}</p>
    </div>
  );
}

export default function Connections() {
  const app = useApp();
  const q = useApi("connections");
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("problem")) app.toast(p.get("problem") as string);
      if (p.get("connected")) app.toast("Google connected. Your websites are being fetched.");
      if (p.get("problem") || p.get("connected")) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    } catch { /* nothing to show */ }
  }, []);
  const confirm = async (b: any) => { try { await api("connections/brands", { method: "POST", body: { siteId: b.siteId, confirmed: true } }); app.toast(`${b.site} matched`); } catch (e: any) { app.toast(e.message); } };
  return (
    <Page title="Connections" sub="Each person connects their own tools. Everything stays on this laptop, and every connection is read only." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <div className="stack">
        <Section><AiCard /></Section>
        <Load q={q} skeleton={<SkelCards n={6} h={190} cols="tool-grid" />}>
          {(d) => {
            // Calendar is hidden unless its page is switched on in Settings.
            const shown = d.connections.filter((c: any) => c.id !== "calendar" || app.boot.workspace.modules.calendar === true);
            const order = (c: any) => (c.status === "error" ? 0 : c.status === "connected" || c.status === "manual" ? 1 : c.auth === "soon" ? 3 : 2);
            const tools = [...shown].sort((x: any, y: any) => order(x) - order(y));
            const waiting = d.brands.filter((b: any) => !b.confirmed);
            return (
              <div className="stack" style={{ gap: 36 }}>
                <Section title="Your tools" i={1} action={<span className="t-foot on-sky">{shown.filter((c: any) => c.status === "connected").length} of {shown.length} connected</span>}>
                  <div className="tool-grid">{tools.map((c: any, i: number) => <ToolCard key={c.id} c={c} i={i + 1} />)}</div>
                </Section>
                <Section title="Websites and their social brands" i={3} action={<span className="t-foot faint">{!d.brands.length ? "" : waiting.length ? `${waiting.length} to confirm` : "All matched"}</span>}>
                  <div className="card group">
                    {!d.brands.length && <Empty art="connect" title="No websites yet"><p>Connect Google Analytics and your websites appear here by themselves.</p></Empty>}
                    {d.brands.map((b: any) => (
                      <div className="row" key={b.siteId}>
                        <Mark name={b.site} color={b.color} />
                        <span className="row-main"><span className="row-title" style={{ display: "block" }}>{b.site}</span><span className="row-sub">{b.domain} · from Google Analytics</span></span>
                        <span className="match"><Icon name="chevron" size={14} /><span>{b.name || "No brand found"}</span></span>
                        {b.confirmed ? <span className="chip good">Matched</span> : <button className="btn tinted sm" onClick={() => confirm(b)}>{b.matched ? "Confirm match" : "Use this brand"}</button>}
                      </div>
                    ))}
                  </div>
                  <p className="t-foot faint" style={{ padding: "10px 6px 0" }}>Websites come from Google Analytics. Each one is matched to a Metricool brand by name. Social numbers stay hidden for a website until you confirm its match, so nothing is ever shown under the wrong brand.</p>
                </Section>
              </div>
            );
          }}
        </Load>
      </div>
    </Page>
  );
}

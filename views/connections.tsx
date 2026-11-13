"use client";
import React, { useEffect, useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { ago } from "@/lib/format";
import { Empty, Fold, Icon, Load, Mark, Page, SampleTag, Section, SkelRows } from "@/components/ui";

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

function ToolRow({ c, google }: { c: any; google?: { ready: boolean; redirectUri: string } }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(""); const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState(""); const [clientSecret, setClientSecret] = useState("");
  const soon = c.auth === "soon";
  const s = soon ? LABEL.soon : LABEL[c.status] || LABEL.off;
  const needsKeys = c.auth === "google" && google && !google.ready && c.status === "off";
  const act = async (action: "connect" | "disconnect") => {
    setBusy(true);
    try {
      const r = await api("connections/" + c.id, { method: "POST", body: { action, token: token || undefined, userId: userId || undefined, clientId: clientId || undefined, clientSecret: clientSecret || undefined } });
      if (r?.redirect) { window.location.href = r.redirect; return; }
      if (r?.needs) { app.toast(r.needs); setOpen(true); return; }
      app.toast(action === "connect" ? `${c.name} connected` : `${c.name} disconnected`); setToken(""); setOpen(false);
    } catch (e: any) { app.toast(e.message); } finally { setBusy(false); }
  };
  const needsToken = c.auth === "token" && c.status !== "connected";
  const reconnect = c.status === "error" && !needsToken;
  return (
    <div>
      <div className="row">
        <span className="glyph"><Icon name={c.tool} size={17} /></span>
        <span className="row-main">
          <span className="row-title" style={{ display: "block" }}>{c.name}</span>
          <span className="row-sub">{c.status === "off" ? c.gives : c.detail}{c.lastSync ? ` · checked ${ago(c.lastSync)}` : ""}</span>
        </span>
        <span className={"chip " + s.tone}>{s.text}</span>
        {reconnect && <button className="btn tinted sm" disabled={busy} onClick={() => act("connect")}>Sign in again</button>}
        {c.status === "off" && !soon && (needsToken || needsKeys ? <button className="btn tinted sm" onClick={() => setOpen(true)}>Connect</button> : <button className="btn tinted sm" disabled={busy} onClick={() => act("connect")}>Connect</button>)}
        <button className="icon-btn sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Details for ${c.name}`}><Icon name="chevron" size={16} className={"caret" + (open ? " open" : "")} /></button>
      </div>
      <Fold open={open}>
        <div className="row-detail stack" style={{ gap: 12 }}>
          <dl className="facts">
            <div><dt>Gives you</dt><dd>{c.gives}</dd></div>
            <div><dt>Account</dt><dd>{c.account || "None yet"}</dd></div>
            <div><dt>Access</dt><dd>Read only</dd></div>
            <div><dt>How it connects</dt><dd>{HOW[c.auth] || HOW.oauth}</dd></div>
          </dl>
          {needsKeys && (
            <div className="stack" style={{ gap: 10 }}>
              <p className="t-foot">One-time step: create a free "OAuth client" in your own Google Cloud account and add this return address to it. The README walks through it in two minutes.</p>
              <CopyLine label="return address" text={google!.redirectUri} />
              <div className="flex gap-2 flex-wrap items-end">
                <label style={{ flex: "1 1 240px" }}><span className="t-cap">Google client ID</span><input className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" /></label>
                <label style={{ flex: "1 1 200px" }}><span className="t-cap">Client secret</span><input className="input" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="off" /></label>
                <button className="btn primary" disabled={busy || !clientId || !clientSecret} onClick={() => act("connect")}>Sign in with Google</button>
              </div>
              <p className="t-foot faint">One Google sign-in connects Analytics, Calendar, Gmail and Drive together, all read only.</p>
            </div>
          )}
          {needsToken && (
            <div className="flex gap-2 flex-wrap items-end">
              {c.id === "metricool" && <label style={{ flex: "0 1 150px" }}><span className="t-cap">User ID</span><input className="input" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="1234567" inputMode="numeric" autoComplete="off" /></label>}
              <label style={{ flex: "1 1 240px" }}><span className="t-cap">Access token</span><input className="input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token" autoComplete="off" /></label>
              <button className="btn primary" disabled={busy || (!app.boot.workspace.sample && !token)} onClick={() => act("connect")}>Connect</button>
            </div>
          )}
          {c.id === "metricool" && <p className="t-foot faint">Metricool only allows this on its Advanced or Custom plan. The token is under Account settings, API, in Metricool.</p>}
          {c.status !== "off" && !soon && <div><button className="btn sm danger" disabled={busy} onClick={() => act("disconnect")}>Disconnect {c.name}</button></div>}
        </div>
      </Fold>
    </div>
  );
}

function AiCard() {
  const q = useApi("ai/status");
  const d = q.data;
  const path = d?.mcpPath || "/path/to/keystone/mcp/server.mjs";
  return (
    <div className="card pad ai-card">
      <div className="flex items-start gap-3">
        <span className="glyph accent lg"><Icon name="sparkle" size={20} /></span>
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
        <Load q={q} skeleton={<SkelRows n={7} />}>
          {(d) => {
            const live = d.connections.filter((c: any) => c.status !== "off"), off = d.connections.filter((c: any) => c.status === "off");
            const waiting = d.brands.filter((b: any) => !b.confirmed);
            return (
              <div className="stack">
                {live.length > 0 && <Section title="Your tools" i={1} action={<span className="t-foot faint">{d.connections.filter((c: any) => c.status === "connected").length} of {d.connections.length} connected</span>}>
                  <div className="card group">{live.map((c: any) => <ToolRow key={c.id} c={c} google={d.google} />)}</div>
                </Section>}
                {off.length > 0 && <Section title={live.length ? "Not connected yet" : "Connect your tools"} i={2}><div className="card group">{off.map((c: any) => <ToolRow key={c.id} c={c} google={d.google} />)}</div></Section>}
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

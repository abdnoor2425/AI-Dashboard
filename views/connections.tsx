"use client";
import React, { useEffect, useRef, useState } from "react";
import { api, useApi, useApp } from "@/lib/client";
import { ago } from "@/lib/format";
import { Empty, Icon, Load, Mark, Page, SampleTag, Section, SkelCards, SkelRows } from "@/components/ui";
import { MetricoolFile } from "@/components/metricool-file";
import { Logo } from "@/components/logos";

const LABEL: Record<string, { text: string; tone: string }> = {
  connected: { text: "Connected", tone: "good" }, manual: { text: "Manual", tone: "warn" },
  error: { text: "Needs attention", tone: "bad" }, off: { text: "Not connected", tone: "" }, soon: { text: "Coming later", tone: "" },
};
/** Opens Stripe's own page for a new read-only key, with the name and the four read boxes already ticked. */
// Simple marks for each AI. They name the app; they are not the companies' own logos.
function AiMark({ id }: { id: string }) {
  const tile = (bg: string, child: React.ReactNode, fg = "#fff") => <span className="ai-tile" style={{ background: bg, color: fg }}>{child}</span>;
  const rays = <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">{[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5].map((a) => <path key={a} d="M12 4.2v15.6" transform={`rotate(${a} 12 12)`} />)}</g></svg>;
  if (id === "claude-code") return tile("#C8643F", rays);
  if (id === "claude-app") return tile("#F4E9DC", rays, "#C8643F");
  if (id === "codex") return tile("#111", <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7l5 5-5 5M12.5 17H19" /></svg>);
  if (id === "gemini") return tile("#EEF2FD", <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="ai-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4C8DF6" /><stop offset="1" stopColor="#9B72E8" /></linearGradient></defs><path d="M12 2.5c.9 5.2 4.3 8.6 9.5 9.5-5.2.9-8.6 4.3-9.5 9.5-.9-5.2-4.3-8.6-9.5-9.5 5.2-.9 8.6-4.3 9.5-9.5z" fill="url(#ai-gem)" /></svg>);
  if (id === "cursor") return tile("#1A1A1A", <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5l12.5 7.2-5.6 1.5-2.7 5.3z" fill="currentColor" /></svg>);
  if (id === "chatgpt") return tile("#F1F1EF", <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 6.5a2 2 0 012-2h11a2 2 0 012 2v8a2 2 0 01-2 2H11l-4.5 3.5v-3.5a2 2 0 01-2-2z" /></svg>, "#111");
  return tile("#F1F1EF", <span style={{ fontWeight: 700, fontSize: 17 }}>{(id[0] || "?").toUpperCase()}</span>, "#111");
}

const STRIPE_KEY_URL = "https://dashboard.stripe.com/apikeys/create?name=AI-Dashboard" + ["rak_charge_read", "rak_customer_read", "rak_subscription_read", "rak_payout_read"].map((p) => "&permissions%5B%5D=" + p).join("");
const HOW: Record<string, string> = {
  google: "Click Connect and sign in with Google. The first Google sign-in connects Gmail, Drive, Calendar and Google Analytics together: tick Select all on Google's page. Read-only access, and the sign-in stays on this computer.",
  oauth: "Sign in on the tool's own page. The dashboard asks for read-only access.",
  token: "Paste the access token from the tool's settings. It is saved on this computer only and never leaves it.",
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
  const [reviewed, setReviewed] = useState(false);
  const [token, setToken] = useState(""); const [userId, setUserId] = useState("");
  const c = q.data?.connections.find((x: any) => x.id === id);
  if (!c) return <SkelRows n={3} />;
  const google = q.data.google;
  const soon = c.auth === "soon";
  const s = soon ? LABEL.soon : LABEL[c.status] || LABEL.off;
  const notReady = c.auth === "google" && google && !google.ready && c.status === "off";
  const needsToken = c.auth === "token" && c.status !== "connected";
  const act = async (action: "connect" | "disconnect") => {
    setBusy(true);
    try {
      const r = await api("connections/" + c.id, { method: "POST", body: { action, stripeScopesReviewed: reviewed, token: token || undefined, userId: userId || undefined } });
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
        <div><dt>Access</dt><dd>{c.id === "stripe" ? "Read only. The dashboard only ever reads from Stripe" : c.id === "linear" ? "Reads tickets. Posts only your own comments and alerts" : c.id === "gmail" ? "Read only. Sends alerts only if you allow it" : "Read only"}</dd></div>
        <div><dt>How it connects</dt><dd>{c.id === "stripe" ? "Stripe makes you a read-only key, you check it and paste it here. It is saved on this computer only." : HOW[c.auth] || HOW.oauth}</dd></div>
      </dl>
      {notReady && <p className="t-foot inset" style={{ padding: 18 }}>Google sign-in is not switched on in this copy of the dashboard yet. Download the latest version and it will be.</p>}
      {c.id === "metricool" && !app.boot.workspace.sample && (
        <div className="inset stack" style={{ gap: 12, padding: 18 }}>
          <span className="t-cap">Add your numbers from a file</span>
          <MetricoolFile onDone={() => q.reload()} />
        </div>
      )}
      {needsToken && (
        <div className="inset stack" style={{ gap: 12, padding: 18 }}>
          {c.id === "metricool" && <span className="t-cap">Or connect with the Metricool API</span>}
          {c.id === "metricool" && <label><span className="t-cap">User ID</span><input className="input" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="1234567" inputMode="numeric" autoComplete="off" /></label>}
          {c.id === "stripe" && <>
            <p className="t-foot"><b>Step 1.</b> Open Stripe. Check that Charges, Customers, Subscriptions and Payouts say Read and everything else says None, then press Create key.</p>
            <div><a className="btn" href={STRIPE_KEY_URL} target="_blank" rel="noreferrer">Make the key in Stripe</a></div>
            <p className="t-foot"><b>Step 2.</b> Copy the key Stripe shows you and paste it below.</p>
          </>}
          <label><span className="t-cap">{c.id === "stripe" ? "Read-only key" : "Access token"}</span><input className="input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={c.id === "stripe" ? "rk_live_…" : "Paste the token"} autoComplete="off" /></label>
          {c.id === "stripe" && <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} style={{ marginTop: 3 }} /><span>I checked in Stripe that this key is set to <b>Read</b> only.</span></label>}
          <button className="btn primary lg" disabled={busy || (!app.boot.workspace.sample && (!token || (c.id === "stripe" && !reviewed)))} onClick={() => act("connect")}>Connect {c.name}</button>
          {c.id === "stripe" && <p className="t-foot faint">Only a restricted key is accepted, and a full secret key is refused. What the key may do is set in Stripe, so check it there.</p>}
          {c.id === "metricool" && <p className="t-foot faint">Metricool only allows this on its Advanced or Custom plan. The token is under Account settings, API, in Metricool.</p>}
        </div>
      )}
      {c.status === "off" && !soon && !notReady && !needsToken && <button className="btn primary lg" disabled={busy} onClick={() => act("connect")}>{c.auth === "google" ? "Connect with Google" : "Connect " + c.name}</button>}
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
  const app = useApp();
  const q = useApi("ai/agents");
  const st = useApi("ai/status");
  const [busy, setBusy] = useState<string | null>(null);
  const agents: any[] = q.data?.agents || [];
  const local = agents.filter((a) => a.kind !== "cloud");
  const answerWith = q.data?.answerWith;
  const act = async (a: any, action: "connect" | "disconnect") => {
    setBusy(a.id);
    try { await api("ai/agents/" + a.id, { method: "POST", body: { action } }); q.reload(); app.toast(action === "connect" ? `${a.name} connected${a.id === "claude-app" ? ". Restart the Claude app to see it." : ""}` : `${a.name} disconnected`); }
    catch (e: any) { app.toast(e.message); }
    setBusy(null);
  };
  const pick = async (a: any) => { try { await api("ai/answer", { method: "POST", body: { id: a.id } }); q.reload(); st.reload(); app.toast(`${a.name} now answers in the dashboard`); } catch (e: any) { app.toast(e.message); } };
  const path = st.data?.mcpPath || "/path/to/AI-Dashboard/mcp/server.mjs";
  const linked = local.filter((a) => a.connected).length;
  return (
    <div className="card pad ai-card">
      <div className="flex items-start gap-3">
        <span className="tint" style={{ width: 48, height: 48, borderRadius: 15 }}><Icon name="sparkle" size={22} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="flex items-center gap-2 flex-wrap"><h3 className="t-head">Your AI</h3>{q.data && !q.data.preview && <span className={"chip " + (linked ? "good" : "")}>{linked ? `${linked} connected` : "None connected"}</span>}<a className="btn sm" href="#scan" style={{ marginLeft: "auto" }}>Scan for AI</a></div>
          <p className="muted" style={{ marginTop: 4, maxWidth: "62ch" }}>Ask about your business in plain words, using the AI plan you already pay for. No API keys. Your AI can only read the dashboard.</p>
        </div>
      </div>
      {q.loading && !q.data ? <div style={{ marginTop: 14 }}><SkelRows n={3} /></div> : q.data?.preview ? (
        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="stack" style={{ gap: 8 }}><div className="t-cap">Claude Code</div><CopyLine label="Claude Code command" text={`claude mcp add ai-dashboard -- node ${path}`} /></div>
          <div className="stack" style={{ gap: 8 }}><div className="t-cap">Codex</div><CopyLine label="Codex command" text={`codex mcp add ai-dashboard -- node ${path}`} /></div>
        </div>
      ) : (
        <div className="card group inset" style={{ marginTop: 16 }}>
          {agents.map((a) => (
            <div className="row" key={a.id} style={a.kind === "cloud" ? { opacity: 0.6 } : undefined}>
              <span className="ai-row-mark"><AiMark id={a.id} /></span>
              <span className="row-main"><span className="row-title" style={{ display: "block" }}>{a.name}</span><span className="row-sub">{a.sub}</span></span>
              <span className="flex gap-2 items-center flex-wrap justify-end">
                {a.connected && a.answers && (answerWith === a.id ? <span className="chip accent">Answers here</span> : <button className="btn sm plain" onClick={() => pick(a)}>Answer here</button>)}
                {a.kind === "cloud" ? <span className="chip">Not yet</span>
                  : !a.installed ? (a.getUrl ? <a className="btn sm" href={a.getUrl} target="_blank" rel="noreferrer">Get it</a> : <span className="chip">Not on this computer</span>)
                  : a.connected ? <button className="btn sm" disabled={busy === a.id} onClick={() => act(a, "disconnect")}>Disconnect</button>
                  : <button className="btn sm primary" disabled={busy === a.id} onClick={() => act(a, "connect")}>{busy === a.id ? "Connecting…" : "Connect"}</button>}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="t-foot faint" style={{ marginTop: 12 }}>After connecting, try asking your AI: "What needs my attention today?" ChatGPT runs in the cloud, so it can&apos;t reach a dashboard on your computer yet. Grok works once its command-line app is on this computer.</p>
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
      if (p.get("connected")) app.toast(({ google: "Your Google apps are connected. Your data is being fetched.", "google-analytics": "Google Analytics connected. Your websites are being fetched.", gmail: "Gmail connected", drive: "Google Drive connected", calendar: "Google Calendar connected" } as Record<string, string>)[p.get("connected") as string] || "Connected");
      if (p.get("problem") || p.get("connected")) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    } catch { /* nothing to show */ }
  }, []);
  const confirm = async (b: any) => { try { await api("connections/brands", { method: "POST", body: { siteId: b.siteId, confirmed: true } }); app.toast(`${b.site} matched`); } catch (e: any) { app.toast(e.message); } };
  return (
    <Page title="Connections" sub="Each person connects their own tools. Everything stays on this computer. The dashboard only reads, apart from comments and alerts you send yourself." actions={<SampleTag show={app.boot.workspace.sample} />}>
      <div className="stack">
        <Section><AiCard /></Section>
        <Load q={q} skeleton={<SkelCards n={6} h={190} cols="tool-grid" />}>
          {(d) => {
            // Calendar is hidden unless its page is switched on in Settings.
            const shown = d.connections;
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

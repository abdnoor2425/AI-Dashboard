"use client";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link, { go, usePathname, useRouter } from "@/lib/nav";
import { App, api, requestWatch, scopeParam, store, useApi } from "@/lib/client";
import type { Scope } from "@/lib/client";
import { growFrom, installMotion, shrinkTo } from "@/lib/motion";
import { Icon, Mark, Menu, Page } from "./ui";
import { ItemSheet } from "./attention";
import { StarterPages } from "@/views/workos";
import { VIEWS } from "@/views";

export interface CardSpec { title: string; chip?: string; render: (close: () => void) => React.ReactNode; from: HTMLElement | null }
export const pageOf = (pathname: string) => (pathname || "/").replace(/^\/+|\/+$/g, "").split("/")[0] || "overview";
export const hrefOf = (page: string) => (page === "overview" ? "/" : "/" + page);
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** A detail card that grows out of whatever was tapped. Used by every card on the Overview and the tool cards. */
function CardSheet({ card, onClose }: { card: CardSpec; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [closing, setClosing] = useState(false);
  const fromRect = useRef(card.from?.getBoundingClientRect() || null);
  useEffect(() => { if (ref.current) growFrom(ref.current, fromRect.current, { radius: 22 }); closeBtn.current?.focus({ preventScroll: true }); }, []);
  const close = async () => {
    if (closing) return; setClosing(true);
    const target = card.from && document.contains(card.from) ? card.from : null;
    if (ref.current) await shrinkTo(ref.current, target?.getBoundingClientRect() || null);
    onClose(); target?.focus?.({ preventScroll: true });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input, [tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", key, true); return () => document.removeEventListener("keydown", key, true);
  });
  return (
    <>
      <div className={"scrim" + (closing ? " out" : "")} onClick={close} />
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={card.title}>
        <div className="sheet-head">
          {card.chip && <span className="chip accent">{card.chip}</span>}
          <span style={{ flex: 1 }} />
          <button ref={closeBtn} className="icon-btn" onClick={close} aria-label="Close details"><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body"><h2 className="t-mid" style={{ marginBottom: 14 }}>{card.title}</h2>{card.render(close)}</div>
      </div>
    </>
  );
}

function ScopePicker({ boot, scope, setScope }: { boot: any; scope: Scope; setScope: (s: Scope) => void }) {
  const list = scope.mode === "sites" ? boot.sites : boot.clients;
  const cur = list.find((x: any) => x.id === scope.id);
  const allLabel = scope.mode === "sites" ? "All websites" : "All clients";
  return (
    <Menu label="Choose what to view" button={(p) => (
      <button className="btn" style={{ paddingLeft: cur ? 6 : 14, maxWidth: "46vw" }} {...p}>
        {cur && <Mark name={cur.name} color={cur.color} />}<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{cur ? cur.name : allLabel}</span><Icon name="down" size={15} className="chev" />
      </button>
    )}>
      {(close) => <>
        <div className="menu-label">{scope.mode === "sites" ? "From Google Analytics" : "Your clients"}</div>
        <button role="menuitem" className={"menu-item" + (scope.id === "all" ? " on" : "")} onClick={() => { setScope({ mode: scope.mode, id: "all" }); close(); }}><span className="glyph" style={{ width: 28, height: 28 }}><Icon name={scope.mode === "sites" ? "website" : "clients"} size={15} /></span><span style={{ flex: 1 }}>{allLabel}</span>{scope.id === "all" && <Icon name="check" size={16} />}</button>
        {list.map((x: any) => (
          <button key={x.id} role="menuitem" className={"menu-item" + (scope.id === x.id ? " on" : "")} onClick={() => { setScope({ mode: scope.mode, id: x.id }); close(); }}>
            <Mark name={x.name} color={x.color} /><span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", lineHeight: 1.2 }}>{x.name}</span><span className="t-cap" style={{ fontWeight: 500 }}>{x.domain || x.sub}</span></span>{scope.id === x.id && <Icon name="check" size={16} />}
          </button>
        ))}
      </>}
    </Menu>
  );
}

function Palette({ boot, onClose, setScope }: { boot: any; onClose: () => void; setScope: (s: Scope) => void }) {
  const router = useRouter();
  const [qy, setQy] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [hl, setHl] = useState(0);
  const [answer, setAnswer] = useState<any>(null);
  const [asking, setAsking] = useState(false);
  const app = React.useContext(App);
  useEffect(() => {
    if (!qy.trim()) { setResults([]); return; }
    let live = true; const t = setTimeout(() => api("search", { query: { q: qy } }).then((d) => live && setResults(d.results), () => {}), 120);
    return () => { live = false; clearTimeout(t); };
  }, [qy]);
  const base = useMemo(() => boot.modulesList.filter((m: any) => boot.workspace.modules[m.id] !== false).slice(0, 7).map((m: any) => ({ type: "Page", title: m.label, href: m.id })), [boot]);
  const rows = qy.trim() ? [...results, { type: "Ask", title: `Ask your AI: "${qy.trim()}"`, ask: true }] : base;
  useEffect(() => setHl(0), [qy, results.length]);
  const run = async (r: any) => {
    if (!r) return;
    if (r.ask) {
      setAsking(true); setAnswer(null);
      try { setAnswer(await api("ai/ask", { method: "POST", body: { question: qy.trim() }, query: { scope: app.scopeKey } })); } catch (e: any) { setAnswer({ answer: e.message, provider: "error" }); }
      setAsking(false); return;
    }
    if (r.site) setScope({ mode: "sites", id: r.site });
    if (r.client) setScope({ mode: "clients", id: r.client });
    router.push(hrefOf(r.href)); onClose();
    if (r.item) setTimeout(() => app.openItem(r.item, null), 350);
  };
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search and ask">
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 18, top: 19, color: "var(--text-3)" }}><Icon name="search" size={20} /></span>
          <input id="palette-input" className="palette-input" autoFocus placeholder="Search, jump to a page, or ask a question" value={qy} onChange={(e) => { setQy(e.target.value); setAnswer(null); }} aria-label="Search or ask"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setHl((h) => Math.min(rows.length - 1, h + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => Math.max(0, h - 1)); }
              if (e.key === "Enter") { e.preventDefault(); run(rows[hl]); }
              if (e.key === "Escape") onClose();
            }} />
        </div>
        <div className="palette-list" role="listbox" aria-label="Results">
          {!qy.trim() && <div className="menu-label">Jump to</div>}
          {rows.map((r: any, i: number) => (
            <button key={i} role="option" aria-selected={i === hl} className={"menu-item" + (i === hl ? " hl" : "")} onMouseEnter={() => setHl(i)} onClick={() => run(r)}>
              <span className={"glyph" + (r.ask ? " accent" : "")} style={{ width: 30, height: 30 }}><Icon name={r.ask ? "sparkle" : r.type === "Page" ? r.href : r.type === "Website" ? "website" : r.type === "Client" ? "clients" : r.type === "Needs you" ? "attention" : r.href} size={16} /></span>
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>{r.sub && <span className="t-cap" style={{ fontWeight: 500 }}>{r.sub}</span>}</span>
              <span className="t-cap">{r.ask ? "Enter" : r.type}</span>
            </button>
          ))}
          {(asking || answer) && (
            <div className="quote fade" style={{ margin: 6 }} aria-live="polite">
              {asking ? <div className="flex items-center gap-2 muted"><span className="spinner" />Reading your dashboard</div> : <><p style={{ fontSize: 15 }}>{answer.answer}</p><p className="t-foot faint" style={{ marginTop: 8 }}>{answer.note || `Answered by ${answer.provider}, using only your dashboard data.`}</p></>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** Pages that keep their own React view. The value is the name shown in the top bar. */
export const LEGACY: Record<string, string> = {
  attention: "Needs you", website: "Website", social: "Social and reels", reels: "Reel scores", team: "Your team", connections: "Connections", settings: "Settings",
  metrics: "Metrics", inbox: "Inbox", calendar: "Calendar", files: "Files", skills: "Skills", suggestions: "Suggestions", usage: "AI usage", setup: "Setup", more: "More",
};
const SCOPED = new Set(["attention", "website", "social", "reels", "metrics", "inbox", "calendar", "files"]);
const pv = () => (typeof window !== "undefined" ? (window as any).__pv : null);

function Splash() {
  return (
    <div className="aid-splash" role="status" aria-label="Loading">
      <img alt="" src="/icon.svg" width={56} height={56} />
      <div className="aid-splash-bar"><i /></div>
    </div>
  );
}

export function AppShell({ shell, children }: { shell: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const page = pageOf(pathname);
  const bootQ = useApi("bootstrap");
  const boot = bootQ.data;
  const [scope, setScopeState] = useState<Scope>({ mode: "sites", id: "all" });
  const [sheet, setSheet] = useState<{ id: string; from: HTMLElement | null } | null>(null);
  const [palette, setPalette] = useState(false);
  const [title, setTitle] = useState("");
  const [titleShown, setTitleShown] = useState(false);
  const [card, setCard] = useState<CardSpec | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [look, setLook] = useState("night");
  const html = useMemo(() => ({ __html: shell }), [shell]);

  useEffect(() => { installMotion(); const s = store("scope"); if (s?.mode) setScopeState(s); }, []);

  // Keep the scope valid for the active workspace.
  useEffect(() => {
    if (!boot) return;
    const list = scope.mode === "sites" ? boot.sites : boot.clients;
    if ((scope.mode === "clients" && !boot.clients.length) || (scope.id !== "all" && !list.some((x: any) => x.id === scope.id))) setScopeState({ mode: boot.clients.length ? scope.mode : "sites", id: "all" });
  }, [boot?.workspace?.id, boot?.sites?.length]);

  // First run: a new install opens on the welcome flow, never on a dashboard of examples.
  const firstRun = !!boot?.firstRun;
  const ready = !!boot;

  // When the owner's own AI posts a Linear comment or alerts someone, say so here and play it in Your team.
  useEffect(() => {
    if (!boot || boot.clientStarter || boot.firstRun || boot.workspace?.sample) return;
    let busy = false;
    const look = async () => {
      if (busy || document.hidden) return; busy = true;
      try {
        const r = await api("ai/sent");
        for (const x of r?.sent || []) {
          if (x.kind === "alert" && x.watch?.length) { requestWatch(x.watch); pv()?.toast?.(`Your AI alerted ${x.to.join(" and ")}.${page === "team" ? "" : " Open Your team to watch it."}`); }
          else pv()?.toast?.(`Your AI posted a comment on “${x.title}”.`);
        }
      } catch { /* the dashboard may be restarting */ }
      busy = false;
    };
    const t = window.setInterval(look, 6000);
    return () => window.clearInterval(t);
  }, [boot, page]);

  // The screens are drawn by ui/js. It starts once the frame is on the page, and is told whenever the basics change.
  useEffect(() => {
    if (!ready || boot.clientStarter) return;
    (window as any).__AID = { boot };
    setHost(document.getElementById("legacy"));
    if (pv()) { pv().boot?.(boot); return; }
    if (document.getElementById("aid-ui")) return;
    const s = document.createElement("script"); s.id = "aid-ui"; s.src = "/ui/app.js"; document.body.appendChild(s);
  }, [ready, boot]);
  useEffect(() => {
    const onLook = (e: any) => setLook(e.detail?.look || document.documentElement.dataset.look || "night");
    const onAsk = () => setPalette(true);
    const onItem = (e: any) => e.detail?.id && setSheet({ id: e.detail.id, from: null });
    setLook(document.documentElement.dataset.look || "night");
    window.addEventListener("aid:look", onLook); window.addEventListener("aid:ask", onAsk); window.addEventListener("aid:item", onItem);
    return () => { window.removeEventListener("aid:look", onLook); window.removeEventListener("aid:ask", onAsk); window.removeEventListener("aid:item", onItem); };
  }, []);
  // Anything that changes data (a sign-in, a sync, an approval) refreshes the drawn screens too.
  useEffect(() => { if (ready) pv()?.refresh?.(); }, [ready, boot?.changedAt]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
      if (e.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);

  const setScope = useCallback((s: Scope) => { setScopeState(s); store("scope", s); }, []);
  const dark = look === "dusk" || look === "night";
  const scopeLabel = useMemo(() => {
    if (!boot) return "";
    const list = scope.mode === "sites" ? boot.sites : boot.clients;
    return list.find((x: any) => x.id === scope.id)?.name || (scope.mode === "sites" ? "All websites" : "All clients");
  }, [boot, scope]);

  const ctx = useMemo(() => ({
    boot, reloadBoot: bootQ.reload, scope, setScope, scopeKey: scopeParam(scope), scopeLabel,
    theme: dark ? "dark" : "light", setTheme: (t: string) => pv()?.look?.(t === "light" ? "day" : t === "dark" ? "night" : null, true),
    look, setLook: (k: string | null) => pv()?.look?.(k, true),
    openItem: (id: string, from?: HTMLElement | null) => setSheet({ id, from: from || null }),
    openPalette: () => setPalette(true), toast: (msg: string) => pv()?.toast?.(msg),
    title, setTitle, titleShown, setTitleShown, syncing: null,
    sky: "live", setSky: () => {}, skyPhase: look, dark, collapsed: false, setCollapsed: () => {},
    openCard: (c: Omit<CardSpec, "from">, from?: HTMLElement | null) => setCard({ ...c, from: from || null }),
    watchLive: (ids: string[]) => { setSheet(null); setCard(null); requestWatch(ids); if (page !== "team") go("team"); },
  }), [boot, scope, scopeLabel, look, dark, title, titleShown, page]);

  if (!boot) return bootQ.error ? <p role="alert">{bootQ.error}</p> : <Splash />;
  if (boot.clientStarter) return <App.Provider value={ctx as any}><StarterPages page={page}/>{children}</App.Provider>;
  // The welcome flow is drawn by ui/js in the same frame as the dashboard, so it has the same look. No page of the dashboard is mounted yet.
  if (firstRun) return <App.Provider value={ctx as any}><div id="obs" dangerouslySetInnerHTML={html} suppressHydrationWarning /></App.Provider>;

  const sub = pathname.replace(/^\/+/, "").split("/")[1] || "";
  const legacyPage = page === "brain" && sub === "edit" ? "second-brain" : LEGACY[page] ? page : null;
  const View = legacyPage ? (legacyPage === "more" ? MorePages : VIEWS[legacyPage]) : null;
  return (
    <App.Provider value={ctx as any}>
      <div id="obs" dangerouslySetInnerHTML={html} suppressHydrationWarning />
      {host && View && createPortal(
        <div className="lg-page" key={legacyPage + boot.workspace.id}>
          {SCOPED.has(legacyPage!) && (boot.sites.length > 1 || boot.clients.length > 0) && <div className="lg-scope"><ScopePicker boot={boot} scope={scope} setScope={setScope} /></div>}
          <View />
        </div>, host)}
      <div className="lg lg-layer">
        {card && <CardSheet key={card.title} card={card} onClose={() => setCard(null)} />}
        {sheet && <ItemSheet key={sheet.id} id={sheet.id} from={sheet.from} onClose={() => setSheet(null)} />}
        {palette && <Palette boot={boot} onClose={() => setPalette(false)} setScope={setScope} />}
      </div>
      {children}
    </App.Provider>
  );
}

/** The pages that are not in the rail, in one place. */
function MorePages() {
  const app = React.useContext(App);
  const on = (id: string) => app.boot.workspace.modules[id] !== false;
  const rows: [string, string, string][] = [
    ["metrics", "Metrics", "The numbers you chose to watch, each with its source and how fresh it is."],
    ["inbox", "Inbox", "Mail that is waiting on you."],
    ["calendar", "Calendar", "Meetings and deadlines for the next days."],
    ["files", "Files", "Recent files from your connected Drive."],
    ["skills", "Skills", "What your AI knows how to do for you."],
    ["suggestions", "Suggestions", "Ideas your AI noticed, for you to accept or dismiss."],
    ["usage", "AI usage", "What your AI plans were used for."],
    ["setup", "Setup", "The checklist for a new workspace."],
  ];
  return (
    <Page title="More" sub="Everything else the dashboard keeps for you.">
      <div className="card group">
        {rows.filter(([id]) => on(id) || id === "setup").map(([id, name, about]) => (
          <a key={id} className="row tap" href={"#" + id}><span className="glyph"><Icon name={id} size={17} /></span><span className="row-main"><span className="row-title">{name}</span><span className="row-sub">{about}</span></span><Icon name="chevron" size={16} /></a>
        ))}
      </div>
    </Page>
  );
}

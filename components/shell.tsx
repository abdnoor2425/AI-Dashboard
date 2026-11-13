"use client";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { App, api, scopeParam, store, useApi } from "@/lib/client";
import type { Scope } from "@/lib/client";
import { SKY_HOURS, darkAtHour, growFrom, installMotion, shrinkTo, skyAt } from "@/lib/motion";
import type { SkyPhase } from "@/lib/motion";
import { Icon, Mark, Menu, Segmented, Skel } from "./ui";
import { ItemSheet } from "./attention";

export interface CardSpec { title: string; chip?: string; render: (close: () => void) => React.ReactNode; from: HTMLElement | null }
export const pageOf = (pathname: string) => (pathname || "/").replace(/^\/+|\/+$/g, "").split("/")[0] || "overview";
export const hrefOf = (page: string) => (page === "overview" ? "/" : "/" + page);
const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The sky behind everything. Its colours, sun and stars are set from the hour and the theme. */
function Sky({ hour, dark }: { hour: number; dark: boolean }) {
  useEffect(() => {
    const k = skyAt(hour, dark), st = document.documentElement.style;
    k.colors.forEach((c, i) => st.setProperty("--sky-" + (i + 1), c));
    st.setProperty("--sky-glow", k.glow); st.setProperty("--sky-cloud", String(k.cloud)); st.setProperty("--sky-stars", String(k.stars));
    st.setProperty("--sun-x", String(k.x)); st.setProperty("--sun-y", String(k.y));
    document.documentElement.setAttribute("data-sky", k.phase);
  }, [hour, dark]);
  return <div className="sky" aria-hidden="true"><i className="sun" /><i className="stars" /><i className="cloud c1" /><i className="cloud c2" /></div>;
}

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

function Sidebar({ boot, page, open, onNavigate, collapsed, onToggle }: { boot: any; page: string; open: boolean; onNavigate: () => void; collapsed: boolean; onToggle: () => void }) {
  const navRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<number | null>(null);
  const router = useRouter();
  const mods = boot.modulesList.filter((m: any) => boot.workspace.modules[m.id] !== false);
  const badge: Record<string, number> = { attention: boot.counts.attention, suggestions: boot.counts.suggestions, inbox: boot.counts.inbox };
  useIso(() => { const el = navRef.current?.querySelector<HTMLElement>(".nav-item.active"); setPill(el ? el.offsetTop : null); }, [page, mods.length, collapsed]);
  const item = (m: any) => (
    <Link key={m.id} href={hrefOf(m.id)} className={"nav-item" + (page === m.id ? " active" : "")} aria-current={page === m.id ? "page" : undefined} onClick={onNavigate} title={collapsed ? m.label : undefined} aria-label={m.label}>
      <Icon name={m.id} size={19} /><span className="nav-text">{m.label}</span>{badge[m.id] > 0 && <span className="nav-badge num">{badge[m.id]}</span>}
    </Link>
  );
  return (
    <aside className={"sidebar glass" + (open ? " open" : "")} aria-label="Main navigation">
      {collapsed && <button className="ws-btn ws-mini hide-sm" onClick={onToggle} aria-label="Open the sidebar" title="Open the sidebar"><span className="ws-mark">{boot.workspace.brand.name.slice(0, 1).toUpperCase()}</span></button>}
      <div className={collapsed ? "show-sm" : ""}><Menu align="left" label="Switch workspace" button={(p) => (
        <button className="ws-btn" {...p}>
          <span className="ws-mark">{boot.workspace.brand.name.slice(0, 1).toUpperCase()}</span>
          <span style={{ minWidth: 0, flex: 1 }}><span style={{ display: "block", fontWeight: 650, fontSize: 14.5, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{boot.workspace.brand.name}</span><span className="t-cap" style={{ fontWeight: 500 }}>{boot.workspace.sample ? "Sample workspace" : "On this laptop"}</span></span>
          <Icon name="updown" size={16} className="chev" />
        </button>
      )}>
        {(close) => <>
          <div className="menu-label">Workspaces on this laptop</div>
          {boot.workspaces.map((w: any) => (
            <button key={w.id} role="menuitem" className={"menu-item" + (w.id === boot.workspace.id ? " on" : "")} onClick={async () => { close(); if (w.id !== boot.workspace.id) { await api("workspaces/switch", { method: "POST", body: { id: w.id } }); router.push("/"); } }}>
              <Mark name={w.name} color={boot.accents[w.accent]?.light} /><span style={{ flex: 1 }}>{w.name}</span>{w.id === boot.workspace.id && <Icon name="check" size={16} />}
            </button>
          ))}
          <hr className="divider" style={{ margin: "6px 10px" }} />
          <button role="menuitem" className="menu-item" onClick={() => { close(); onNavigate(); router.push("/settings"); }}><span className="glyph" style={{ width: 28, height: 28 }}><Icon name="plus" size={15} /></span>New workspace from the template</button>
        </>}
      </Menu></div>
      <div className="side-scroll">
        <nav className="nav" ref={navRef}>
          {pill != null && <span className="nav-pill" style={{ transform: `translateY(${pill}px)` }} />}
          <div className="nav-label" style={{ paddingTop: 10 }}>Today</div>
          {mods.filter((m: any) => m.group === "main").slice(0, 2).map(item)}
          <div className="nav-label">Results</div>
          {mods.filter((m: any) => m.group === "main").slice(2).map(item)}
          <div className="nav-label">More</div>
          {mods.filter((m: any) => m.group === "more").map(item)}
        </nav>
      </div>
      <button className="nav-item side-toggle hide-sm" onClick={onToggle} aria-pressed={collapsed} aria-label={collapsed ? "Open the sidebar" : "Collapse the sidebar"} title={collapsed ? "Open the sidebar" : "Collapse the sidebar (Ctrl B)"}><Icon name="sidebar" size={19} /><span className="nav-text">Collapse</span></button>
    </aside>
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const page = pageOf(pathname);
  const bootQ = useApi("bootstrap");
  const boot = bootQ.data;
  const [scope, setScopeState] = useState<Scope>({ mode: "sites", id: "all" });
  const [theme, setThemeState] = useState("system");
  const [sheet, setSheet] = useState<{ id: string; from: HTMLElement | null } | null>(null);
  const [palette, setPalette] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; n: number } | null>(null);
  const [title, setTitle] = useState("");
  const [titleShown, setTitleShown] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [syncing, setSyncing] = useState<string | null>("Checking your tools");
  const [collapsed, setCollapsedState] = useState(false);
  const [sky, setSkyState] = useState<SkyPhase | "live">("live");
  const [clock, setClock] = useState(() => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; });
  const [card, setCard] = useState<CardSpec | null>(null);
  const hour = sky === "live" ? clock : SKY_HOURS[sky];
  const dark = theme === "dark" || (theme !== "light" && darkAtHour(hour));

  useEffect(() => {
    installMotion(); const s = store("scope"); if (s?.mode) setScopeState(s);
    if (store("collapsed")) setCollapsedState(true);
    const k = store("sky"); if (k && (k === "live" || k in SKY_HOURS)) setSkyState(k);
    const t = setInterval(() => { const d = new Date(); setClock(d.getHours() + d.getMinutes() / 60); }, 60000); return () => clearInterval(t);
  }, []);
  useEffect(() => { const on = () => setScrolled(window.scrollY > 6); on(); window.addEventListener("scroll", on, { passive: true }); return () => window.removeEventListener("scroll", on); }, []);
  useEffect(() => { window.scrollTo(0, 0); setDrawer(false); }, [pathname]);

  // Keep the scope valid for the active workspace.
  useEffect(() => {
    if (!boot) return;
    const list = scope.mode === "sites" ? boot.sites : boot.clients;
    if (scope.mode === "clients" || (scope.id !== "all" && !list.some((x: any) => x.id === scope.id))) setScopeState({ mode: "sites", id: "all" });
  }, [boot?.workspace?.id, boot?.sites?.length]);

  // Accent colour and theme follow the workspace settings.
  useEffect(() => {
    if (!boot) return;
    const root = document.documentElement, a = boot.accents[boot.workspace.brand.accent] || boot.accents.blue;
    root.style.setProperty("--accent-l", a.light); root.style.setProperty("--accent-d", a.dark);
    setThemeState(boot.theme);
  }, [boot?.workspace?.brand?.accent, boot?.theme, boot?.workspace?.id]);
  // Automatic means light by day and dark at night, so the whole app follows the sky.
  useEffect(() => { document.documentElement.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);

  // The sync pill: says what is being refreshed, then steps out of the way.
  useEffect(() => {
    if (!boot) return;
    const steps = ["Syncing Google Analytics", "Syncing Metricool", "Up to date"];
    let i = 0; setSyncing(steps[0]);
    const t = setInterval(() => { i++; if (i < steps.length) setSyncing(steps[i]); else { setSyncing(null); clearInterval(t); } }, 1100);
    return () => clearInterval(t);
  }, [boot?.workspace?.id]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") { e.preventDefault(); setCollapsed(!store("collapsed")); }
      if (e.key === "Escape") { setPalette(false); setDrawer(false); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(null), 2600); return () => clearTimeout(t); }, [toastMsg]);

  const setScope = useCallback((s: Scope) => { setScopeState(s); store("scope", s); }, []);
  const setCollapsed = useCallback((c: boolean) => { setCollapsedState(c); store("collapsed", c); }, []);
  const setSky = useCallback((k: SkyPhase | "live") => { setSkyState(k); store("sky", k); }, []);
  const setTheme = useCallback((t: string) => { setThemeState(t); api("settings", { method: "POST", body: { theme: t } }).catch(() => {}); }, []);
  const scopeLabel = useMemo(() => {
    if (!boot) return "";
    const list = scope.mode === "sites" ? boot.sites : boot.clients;
    return list.find((x: any) => x.id === scope.id)?.name || (scope.mode === "sites" ? "All websites" : "All clients");
  }, [boot, scope]);

  const ctx = useMemo(() => ({
    boot, reloadBoot: bootQ.reload, scope, setScope, scopeKey: scopeParam(scope), scopeLabel, theme, setTheme,
    openItem: (id: string, from?: HTMLElement | null) => setSheet({ id, from: from || null }),
    openPalette: () => setPalette(true), toast: (msg: string) => setToastMsg({ msg, n: Date.now() }),
    title, setTitle, titleShown, setTitleShown, syncing,
    sky, setSky, skyPhase: skyAt(hour, dark).phase, dark, collapsed, setCollapsed,
    openCard: (c: Omit<CardSpec, "from">, from?: HTMLElement | null) => setCard({ ...c, from: from || null }),
  }), [boot, scope, scopeLabel, theme, title, titleShown, syncing, sky, hour, dark, collapsed]);

  if (!boot) {
    return (
      <div className="shell"><Sky hour={hour} dark={dark} />
        <aside className="sidebar glass hide-sm" aria-hidden="true"><div style={{ padding: 8 }}><Skel h={34} r={10} /></div><div style={{ padding: "18px 8px", display: "grid", gap: 14 }}>{Array.from({ length: 9 }, (_, i) => <Skel key={i} h={16} w={`${70 - (i % 3) * 14}%`} />)}</div></aside>
        <div className="main"><div className="content" style={{ paddingTop: 90 }} role="status" aria-label="Loading"><Skel h={38} w="46%" r={12} /><Skel h={18} w="32%" style={{ marginTop: 14 }} /><div className="card pad" style={{ marginTop: 34, height: 300 }}><Skel w="30%" /><Skel h={44} style={{ marginTop: 20 }} /><Skel h={44} style={{ marginTop: 12 }} /><Skel h={44} style={{ marginTop: 12 }} /></div></div></div>
      </div>
    );
  }
  const nextTheme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const tabs = [["overview", "Overview"], ["attention", "Attention"], ["website", "Website"], ["social", "Social"]];
  return (
    <App.Provider value={ctx as any}>
      <div className={"shell" + (collapsed ? " collapsed" : "")}>
        <Sky hour={hour} dark={dark} />
        {drawer && <div className="scrim show-sm" style={{ zIndex: 29 }} onClick={() => setDrawer(false)} />}
        <Sidebar boot={boot} page={page} open={drawer} onNavigate={() => setDrawer(false)} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <div className="main">
          <header className={"topbar" + (scrolled ? " scrolled" : "")}>
            <div className="topbar-in">
              <div className={"topbar-title" + (titleShown ? " show" : "")} aria-hidden={!titleShown}>{title}</div>
              <span style={{ flex: 1 }} />
              <span className={"sync-pill hide-sm" + (syncing ? "" : " gone")} role="status" aria-live="polite">{syncing === "Up to date" ? <span style={{ color: "var(--good)", display: "flex" }}><Icon name="check" size={14} stroke={2.4} /></span> : <span className="spinner" />}{syncing || "Up to date"}</span>
              <ScopePicker boot={boot} scope={scope} setScope={setScope} />
              <button className="btn hide-sm" style={{ color: "var(--text-2)", fontWeight: 500, gap: 10 }} onClick={() => setPalette(true)} aria-label="Search or ask (Command K)"><Icon name="search" size={16} />Search<span className="kbd">⌘K</span></button>
              <button className="icon-btn show-sm" onClick={() => setPalette(true)} aria-label="Search or ask"><Icon name="search" size={19} /></button>
              <button className="icon-btn" onClick={() => setTheme(nextTheme)} aria-label={`Appearance: ${theme === "system" ? "automatic" : theme}. Switch to ${nextTheme === "system" ? "automatic" : nextTheme}`} title={theme === "system" ? "Automatic: light by day, dark at night" : `Appearance: ${theme}`}><Icon name={theme === "system" ? "auto" : theme === "light" ? "sun" : "moon"} size={19} /></button>
            </div>
          </header>
          <main className="content" id="main" key={pathname + boot.workspace.id}>{children}</main>
        </div>
        <nav className="tabbar glass" aria-label="Quick navigation">
          {tabs.map(([id, label]) => <Link key={id} href={hrefOf(id)} className={"tab" + (page === id ? " active" : "")} aria-current={page === id ? "page" : undefined}><Icon name={id} size={22} />{label}</Link>)}
          <button className={"tab" + (drawer ? " active" : "")} onClick={() => setDrawer((d) => !d)} aria-expanded={drawer} aria-label="All pages"><Icon name="menu" size={22} />More</button>
        </nav>
        {card && <CardSheet key={card.title} card={card} onClose={() => setCard(null)} />}
        {sheet && <ItemSheet key={sheet.id} id={sheet.id} from={sheet.from} onClose={() => setSheet(null)} />}
        {palette && <Palette boot={boot} onClose={() => setPalette(false)} setScope={setScope} />}
        {toastMsg && <div className="toast" key={toastMsg.n} role="status">{toastMsg.msg}</div>}
      </div>
    </App.Provider>
  );
}

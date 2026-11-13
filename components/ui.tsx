"use client";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, Illustration } from "./icons";
import { useApp } from "@/lib/client";
import { countTo } from "@/lib/motion";
import { ago, pctText } from "@/lib/format";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Segmented({ options, value, onChange, label, className = "" }: { options: { value: string; label: string; count?: number }[]; value: string; onChange: (v: any) => void; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const measure = () => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  };
  useIso(measure, [value, options.map((o) => o.label + (o.count ?? "")).join("|")]);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !ref.current) return;
    const ro = new ResizeObserver(measure); ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  const move = (dir: number) => { const i = options.findIndex((o) => o.value === value); const n = options[(i + dir + options.length) % options.length]; onChange(n.value); };
  return (
    <div className={"seg " + className} role="radiogroup" aria-label={label} ref={ref}
      onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); move(1); } if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); } }}>
      {thumb && <span className="seg-thumb" style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }} />}
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} tabIndex={o.value === value ? 0 : -1} className="seg-item" onClick={() => onChange(o.value)}>
          {o.label}{o.count != null && <span className="seg-count num">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="switch" onClick={() => onChange(!checked)} />;
}

export function Delta({ d }: { d: number | null | undefined }) {
  if (d == null) return null;
  const flat = Math.abs(d) < 0.02;
  return <span className={"delta num " + (flat ? "flat" : d > 0 ? "up" : "down")}>{flat ? "Steady" : pctText(d)}</span>;
}

export function Mark({ name, color, lg }: { name: string; color?: string; lg?: boolean }) {
  const letters = name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return <span className={"mark" + (lg ? " lg" : "")} style={{ background: `linear-gradient(145deg, color-mix(in srgb, ${color || "var(--accent)"} 80%, #fff), ${color || "var(--accent)"} 60%)` }} aria-hidden="true">{letters}</span>;
}

export function Skel({ h = 14, w = "100%", r = 8, style }: { h?: number | string; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}
export function SkelRows({ n = 4 }: { n?: number }) {
  return (
    <div className="card group" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div className="row" key={i}><Skel h={32} w={32} r={16} /><div className="row-main"><Skel w={`${58 - i * 7}%`} /><Skel w={`${36 + i * 5}%`} h={11} style={{ marginTop: 8 }} /></div><Skel w={64} h={22} r={11} /></div>
      ))}
    </div>
  );
}
export function SkelCards({ n = 4, h = 160, cols = "grid-2" }: { n?: number; h?: number; cols?: string }) {
  return <div className={cols} aria-hidden="true">{Array.from({ length: n }, (_, i) => <div className="card pad" key={i} style={{ height: h }}><Skel w="38%" h={12} /><Skel w="55%" h={30} style={{ marginTop: 14 }} /><Skel w="80%" h={11} style={{ marginTop: 16 }} /></div>)}</div>;
}

export function Empty({ art = "quiet", title, children }: { art?: "clear" | "connect" | "search" | "quiet"; title: string; children?: React.ReactNode }) {
  return <div className="empty"><Illustration name={art} /><div className="t-head" style={{ color: "var(--text)" }}>{title}</div>{children && <div style={{ maxWidth: "44ch" }}>{children}</div>}</div>;
}

/** Loads an endpoint, shows a skeleton first, then fades the real content in. */
export function Load({ q, skeleton, children }: { q: { data: any; error: string | null; loading: boolean; reload: () => void }; skeleton: React.ReactNode; children: (data: any) => React.ReactNode }) {
  if (q.error && !q.data) return <div className="card"><Empty art="connect" title="This did not load"><p>{q.error}</p><button className="btn tinted" style={{ marginTop: 10 }} onClick={q.reload}>Try again</button></Empty></div>;
  if (!q.data) return <div role="status" aria-label="Loading">{skeleton}</div>;
  return <div className="fade">{children(q.data)}</div>;
}

export function Page({ title, sub, actions, children, hideHead }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; hideHead?: boolean }) {
  const app = useApp();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { app.setTitle(title); app.setTitleShown(false); if (typeof document !== "undefined") document.title = `${title} · ${app.boot?.workspace?.brand?.name || "Keystone"}`; }, [title]);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => app.setTitleShown(!e.isIntersecting), { rootMargin: "-64px 0px 0px 0px" });
    io.observe(ref.current); return () => io.disconnect();
  }, []);
  return (
    <>
      <div ref={ref} className={hideHead ? "" : "page-head"}>
        {!hideHead && <><div style={{ minWidth: 0 }}><h1 className="large-title">{title}</h1>{sub && <p className="page-sub">{sub}</p>}</div>{actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}</>}
      </div>
      {children}
    </>
  );
}

export function Section({ title, action, children, i = 0 }: { title?: string; action?: React.ReactNode; children: React.ReactNode; i?: number }) {
  return <section className="rise" style={{ ["--i" as any]: i }}>{title && <div className="sec-head"><h2 className="sec-title">{title}</h2>{action}</div>}{children}</section>;
}

export function SampleTag({ show = true }: { show?: boolean }) {
  return show ? <span className="sample-tag" title="These are made-up examples, not your real data."><span className="dot" style={{ width: 6, height: 6 }} />Sample data</span> : null;
}
export function SourceLine({ source, at, extra }: { source: string; at?: number | null; extra?: string }) {
  return <p className="t-foot faint" style={{ padding: "10px 6px 0" }}>From {source}{at ? ` · updated ${ago(at)}` : ""}{extra ? ` · ${extra}` : ""}</p>;
}

export function Num({ value, format = (n: number) => Math.round(n).toLocaleString("en-US") }: { value: number | null | undefined; format?: (n: number) => string }) {
  const [shown, setShown] = useState<number | null>(value ?? null);
  const prev = useRef<number>(0);
  useEffect(() => {
    if (value == null) { setShown(null); return; }
    const stop = countTo(prev.current, value, 900, setShown);
    prev.current = value; return stop;
  }, [value]);
  if (value == null || shown == null) return <span className="faint">Unknown</span>;
  return <span className="num">{format(shown)}</span>;
}

export function Ring({ value, size = 112, stroke = 12, children, tone, id = "r" }: { value: number | null; size?: number; stroke?: number; children?: React.ReactNode; tone?: string; id?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const [v, setV] = useState(0);
  useEffect(() => { const t = setTimeout(() => setV(Math.max(0, Math.min(1, value ?? 0))), 60); return () => clearTimeout(t); }, [value]);
  const col = tone || "var(--accent)";
  return (
    <div className="kring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs><linearGradient id={"rg-" + id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={`color-mix(in srgb, ${col} 62%, #fff)`} /><stop offset="1" stopColor={col} /></linearGradient></defs>
        <circle className="kring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        {value != null && <circle className="kring-prog" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke={`url(#rg-${id})`} strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(v, 0.0001))} style={{ opacity: v > 0 ? 1 : 0 }} />}
      </svg>
      <div className="kring-center">{children}</div>
    </div>
  );
}

/** A button with a popover menu. Closes on outside click, Escape or after a choice. */
export function Menu({ button, children, align = "right", label, up }: { button: (p: { onClick: () => void; "aria-expanded": boolean; "aria-haspopup": "menu"; "aria-label"?: string }) => React.ReactNode; children: (close: () => void) => React.ReactNode; align?: "left" | "right"; label?: string; up?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); ref.current?.querySelector<HTMLElement>("button")?.focus(); } };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {button({ onClick: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": "menu", "aria-label": label })}
      {open && <div className={"menu " + align} role="menu" style={{ [up ? "bottom" : "top"]: "calc(100% + 8px)", [align]: 0, transformOrigin: `${up ? "bottom" : "top"} ${align}` }}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function Fold({ open, children }: { open: boolean; children: React.ReactNode }) {
  return <div className={"fold" + (open ? " open" : "")} aria-hidden={!open}><div>{children}</div></div>;
}

export const toneOfStatus = (s: string) => (/^not |^no /i.test(s) ? "" : /approved|done|connected|tested|pass|decided/i.test(s) ? "good" : /hold|error|overdue|unavailable|changes/i.test(s) ? "bad" : /review|waiting|proposed|manual|stale|progress|open/i.test(s) ? "warn" : "");
export function Status({ children }: { children: string }) { return <span className={"chip " + toneOfStatus(children)}>{children}</span>; }
export { Icon };

"use client";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { compact, dateShort, full } from "@/lib/format";

type Pt = { t: number; v: number };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    setW(ref.current.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current); return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** A soft curve through the points that never overshoots them. */
function smooth(p: [number, number][]) {
  if (p.length < 2) return "";
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[i + 1], mx = (x0 + x1) / 2;
    d += ` C${mx.toFixed(1)} ${y0.toFixed(1)} ${mx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

export function Spark({ data, height = 46, color = "var(--accent)" }: { data: Pt[]; height?: number; color?: string }) {
  const [ref, w] = useWidth();
  const id = useId().replace(/:/g, "");
  if (!data?.length) return <div ref={ref} style={{ height }} />;
  const max = Math.max(...data.map((d) => d.v)), min = Math.min(...data.map((d) => d.v));
  const pts = data.map((d, i) => [(i / (data.length - 1)) * w, 4 + (1 - (d.v - min) / (max - min || 1)) * (height - 12)] as [number, number]);
  const line = smooth(pts);
  return (
    <div ref={ref} style={{ height }} aria-hidden="true">
      {w > 0 && (
        <svg width={w} height={height} style={{ display: "block", overflow: "visible" }}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.2" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          <path d={`${line} L${w} ${height} L0 ${height} Z`} fill={`url(#${id})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 0, animation: "draw 1.1s cubic-bezier(.3,.7,.2,1) both" }} />
          <style>{"@keyframes draw{from{stroke-dashoffset:1}}"}</style>
        </svg>
      )}
    </div>
  );
}

/** Line with a faint fill. Drag or use the arrow keys to read exact values. */
export function AreaChart({ data, height = 240, label, unit = "", color = "var(--accent)" }: { data: Pt[]; height?: number; label: string; unit?: string; color?: string }) {
  const [ref, w] = useWidth();
  const id = useId().replace(/:/g, "");
  const [at, setAt] = useState<number | null>(null);
  const padL = 4, padR = 44, padT = 16, padB = 26;
  const geo = useMemo(() => {
    if (!data?.length || !w) return null;
    const max = Math.max(...data.map((d) => d.v)) * 1.08 || 1;
    const x = (i: number) => padL + (i / Math.max(1, data.length - 1)) * (w - padL - padR);
    const y = (v: number) => padT + (1 - v / max) * (height - padT - padB);
    const pts = data.map((d, i) => [x(i), y(d.v)] as [number, number]);
    const step = Math.pow(10, Math.floor(Math.log10(max / 2)));
    const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => max / s <= 3.2) || step * 10;
    const ticks = []; for (let t = nice; t < max; t += nice) ticks.push(t);
    return { x, y, pts, ticks, line: smooth(pts) };
  }, [data, w, height]);
  const pick = (clientX: number) => {
    if (!geo || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const i = Math.round(((clientX - r.left - padL) / (w - padL - padR)) * (data.length - 1));
    setAt(Math.max(0, Math.min(data.length - 1, i)));
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setAt((a) => Math.max(0, Math.min(data.length - 1, (a ?? data.length - 1) + (e.key === "ArrowLeft" ? -1 : 1)))); }
    if (e.key === "Escape") setAt(null);
  };
  const cur = at != null ? data[at] : null;
  const total = data.reduce((s, d) => s + d.v, 0);
  return (
    <div className="chart" ref={ref} style={{ height }} tabIndex={0} role="img" aria-label={`${label}: ${full(total)}${unit} over ${data.length} days. Use the left and right arrow keys to read each day.`}
      onPointerMove={(e) => pick(e.clientX)} onPointerDown={(e) => pick(e.clientX)} onPointerLeave={() => setAt(null)} onKeyDown={key} onBlur={() => setAt(null)}>
      {geo && (
        <svg width={w} height={height}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.2" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          {geo.ticks.map((t) => <g key={t}><line x1={padL} x2={w - padR} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--sep)" strokeDasharray="2 5" /><text className="axis" x={w - padR + 8} y={geo.y(t) + 4}>{compact(t)}</text></g>)}
          <line x1={padL} x2={w - padR} y1={height - padB} y2={height - padB} stroke="var(--sep)" />
          <path d={`${geo.line} L${geo.pts[geo.pts.length - 1][0]} ${height - padB} L${geo.pts[0][0]} ${height - padB} Z`} fill={`url(#${id})`} className="fade" />
          <path d={geo.line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} style={{ strokeDasharray: 1, animation: "draw 1.2s cubic-bezier(.3,.7,.2,1) both" }} />
          <style>{"@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}"}</style>
          {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i, n) => <text key={i} className="axis" x={geo.x(i)} y={height - 7} textAnchor={n === 0 ? "start" : n === 2 ? "end" : "middle"}>{dateShort(data[i].t)}</text>)}
          {cur == null && <circle cx={geo.pts[geo.pts.length - 1][0]} cy={geo.pts[geo.pts.length - 1][1]} r="4.500" fill={color} stroke="var(--card-solid)" strokeWidth="2" />}
          {cur != null && at != null && <g><line x1={geo.x(at)} x2={geo.x(at)} y1={padT - 6} y2={height - padB} stroke="var(--text-3)" strokeWidth="1" /><circle cx={geo.x(at)} cy={geo.y(cur.v)} r="5.500" fill={color} stroke="var(--card-solid)" strokeWidth="2.500" /></g>}
        </svg>
      )}
      {geo && cur != null && at != null && <div className="chart-tip num" style={{ left: Math.max(54, Math.min(w - 54, geo.x(at))), top: Math.max(30, geo.y(cur.v) - 12) }}>{full(cur.v)}{unit}<small>{new Date(cur.t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</small></div>}
    </div>
  );
}

export function HBars({ rows, format = compact }: { rows: { label: React.ReactNode; value: number; sub?: React.ReactNode; color?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex flex-col gap-3.5">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between gap-3" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 520, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <span className="num" style={{ fontSize: 14, fontWeight: 600, flex: "none" }}>{format(r.value)}{r.sub && <span className="faint" style={{ fontWeight: 500, marginLeft: 6 }}>{r.sub}</span>}</span>
          </div>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color, ["--i" as any]: i }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Small column set, e.g. views at 24h, 72h and 7 days. A missing checkpoint shows as "not yet", never as zero. */
export function Columns({ cols, height = 96 }: { cols: { label: string; value: number | null }[]; height?: number }) {
  const max = Math.max(...cols.map((c) => c.value || 0), 1);
  return (
    <div className="flex items-end gap-3" style={{ height: height + 40 }}>
      {cols.map((c, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5" style={{ height: "100%" }}>
          <span className="num" style={{ fontSize: 13, fontWeight: 600, color: c.value == null ? "var(--text-3)" : "var(--text)" }}>{c.value == null ? "Not yet" : compact(c.value)}</span>
          <div style={{ width: "100%", maxWidth: 56, height: c.value == null ? 6 : Math.max(6, (c.value / max) * height), borderRadius: "8px 8px 3px 3px", background: c.value == null ? "var(--fill)" : "var(--accent)", transformOrigin: "bottom", animation: "growy .9s var(--spring-smooth, ease-out) both", animationDelay: `${i * 70 + 100}ms` }} />
          <span className="t-cap">{c.label}</span>
        </div>
      ))}
      <style>{"@keyframes growy{from{transform:scaleY(0)}}"}</style>
    </div>
  );
}

export function Pips({ value, max = 5 }: { value: number; max?: number }) {
  return <span className={"pips" + (value <= 2 ? " low" : "")} role="img" aria-label={`${value} out of ${max}`}>{Array.from({ length: max }, (_, i) => <i key={i} className={i < value ? "on" : ""} />)}</span>;
}

/** Daily columns with rounded tops. Hover, drag or use the arrow keys to read a day; the latest day is the solid one. */
export function BarChart({ data, height = 250, label, unit = "", color = "var(--accent)" }: { data: Pt[]; height?: number; label: string; unit?: string; color?: string }) {
  const [ref, w] = useWidth();
  const [at, setAt] = useState<number | null>(null);
  const padL = 2, padR = 44, padT = 14, padB = 26;
  const geo = useMemo(() => {
    if (!data?.length || !w) return null;
    const max = Math.max(...data.map((d) => d.v)) * 1.08 || 1;
    const slot = (w - padL - padR) / data.length, bw = Math.max(3, Math.min(26, slot * 0.58));
    const x = (i: number) => padL + slot * (i + 0.5);
    const y = (v: number) => padT + (1 - v / max) * (height - padT - padB);
    const step = Math.pow(10, Math.floor(Math.log10(max / 2)));
    const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => max / s <= 3.2) || step * 10;
    const ticks = []; for (let t = nice; t < max; t += nice) ticks.push(t);
    return { x, y, bw, slot, ticks };
  }, [data, w, height]);
  const pick = (clientX: number) => {
    if (!geo || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setAt(Math.max(0, Math.min(data.length - 1, Math.floor((clientX - r.left - padL) / geo.slot))));
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setAt((a) => Math.max(0, Math.min(data.length - 1, (a ?? data.length - 1) + (e.key === "ArrowLeft" ? -1 : 1)))); }
    if (e.key === "Escape") setAt(null);
  };
  const cur = at != null ? data[at] : null;
  const total = data.reduce((s, d) => s + d.v, 0);
  const base = height - padB;
  return (
    <div className="chart" ref={ref} style={{ height }} tabIndex={0} role="img" aria-label={`${label}: ${full(total)}${unit} over ${data.length} days. Use the left and right arrow keys to read each day.`}
      onPointerMove={(e) => pick(e.clientX)} onPointerDown={(e) => pick(e.clientX)} onPointerLeave={() => setAt(null)} onKeyDown={key} onBlur={() => setAt(null)}>
      {geo && (
        <svg width={w} height={height}>
          {geo.ticks.map((t) => <g key={t}><line x1={padL} x2={w - padR} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--sep)" strokeDasharray="2 5" /><text className="axis" x={w - padR + 8} y={geo.y(t) + 4}>{compact(t)}</text></g>)}
          {data.map((d, i) => {
            const h = Math.max(2, base - geo.y(d.v)), r = Math.min(geo.bw / 2, 7, h);
            const on = at === i || (at == null && i === data.length - 1);
            const x0 = geo.x(i) - geo.bw / 2;
            return <path key={d.t} className="bar" d={`M${x0} ${base}V${base - h + r}a${r} ${r} 0 0 1 ${r}-${r}h${geo.bw - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V${base}Z`} fill={color} opacity={on ? 1 : at != null ? 0.26 : 0.4} style={{ animationDelay: `${i * 14}ms`, transformOrigin: `0 ${base}px` }} />;
          })}
          <line x1={padL} x2={w - padR} y1={base} y2={base} stroke="var(--sep)" />
          {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i, n) => <text key={i} className="axis" x={n === 0 ? padL : n === 2 ? w - padR : geo.x(i)} y={height - 7} textAnchor={n === 0 ? "start" : n === 2 ? "end" : "middle"}>{dateShort(data[i].t)}</text>)}
        </svg>
      )}
      {geo && cur != null && at != null && <div className="chart-tip num" style={{ left: Math.max(54, Math.min(w - 54, geo.x(at))), top: Math.max(30, geo.y(cur.v) - 12) }}>{full(cur.v)}{unit}<small>{new Date(cur.t).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</small></div>}
    </div>
  );
}

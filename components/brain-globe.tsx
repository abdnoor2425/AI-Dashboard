"use client";
// The Second Brain globe. Every file sits on the surface of a sphere, each project gathers into its own region,
// and each folder into a knot inside it. Pick a project and it opens flat: folders, files and everything it connects to.
// Drawn on a canvas so thousands of files stay smooth. Drag to turn it any way, pinch or use the buttons to zoom.
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Brain } from "@/lib/brain";
import { kindText, type Facts } from "@/lib/brain";

export type GlobeHandle = { zoom: (dir: number) => void; reset: () => void };
type Props = { brain: Brain; facts: Facts; focus: string | null; selected: string | null; paused: boolean; panel: boolean; onSelect: (id: string | null) => void; onFocus: (id: string | null) => void };

const INK = "#F7F3EA", CHORD = "#F1E6CF";
const rnd = (seed: number) => { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s ^= s >>> 16) >>> 0) / 4294967296); };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const FOCUS_R = 240, EXT_R = 350;

/** Where every file sits on the globe. Worked out once per index. */
function buildModel(brain: Brain, facts: Facts) {
  const n = brain.nodes.length;
  const index = new Map(brain.nodes.map((node, i) => [node.id, i]));
  const gx = new Float32Array(n), gy = new Float32Array(n), gz = new Float32Array(n), rad = new Float32Array(n);
  const color: string[] = new Array(n).fill(INK);
  const placed = new Uint8Array(n);
  const r = rnd(9);
  const gauss = () => (r() + r() + r() + r() - 2) * 1.73; // roughly a bell curve with spread 1
  const total = Math.max(1, facts.projects.reduce((a, p) => a + p.files + p.folders + 1, 0));
  facts.projects.forEach((p, pi) => {
    const N = facts.projects.length;
    const y = N === 1 ? 0 : 1 - (2 * (pi + 0.5)) / N, ring = Math.sqrt(1 - y * y), th = pi * 2.399963 + 0.4;
    const c = N === 1 ? [0, 0, 1] : [Math.cos(th) * ring, y, Math.sin(th) * ring];
    // A project's region grows with its share of the files.
    const share = (p.files + p.folders + 1) / total;
    const sd = Math.min(1.1, Math.max(0.1, 0.5 * Math.acos(Math.max(-1, 1 - 2 * share))));
    const put = (id: string, base: number[], spread: number, depth: number) => {
      const i = index.get(id); if (i == null || placed[i]) return;
      let x = base[0] + gauss() * spread, yy = base[1] + gauss() * spread, z = base[2] + gauss() * spread;
      if (!depth) { x = base[0]; yy = base[1]; z = base[2]; }
      const l = Math.hypot(x, yy, z) || 1; x /= l; yy /= l; z /= l;
      gx[i] = x; gy[i] = yy; gz[i] = z; placed[i] = 1; color[i] = facts.color.get(p.id) || INK;
      const node = brain.nodes[i];
      rad[i] = !depth ? 6.2 : node.kind === "folder" ? 3.7 : 2.1 + Math.min(2.6, (facts.degree.get(id) || 0) * 0.55);
      // Files gather around their folder, so each folder reads as a knot inside the project.
      for (const kid of facts.children.get(id) || []) if (brain.nodes[index.get(kid)!]?.project === p.id) put(kid, depth ? [x, yy, z] : c, depth ? sd * 0.62 : sd * 1.25, depth + 1);
    };
    put(p.id, c, 0, 0);
  });
  // Anything that is not inside a project (the WorkOS folder itself) is the core.
  const links = brain.links.map((l) => ({ a: index.get(l.source)!, b: index.get(l.target)!, kind: l.kind })).filter((l) => l.a != null && l.b != null);
  const neighbours = new Map<number, number[]>();
  for (const l of links) { (neighbours.get(l.a) || neighbours.set(l.a, []).get(l.a)!).push(l.b); (neighbours.get(l.b) || neighbours.set(l.b, []).get(l.b)!).push(l.a); }
  return { n, index, gx, gy, gz, rad, color, placed, links, neighbours };
}

/** A project opened flat: its folders and files as rings around it, with everything it connects to on the outside. */
function buildFocus(brain: Brain, facts: Facts, m: ReturnType<typeof buildModel>, project: string) {
  const fx = new Float32Array(m.n).fill(NaN), fy = new Float32Array(m.n).fill(NaN);
  const inside = new Uint8Array(m.n), external = new Uint8Array(m.n), depthOf = new Uint8Array(m.n), angleOf = new Float32Array(m.n);
  const root = m.index.get(project); if (root == null) return null;
  const kids = (id: string) => (facts.children.get(id) || []).filter((k) => brain.nodes[m.index.get(k)!]?.project === project);
  const leaves = new Map<string, number>();
  let maxDepth = 1;
  const count = (id: string, d: number): number => { maxDepth = Math.max(maxDepth, d); const ks = kids(id); const c = ks.length ? ks.reduce((a, k) => a + count(k, d + 1), 0) : 1; leaves.set(id, c); return c; };
  count(project, 0);
  const step = FOCUS_R / maxDepth;
  const lay = (id: string, a0: number, a1: number, d: number) => {
    const i = m.index.get(id)!; inside[i] = 1; depthOf[i] = d;
    const a = (a0 + a1) / 2; angleOf[i] = a;
    const ks = kids(id);
    fx[i] = Math.cos(a) * step * d; fy[i] = Math.sin(a) * step * d;
    let at = a0; const all = leaves.get(id) || 1;
    ks.forEach((k, j) => {
      const span = ((a1 - a0) * (leaves.get(k) || 1)) / all;
      lay(k, at, at + span, d + 1);
      // Crowded rings are staggered in and out so neighbouring files do not sit on top of each other.
      if (ks.length > 12 && !kids(k).length) { const ki = m.index.get(k)!, push = ((j % 3) - 1) * Math.min(16, step * 0.22), rr = step * (d + 1) + push; fx[ki] = Math.cos(angleOf[ki]) * rr; fy[ki] = Math.sin(angleOf[ki]) * rr; }
      at += span;
    });
  };
  lay(project, -Math.PI / 2, Math.PI * 1.5, 0);
  // Everything outside the project that it links to, or that links to it, goes on an outer ring near what it connects to.
  const ext: { i: number; a: number }[] = [];
  for (const l of m.links) {
    if (l.kind === "contains") continue;
    for (const [x, y] of [[l.a, l.b], [l.b, l.a]]) if (inside[x] && !inside[y] && !external[y] && m.placed[y]) { external[y] = 1; ext.push({ i: y, a: angleOf[x] }); }
  }
  ext.sort((p, q) => p.a - q.a);
  const gap = Math.min(0.2, (Math.PI * 2) / Math.max(1, ext.length));
  for (let pass = 0; pass < 3; pass++) for (let j = 1; j < ext.length; j++) if (ext[j].a - ext[j - 1].a < gap) ext[j].a = ext[j - 1].a + gap;
  ext.forEach((e, j) => { const rr = EXT_R + (ext.length > 26 ? (j % 2) * 22 : 0); fx[e.i] = Math.cos(e.a) * rr; fy[e.i] = Math.sin(e.a) * rr; angleOf[e.i] = e.a; });
  let files = 0; for (let i = 0; i < m.n; i++) if (inside[i] && brain.nodes[i].kind === "file") files++;
  return { fx, fy, inside, external, depthOf, angleOf, root, files, externals: ext.length };
}

export const Globe = forwardRef<GlobeHandle, Props>(function Globe({ brain, facts, focus, selected, paused, panel, onSelect, onFocus }, ref) {
  const wrap = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const model = useMemo(() => buildModel(brain, facts), [brain, facts]);
  const focusLay = useMemo(() => (focus ? buildFocus(brain, facts, model, focus) : null), [brain, facts, model, focus]);
  const [tip, setTip] = useState<{ x: number; y: number; name: string; sub: string } | null>(null);
  // Everything that changes every frame lives here, outside React, so turning the globe never re-renders the page.
  const S = useRef({ yaw: 0.6, pitch: 0.28, zoom: 1, panX: 0, panY: 0, t: 0, hover: -1, drag: null as null | { x: number; y: number; yaw: number; pitch: number; panX: number; panY: number; moved: boolean }, turn: null as null | { yaw: number; pitch: number }, lay: null as ReturnType<typeof buildFocus>, sx: new Float32Array(0), sy: new Float32Array(0), al: new Float32Array(0), sr: new Float32Array(0) });
  const P = useRef({ focus, selected, paused, panel, onSelect, onFocus });
  P.current = { focus, selected, paused, panel, onSelect, onFocus };
  if (focusLay) S.current.lay = focusLay; // kept while closing, so the project folds back into the globe

  useImperativeHandle(ref, () => ({
    zoom: (dir) => { S.current.zoom = Math.min(3.2, Math.max(0.6, S.current.zoom * (dir > 0 ? 1.25 : 0.8))); },
    reset: () => { Object.assign(S.current, { zoom: 1, panX: 0, panY: 0, turn: { yaw: 0.6, pitch: 0.28 } }); },
  }), []);

  // Opening a project or changing index starts from a clean, centred view.
  useEffect(() => { S.current.panX = 0; S.current.panY = 0; S.current.zoom = 1; }, [focus, model]);
  // Picking a file on the globe turns it to face you.
  useEffect(() => {
    if (focus || !selected) return;
    const i = model.index.get(selected); if (i == null || !model.placed[i]) return;
    const x = model.gx[i], y = model.gy[i], z = model.gz[i];
    const yaw = -Math.atan2(x, z), z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    S.current.turn = { yaw, pitch: Math.max(-1.1, Math.min(1.1, Math.atan2(y, z1))) };
  }, [selected, focus, model]);

  useEffect(() => {
    const cv = canvas.current!, box = wrap.current!, ctx = cv.getContext("2d")!;
    const still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const m = model, s = S.current;
    s.sx = new Float32Array(m.n); s.sy = new Float32Array(m.n); s.al = new Float32Array(m.n); s.sr = new Float32Array(m.n);
    const order = Array.from({ length: m.n }, (_, i) => i), depth = new Float32Array(m.n), lit = new Uint8Array(m.n);
    let w = 0, h = 0, raf = 0, last = performance.now();
    const size = () => { const d = Math.min(2, window.devicePixelRatio || 1); w = box.clientWidth; h = box.clientHeight; cv.width = Math.round(w * d); cv.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(size) : null; ro?.observe(box);

    const frame = (now: number) => {
      const dt = Math.min(64, now - last); last = now;
      const p = P.current, lay = s.lay;
      const open = !!p.focus && !!lay;
      s.t = still ? (open ? 1 : 0) : Math.max(0, Math.min(1, s.t + (open ? dt : -dt) / 700));
      const e = ease(s.t);
      if (s.turn) { const dy = Math.atan2(Math.sin(s.turn.yaw - s.yaw), Math.cos(s.turn.yaw - s.yaw)), dp = s.turn.pitch - s.pitch; s.yaw += dy * Math.min(1, dt / 220); s.pitch += dp * Math.min(1, dt / 220); if (Math.abs(dy) + Math.abs(dp) < 0.002) s.turn = null; }
      else if (!still && !p.paused && !s.drag && !p.focus && !p.selected && s.hover < 0) s.yaw += dt * 0.00007;

      const room = p.panel && w > 900 ? w - 372 : w; // leave space for the side panel
      const gcx = w / 2 + (room / 2 - w / 2) * Math.max(e, p.selected && w > 900 ? 1 : 0), cy = h / 2 + 12;
      const R = Math.min(room, h) * 0.365 * (e > 0 ? 1 : s.zoom) * (1 - e * 0.12);
      const fs = Math.min(room / (2 * (EXT_R + 178)), (h - 20) / (2 * (EXT_R + 50))) * s.zoom; // room for names on both sides
      const cy0 = Math.cos(s.yaw), sy0 = Math.sin(s.yaw), cp = Math.cos(s.pitch), sp = Math.sin(s.pitch);
      const sel = p.selected ? m.index.get(p.selected) ?? -1 : -1;
      const mark = s.hover >= 0 ? s.hover : sel;
      lit.fill(0); if (mark >= 0) { lit[mark] = 2; for (const j of m.neighbours.get(mark) || []) if (!lit[j]) lit[j] = 1; }

      for (let i = 0; i < m.n; i++) {
        const x = m.gx[i], y = m.gy[i], z = m.gz[i];
        const x1 = x * cy0 + z * sy0, z1 = -x * sy0 + z * cy0, y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        const k = 1 / (1 - z2 * 0.22), f = (z2 + 1) / 2;
        let px = gcx + x1 * R * k + (e > 0 ? 0 : s.panX), py = cy - y1 * R * k + (e > 0 ? 0 : s.panY), a = m.placed[i] ? 0.2 + f * 0.8 : 0, rr = m.rad[i] * (0.62 + f * 0.6) * Math.sqrt(e > 0 ? 1 : s.zoom);
        depth[i] = z2;
        if (e > 0 && lay) {
          if (lay.inside[i] || lay.external[i]) {
            px += (gcx + lay.fx[i] * fs + s.panX - px) * e; py += (cy + lay.fy[i] * fs + s.panY - py) * e; a += (1 - a) * e;
            const target = i === lay.root ? 13 : lay.external[i] ? 5.2 : brain.nodes[i].kind === "folder" ? 6.2 : Math.max(2.6, Math.min(4.6, m.rad[i] * 1.15));
            rr += (target * Math.max(0.8, Math.min(1.5, fs * 1.2)) - rr) * e; depth[i] = 2 + (i === lay.root ? 1 : 0);
          } else a *= 1 - e * 0.93;
        } else if (mark >= 0 && !lit[i]) a *= 0.3;
        if (lit[i]) { a = 1; rr *= lit[i] === 2 ? 1.7 : 1.25; }
        s.sx[i] = px; s.sy[i] = py; s.al[i] = a; s.sr[i] = rr;
      }

      ctx.clearRect(0, 0, w, h);
      // Halo, orbit rings and the core where everything meets.
      const calm = 1 - e * 0.75, ox = gcx + (e > 0 ? 0 : s.panX), oy = cy + (e > 0 ? 0 : s.panY);
      let g = ctx.createRadialGradient(ox, oy, R * 0.6, ox, oy, R * 1.34); g.addColorStop(0, "rgba(61,107,181,0)"); g.addColorStop(0.62, `rgba(61,107,181,${0.17 * calm})`); g.addColorStop(1, "rgba(61,107,181,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, R * 1.34, 0, 7); ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = `rgba(224,182,99,${0.2 * calm})`; ctx.beginPath(); ctx.ellipse(ox, oy, R * 1.34, R * 0.4, -0.42, 0, 7); ctx.stroke();
      ctx.strokeStyle = `rgba(240,225,190,${0.07 * calm})`; ctx.beginPath(); ctx.ellipse(ox, oy, R * 1.2, R * 1.08, 0.3, 0, 7); ctx.stroke();
      const cr = R * 0.085;
      g = ctx.createRadialGradient(ox, oy, 0, ox, oy, cr * 2.9); g.addColorStop(0, `rgba(255,243,210,${0.85 * calm})`); g.addColorStop(0.3, `rgba(224,182,99,${0.42 * calm})`); g.addColorStop(1, "rgba(224,182,99,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, cr * 2.9, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(255,243,210,${0.5 * calm})`; ctx.lineWidth = 0.7;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(ox, oy, Math.abs(Math.cos(s.yaw * 1.4 + (i * Math.PI) / 4)) * cr + 0.5, cr, 0, 0, 7); ctx.stroke(); }
      for (const yy of [-0.5, 0, 0.5]) { const rx = Math.sqrt(1 - yy * yy) * cr; ctx.beginPath(); ctx.ellipse(ox, oy + yy * cr, rx, rx * 0.3, 0, 0, 7); ctx.stroke(); }

      // Connections. Lines inside a project take its colour; links between files are ivory; the ones you point at light up.
      for (const l of m.links) {
        const a = l.a, b = l.b;
        let al = Math.min(s.al[a], s.al[b]); if (al < 0.03) continue;
        const hot = mark >= 0 && (a === mark || b === mark);
        const inF = e > 0 && lay ? (lay.inside[a] || lay.external[a]) && (lay.inside[b] || lay.external[b]) : false;
        let stroke = CHORD, lw = 0.55;
        if (l.kind === "contains") { stroke = m.color[b]; al *= inF ? 0.42 : 0.5; lw = 0.75; if (!m.placed[a]) continue; }
        else if (inF && lay) { const out = lay.external[a] ? a : lay.external[b] ? b : -1; stroke = out >= 0 ? m.color[out] : CHORD; al *= out >= 0 ? 0.62 : 0.34; lw = out >= 0 ? 1.1 : 0.7; }
        else al *= 0.2;
        if (hot) { al = 0.95; lw = 1.7; if (l.kind !== "contains") stroke = m.color[a === mark ? b : a]; }
        else if (mark >= 0) al *= 0.5;
        ctx.globalAlpha = al; ctx.strokeStyle = stroke; ctx.lineWidth = lw;
        if (l.kind === "mention" && (hot || inF)) ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(s.sx[a], s.sy[a]);
        if (inF && l.kind !== "contains") ctx.quadraticCurveTo(gcx + s.panX + ((s.sx[a] + s.sx[b]) / 2 - gcx - s.panX) * 0.55, cy + s.panY + ((s.sy[a] + s.sy[b]) / 2 - cy - s.panY) * 0.55, s.sx[b], s.sy[b]);
        else ctx.lineTo(s.sx[b], s.sy[b]);
        ctx.stroke(); ctx.setLineDash([]);
      }
      // Files, back to front.
      order.sort((a, b) => depth[a] - depth[b]);
      for (const i of order) {
        const al = s.al[i]; if (al < 0.03) continue;
        const rr = s.sr[i];
        if ((m.rad[i] > 3.4 || lit[i]) && al > 0.55) { ctx.globalAlpha = al * 0.17; ctx.fillStyle = m.color[i]; ctx.beginPath(); ctx.arc(s.sx[i], s.sy[i], rr * 2.3, 0, 7); ctx.fill(); }
        ctx.globalAlpha = al; ctx.fillStyle = m.color[i]; ctx.beginPath(); ctx.arc(s.sx[i], s.sy[i], rr, 0, 7); ctx.fill();
        if (lit[i] === 2 || (e > 0.5 && lay && i === lay.root)) { ctx.strokeStyle = "#FFF6DD"; ctx.lineWidth = 2; ctx.stroke(); }
      }
      // Names. Projects on the globe; folders, files and outside connections once a project is open.
      const taken: number[][] = [];
      const label = (text: string, x: number, y: number, align: CanvasTextAlign, font: string, al: number, sub?: string, force?: boolean) => {
        if (al < 0.05) return; ctx.font = font;
        const tw = ctx.measureText(text).width, x0 = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x, box = [x0 - 4, y - 13, x0 + tw + 4, y + (sub ? 19 : 5)];
        if (!force && taken.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return;
        taken.push(box); ctx.globalAlpha = al; ctx.textAlign = align; ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(10,22,48,0.9)"; ctx.lineWidth = 4; ctx.strokeText(text, x, y); ctx.fillStyle = INK; ctx.fillText(text, x, y);
        if (sub) { ctx.font = "600 10px Inter, system-ui, sans-serif"; ctx.strokeText(sub, x, y + 14); ctx.fillStyle = "rgba(240,230,205,0.6)"; ctx.fillText(sub, x, y + 14); }
      };
      const F = "Inter, system-ui, sans-serif";
      if (e > 0.5 && lay) {
        const al = (e - 0.5) * 2, r0 = lay.root, pn = brain.nodes[r0];
        label(pn.name, s.sx[r0], s.sy[r0] + s.sr[r0] + 22, "center", "600 17px Newsreader, Georgia, serif", al, undefined, true);
        const side = (i: number, sub?: string, bold?: boolean) => { const right = Math.cos(lay.angleOf[i]) >= 0; label(brain.nodes[i].name, s.sx[i] + (right ? s.sr[i] + 7 : -s.sr[i] - 7), s.sy[i] + 4, right ? "left" : "right", `${bold ? 600 : 500} ${bold ? 13 : 12}px ${F}`, al, sub); };
        if (mark >= 0 && mark !== r0 && (lay.inside[mark] || lay.external[mark])) side(mark, lay.external[mark] ? facts.projectById.get(brain.nodes[mark].project)?.name : undefined, true);
        for (let i = 0; i < m.n; i++) if (lay.external[i] && i !== mark) side(i, facts.projectById.get(brain.nodes[i].project)?.name?.toUpperCase());
        for (let i = 0; i < m.n; i++) if (lay.inside[i] && i !== r0 && i !== mark && brain.nodes[i].kind === "folder") side(i, undefined, true);
        if (lay.files <= 60 || s.zoom > 1.5 || mark >= 0) for (let i = 0; i < m.n; i++) if (lay.inside[i] && brain.nodes[i].kind === "file" && i !== mark && (lay.files <= 60 || s.zoom > 1.5 || lit[i])) side(i);
      } else if (e < 0.5) {
        const al = 1 - e * 2;
        if (mark >= 0) { label(brain.nodes[mark].name, s.sx[mark] + s.sr[mark] + 8, s.sy[mark] + 4, "left", `600 13px ${F}`, al, undefined, true); let shown = 0; for (const j of m.neighbours.get(mark) || []) if (shown++ < 14) label(brain.nodes[j].name, s.sx[j] + s.sr[j] + 7, s.sy[j] + 4, "left", `500 12px ${F}`, al * 0.95); }
        const names = facts.projects.map((pr) => m.index.get(pr.id)!).filter((i) => i != null && depth[i] > -0.15).sort((a, b) => depth[b] - depth[a]);
        try { (ctx as any).letterSpacing = "1px"; } catch {}
        for (const i of names) label(brain.nodes[i].name.toUpperCase(), s.sx[i], s.sy[i] - s.sr[i] - 9, "center", `600 12px ${F}`, al * Math.min(1, 0.35 + (depth[i] + 0.15) * 1.3) * (mark >= 0 && !lit[i] ? 0.45 : 1));
        try { (ctx as any).letterSpacing = "0px"; } catch {}
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const at = (ev: PointerEvent | MouseEvent) => { const b = cv.getBoundingClientRect(); return { x: ev.clientX - b.left, y: ev.clientY - b.top }; };
    const hit = (x: number, y: number) => { let best = -1, bd = 1e9; for (let i = 0; i < m.n; i++) { if (s.al[i] < 0.3) continue; const d = Math.hypot(s.sx[i] - x, s.sy[i] - y) - s.sr[i]; if (d < 9 && d - s.al[i] * 4 < bd) { bd = d - s.al[i] * 4; best = i; } } return best; };
    const down = (ev: PointerEvent) => { const q = at(ev); s.drag = { x: q.x, y: q.y, yaw: s.yaw, pitch: s.pitch, panX: s.panX, panY: s.panY, moved: false }; s.turn = null; cv.setPointerCapture?.(ev.pointerId); };
    const move = (ev: PointerEvent) => {
      const q = at(ev);
      if (s.drag) {
        const dx = q.x - s.drag.x, dy = q.y - s.drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) s.drag.moved = true;
        if (P.current.focus) { s.panX = s.drag.panX + dx; s.panY = s.drag.panY + dy; }
        else { s.yaw = s.drag.yaw + dx * 0.006; s.pitch = Math.max(-1.25, Math.min(1.25, s.drag.pitch + dy * 0.006)); }
        return;
      }
      const i = hit(q.x, q.y);
      if (i !== s.hover) {
        s.hover = i; cv.style.cursor = i >= 0 ? "pointer" : "grab";
        const node = i >= 0 ? brain.nodes[i] : null;
        setTip(node ? { x: s.sx[i], y: s.sy[i] - s.sr[i] - 12, name: node.name, sub: node.id === node.project ? `Project · ${facts.projectById.get(node.id)?.files ?? 0} files · click to open` : `${kindText(node)} · ${facts.projectById.get(node.project)?.name || ""}` } : null);
      }
    };
    const up = (ev: PointerEvent) => {
      const d = s.drag; s.drag = null; if (!d || d.moved) return;
      const q = at(ev), i = hit(q.x, q.y), p = P.current;
      if (i < 0) { p.onSelect(null); return; }
      const node = brain.nodes[i];
      // A project on the globe opens. Anything else shows its details.
      if (!p.focus && node.id === node.project && facts.projectById.has(node.id)) p.onFocus(node.id); else p.onSelect(node.id);
    };
    const leave = () => { if (s.hover >= 0) { s.hover = -1; setTip(null); } };
    const wheel = (ev: WheelEvent) => { if (!ev.ctrlKey && !ev.metaKey) return; ev.preventDefault(); s.zoom = Math.min(3.2, Math.max(0.6, s.zoom * (ev.deltaY < 0 ? 1.08 : 0.93))); };
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move); cv.addEventListener("pointerup", up); cv.addEventListener("pointerleave", leave); cv.addEventListener("wheel", wheel, { passive: false });
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointerleave", leave); cv.removeEventListener("wheel", wheel); };
  }, [model, brain, facts]);

  return (
    <div className="brain-stage" ref={wrap}>
      <canvas ref={canvas} className="brain-canvas" role="img" aria-label={`Your WorkOS as a globe: ${facts.projects.length} projects and ${facts.files.length} files, with their connections`} />
      {tip && <div className="brain-tip" style={{ left: tip.x, top: tip.y }}><b>{tip.name}</b><span>{tip.sub}</span></div>}
    </div>
  );
});

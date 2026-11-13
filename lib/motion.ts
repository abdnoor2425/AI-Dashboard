// Our own motion code: a small spring solver that turns real spring physics
// into CSS `linear()` easings, plus a few helpers built on the Web Animations API.
// No animation library is used anywhere in the app.

export interface SpringConfig { stiffness?: number; damping?: number; mass?: number }

/** Simulate a damped spring from 0 to 1 and return sampled positions and the time it takes to settle. */
export function solveSpring({ stiffness = 170, damping = 26, mass = 1 }: SpringConfig = {}) {
  const dt = 1 / 240;
  let x = 0, v = 0, t = 0;
  const points: number[] = [0];
  let settledFor = 0;
  while (t < 3 && settledFor < 0.08) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt; x += v * dt; t += dt;
    points.push(x);
    settledFor = Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01 ? settledFor + dt : 0;
  }
  return { points, duration: Math.round(t * 1000) };
}

/** A spring as a CSS easing string, e.g. `linear(0, 0.12 4%, ...)`. */
export function springEasing(config: SpringConfig = {}, samples = 40) {
  const { points, duration } = solveSpring(config);
  const step = Math.max(1, Math.floor(points.length / samples));
  const stops: string[] = [];
  for (let i = 0; i < points.length; i += step) stops.push(`${points[i].toFixed(4)} ${((i / (points.length - 1)) * 100).toFixed(1)}%`);
  stops.push("1 100%");
  return { easing: `linear(${stops.join(", ")})`, duration };
}

export const SPRINGS = {
  /** Sheets, cards opening: quick, no overshoot. */
  smooth: springEasing({ stiffness: 260, damping: 32 }),
  /** Small controls: a touch of life. */
  snappy: springEasing({ stiffness: 420, damping: 30 }),
  /** The ring and playful accents: a gentle overshoot. */
  bouncy: springEasing({ stiffness: 180, damping: 15 }),
};

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Publish the springs as CSS variables so stylesheets can use them in transitions. */
export function installMotion(root: HTMLElement = document.documentElement) {
  for (const [name, s] of Object.entries(SPRINGS)) {
    root.style.setProperty(`--spring-${name}`, s.easing);
    root.style.setProperty(`--spring-${name}-ms`, s.duration + "ms");
  }
}

type RectLike = { left: number; top: number; width: number; height: number };

/** FLIP: make `el` appear to grow out of `from` (for example a list row turning into a sheet). */
export function growFrom(el: HTMLElement, from: RectLike | null, opts: { radius?: number } = {}) {
  if (!el.animate) return null;
  if (prefersReducedMotion() || !from) return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
  const to = el.getBoundingClientRect();
  const sx = from.width / to.width, sy = from.height / to.height;
  const dx = from.left - to.left, dy = from.top - to.top;
  const s = SPRINGS.smooth;
  return el.animate(
    [
      { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.4, borderRadius: `${(opts.radius ?? 16) / sx}px / ${(opts.radius ?? 16) / sy}px` },
      { transformOrigin: "0 0", transform: "none", opacity: 1 },
    ],
    { duration: s.duration, easing: s.easing },
  );
}

/** The reverse: shrink back towards where it came from. Resolves when finished. */
export function shrinkTo(el: HTMLElement, to: RectLike | null): Promise<void> {
  if (!el.animate) return Promise.resolve();
  const anim = prefersReducedMotion() || !to
    ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-in", fill: "forwards" })
    : (() => {
        const from = el.getBoundingClientRect();
        return el.animate(
          [{ transformOrigin: "0 0", transform: "none", opacity: 1 }, { transformOrigin: "0 0", transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: 0 }],
          { duration: 260, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
        );
      })();
  return anim.finished.then(() => undefined, () => undefined);
}

/** Count a number up from its previous value with an ease-out curve. Calls `onFrame` with each value. */
export function countTo(from: number, to: number, ms: number, onFrame: (v: number) => void) {
  if (prefersReducedMotion() || from === to || typeof requestAnimationFrame === "undefined") { onFrame(to); return () => {}; }
  let raf = 0; const start = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - p, 4);
    onFrame(from + (to - from) * eased);
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/** The sky: the page background moves through dawn, day, sunset and night with the clock.
 *  Returns four gradient colours (top to bottom), a glow colour, and how much cloud, star and sun position to show. */
export type SkyPhase = "dawn" | "day" | "sunset" | "night";
export const SKY_HOURS: Record<SkyPhase, number> = { dawn: 6.5, day: 13, sunset: 18.2, night: 23 };
type Stop = [number, string[], string, number, number]; // hour, 4 colours, glow, cloud, stars
const NIGHT_L: Stop = [0, ["#8FA0E8", "#B3BEF2", "#D6DBF8", "#EEF0FC"], "#C9B8FF", 0.25, 0.55];
const NIGHT_D: Stop = [0, ["#040818", "#081030", "#0C1840", "#070B22"], "#3A4FC0", 0, 1];
const at = (h: number, s: Stop): Stop => [h, s[1], s[2], s[3], s[4]];
const SKY: Record<"light" | "dark", Stop[]> = {
  light: [
    NIGHT_L, at(5, NIGHT_L),
    [6.5, ["#FFB59E", "#FFD3BF", "#E6E4FA", "#F4F2FD"], "#FFD9A8", 0.5, 0],
    [9, ["#8CC3FF", "#B4D8FF", "#DCEBFF", "#F0F6FF"], "#FFF3D1", 0.6, 0],
    [13, ["#7DB9FF", "#A9D2FF", "#D6E9FF", "#EEF5FF"], "#FFFFFF", 0.65, 0],
    [16.5, ["#86BBFA", "#B6D4FA", "#E2E9FA", "#F3F4FB"], "#FFE9C4", 0.55, 0],
    [18.2, ["#F79B7C", "#FBC3A6", "#EFD3EC", "#F6EFF9"], "#FFC38A", 0.45, 0],
    at(20, NIGHT_L), at(24, NIGHT_L),
  ],
  dark: [
    NIGHT_D, at(5, NIGHT_D),
    [6.5, ["#3B2A63", "#7A4470", "#27306B", "#0D1230"], "#FF9E7A", 0.05, 0.3],
    [9, ["#0F3F9A", "#12348A", "#0F2666", "#0A1740"], "#5AA0FF", 0.07, 0],
    [13, ["#124AAE", "#143C94", "#10296C", "#0A1844"], "#7DB9FF", 0.08, 0],
    [16.5, ["#143C94", "#1A2F80", "#141F5C", "#0B143C"], "#6C8CFF", 0.06, 0],
    [18.2, ["#6A2F6E", "#9A4460", "#2C1F63", "#120F33"], "#FF8A5C", 0.05, 0.25],
    at(20, NIGHT_D), at(24, NIGHT_D),
  ],
};
const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const lerp = (a: string, b: string, p: number) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * p)).join(" ")})`; };
export function skyAt(hour: number, dark: boolean) {
  const stops = SKY[dark ? "dark" : "light"];
  let i = 0;
  while (i < stops.length - 2 && hour >= stops[i + 1][0]) i++;
  const a = stops[i], b = stops[i + 1], p = Math.max(0, Math.min(1, (hour - a[0]) / (b[0] - a[0] || 1)));
  // The sun (or moon) crosses from left to right during the day and rests high on the right at night.
  const day = Math.max(0, Math.min(1, (hour - 5.5) / 14));
  const isDay = hour >= 5.5 && hour <= 19.5;
  return {
    colors: a[1].map((c, n) => lerp(c, b[1][n], p)), glow: lerp(a[2], b[2], p),
    cloud: a[3] + (b[3] - a[3]) * p, stars: a[4] + (b[4] - a[4]) * p,
    x: isDay ? 8 + day * 78 : 78, y: isDay ? 34 - Math.sin(day * Math.PI) * 44 : -8,
    phase: (hour < 5 || hour >= 19.5 ? "night" : hour < 8 ? "dawn" : hour < 17 ? "day" : "sunset") as SkyPhase,
  };
}
/** In the automatic theme the app is light by day and dark at night. */
export const darkAtHour = (hour: number) => hour >= 19.5 || hour < 5.5;

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
 *  It is a still paper field (ivory by day, ink navy at night); only its tint and a soft glow change.
 *  Returns four gradient colours (top to bottom), a glow colour, how many stars to show, and where the glow sits. */
export type SkyPhase = "dawn" | "day" | "sunset" | "night";
export const SKY_HOURS: Record<SkyPhase, number> = { dawn: 6.5, day: 13, sunset: 18.2, night: 23 };
type Stop = [number, string[], string, number]; // hour, 4 colours, glow, stars
const NIGHT_L: Stop = [0, ["#E6E5EA", "#EBEAEC", "#EEEDEC", "#EAE8E3"], "#BFC8E4", 0];
const NIGHT_D: Stop = [0, ["#070D1A", "#0A1222", "#0B1424", "#080F1C"], "#2E4478", 0.6];
const at = (h: number, s: Stop): Stop => [h, s[1], s[2], s[3]];
const SKY: Record<"light" | "dark", Stop[]> = {
  light: [
    NIGHT_L, at(5, NIGHT_L),
    [6.5, ["#F3E1D8", "#F4E9E2", "#F2EDE7", "#EDE8E0"], "#F0C2AC", 0],
    [9, ["#F2ECE1", "#F3EFE7", "#F1EEE7", "#ECE8DF"], "#EBD8B0", 0],
    [13, ["#F2EEE6", "#F3F0E9", "#F0ECE4", "#EAE5DB"], "#E6CF9E", 0],
    [16.5, ["#F3EADB", "#F3EDE2", "#F0EBE2", "#EAE4D8"], "#E8C48C", 0],
    [18.2, ["#F0D2BD", "#F2DFCE", "#EFE6DD", "#EAE2D6"], "#E39A68", 0],
    at(20, NIGHT_L), at(24, NIGHT_L),
  ],
  dark: [
    NIGHT_D, at(5, NIGHT_D),
    [6.5, ["#1E1A2C", "#17182A", "#0F1526", "#0A1120"], "#7E5662", 0.2],
    [9, ["#0F1B31", "#0E182C", "#0C1526", "#0A1120"], "#4A6290", 0],
    [13, ["#11203A", "#0F1B31", "#0C1628", "#0A1120"], "#5A76A8", 0],
    [16.5, ["#14203A", "#111B30", "#0D1628", "#0A1120"], "#7A6E78", 0],
    [18.2, ["#251A2A", "#1B1828", "#0F1526", "#0A1120"], "#9C6A48", 0.2],
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
    stars: a[3] + (b[3] - a[3]) * p,
    x: isDay ? 8 + day * 78 : 78, y: isDay ? 34 - Math.sin(day * Math.PI) * 44 : -8,
    phase: (hour < 5 || hour >= 19.5 ? "night" : hour < 8 ? "dawn" : hour < 17 ? "day" : "sunset") as SkyPhase,
  };
}
/** In the automatic theme the app is light by day and dark at night. */
export const darkAtHour = (hour: number) => hour >= 19.5 || hour < 5.5;

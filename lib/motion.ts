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

/** Daylight: background tints that drift from warm morning to cool evening. Returns three colours for the hour. */
export function daylight(hour: number): [string, string, string] {
  const stops: [number, [number, number, number][]][] = [
    [0, [[232, 60, 62], [262, 55, 66], [215, 60, 60]]],   // night: indigo and violet
    [6, [[28, 95, 78], [345, 85, 82], [48, 95, 80]]],     // dawn: peach and rose
    [10, [[45, 95, 80], [190, 80, 80], [20, 90, 82]]],    // morning: warm sun, first blue
    [14, [[205, 90, 78], [175, 70, 78], [230, 85, 82]]],  // afternoon: clear sky
    [18, [[18, 95, 76], [330, 80, 78], [265, 75, 80]]],   // sunset: amber into lilac
    [21, [[250, 70, 72], [290, 60, 74], [215, 75, 70]]],  // evening: cool violet
    [24, [[232, 60, 62], [262, 55, 66], [215, 60, 60]]],
  ];
  let i = 0;
  while (i < stops.length - 2 && hour >= stops[i + 1][0]) i++;
  const [h0, a] = stops[i], [h1, b] = stops[i + 1];
  const p = (hour - h0) / (h1 - h0);
  // Blend in RGB, not around the hue wheel, so sun-yellow to sky-blue passes through soft neutrals instead of green.
  const rgb = ([h, sat, l]: [number, number, number]) => {
    const s1 = sat / 100, l1 = l / 100, k = (n: number) => (n + h / 30) % 12, a1 = s1 * Math.min(l1, 1 - l1);
    return [0, 8, 4].map((n) => 255 * (l1 - a1 * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  };
  const mix = (x: [number, number, number], y: [number, number, number]) => {
    const c0 = rgb(x), c1 = rgb(y);
    return `rgb(${c0.map((v, n) => Math.round(v + (c1[n] - v) * p)).join(" ")})`;
  };
  return [mix(a[0], b[0]), mix(a[1], b[1]), mix(a[2], b[2])];
}

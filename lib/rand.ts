// Small deterministic helpers so sample data is stable between reloads.
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const DAY = 86400000;
export const HOUR = 3600000;
export function startOfDay(t: number) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
/** A believable daily series: weekly rhythm, slow trend, a little noise. Indexed by absolute day so it never reshuffles. */
export function series(key: string, base: number, growth: number, days: number, now: number, wobble = 0.16): { t: number; v: number }[] {
  const end = Math.floor(startOfDay(now) / DAY);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = end - i;
    const r = rng(hash(key + ":" + day))();
    const dow = new Date(day * DAY + DAY / 2).getDay();
    const week = dow === 0 || dow === 6 ? 0.72 : 1 + (dow === 2 || dow === 3 ? 0.08 : 0);
    const trend = 1 + growth * (1 - i / 90);
    const wave = 1 + 0.06 * Math.sin(day / 9);
    out.push({ t: day * DAY, v: Math.max(0, Math.round(base * week * trend * wave * (1 - wobble / 2 + r * wobble))) });
  }
  return out;
}
export const sum = (a: { v: number }[]) => a.reduce((s, x) => s + x.v, 0);
export function pct(now: number, prev: number): number | null { return prev ? (now - prev) / prev : null; }

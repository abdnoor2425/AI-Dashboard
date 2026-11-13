import { DAY, HOUR, startOfDay } from "./rand.ts";

export const full = (n: number | null | undefined) => (n == null ? "Unknown" : Math.round(n).toLocaleString("en-US"));
export function compact(n: number | null | undefined): string {
  if (n == null) return "Unknown";
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "k";
  return Math.round(n).toLocaleString("en-US");
}
export function withUnit(n: number | null | undefined, unit = ""): string {
  if (n == null) return "Unknown";
  const v = Math.abs(n) >= 1000 ? compact(n) : String(Math.round(n * 10) / 10);
  if (unit === "$") return "$" + v;
  if (unit === "%" ) return v + "%";
  if (unit === "h") return v + " h";
  return v;
}
export const pctText = (d: number | null | undefined) => (d == null ? "" : `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d * 100))}%`);

export function ago(t: number | null | undefined, now = Date.now()): string {
  if (t == null) return "never";
  const d = now - t;
  if (d < 90000) return "just now";
  if (d < HOUR) return Math.round(d / 60000) + " min ago";
  if (d < DAY) return Math.round(d / HOUR) + " h ago";
  if (d < 14 * DAY) return Math.round(d / DAY) + " d ago";
  return Math.round(d / (7 * DAY)) + " wk ago";
}
export const clock = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const dayName = (t: number, long = false) => new Date(t).toLocaleDateString("en-US", { weekday: long ? "long" : "short" });
export const dateShort = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const dateLong = (t: number) => new Date(t).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

/** A short, human deadline: "Today 5:00 PM", "Tomorrow", "Fri", "2 d overdue". */
export function dueLabel(due: number | null | undefined, now = Date.now()): { text: string; tone: "bad" | "warn" | "calm" } | null {
  if (due == null) return null;
  const sod = startOfDay(now), days = Math.floor((startOfDay(due) - sod) / DAY);
  if (due < now) { const od = Math.max(1, Math.round((now - due) / DAY)); return { text: now - due < DAY ? "Overdue" : `${od} d overdue`, tone: "bad" }; }
  if (days === 0) return { text: "Today " + clock(due), tone: "bad" };
  if (days === 1) return { text: "Tomorrow " + clock(due), tone: "warn" };
  if (days < 7) return { text: dayName(due), tone: "calm" };
  return { text: dateShort(due), tone: "calm" };
}

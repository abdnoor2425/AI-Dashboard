import React from "react";

// A small hand-drawn icon set: 24px grid, 1.7px rounded strokes, to sit well beside system type.
const P: Record<string, React.ReactNode> = {
  overview: <><rect x="3.5" y="3.5" width="7" height="8" rx="2.2" /><rect x="13.5" y="3.5" width="7" height="5" rx="2.2" /><rect x="3.5" y="14.5" width="7" height="6" rx="2.2" /><rect x="13.5" y="11.5" width="7" height="9" rx="2.2" /></>,
  attention: <><path d="M6 10a6 6 0 1 1 12 0c0 4.5 1.8 5.8 1.8 5.8H4.2S6 14.5 6 10Z" /><path d="M10 19.2a2.2 2.2 0 0 0 4 0" /></>,
  website: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.1 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.1-3.6-8.5S9.600 5.800 12 3.500Z" /></>,
  social: <><path d="M12 20.2s-7.5-4.300-7.500-9.700A4.300 4.300 0 0 1 12 7.800a4.300 4.300 0 0 1 7.500 2.700c0 5.400-7.500 9.700-7.500 9.700Z" /></>,
  reels: <><rect x="3.5" y="4.500" width="17" height="15" rx="4" /><path d="M10.200 9.300v5.400l4.600-2.700-4.600-2.700Z" /></>,
  goals: <><circle cx="12" cy="12" r="8.500" /><circle cx="12" cy="12" r="4.700" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  metrics: <><path d="M5 19.500V13M10 19.500V5M15 19.500v-9M20 19.500V8.500" /></>,
  decisions: <><path d="M4 6.500A2.500 2.500 0 0 1 6.500 4h7A2.500 2.500 0 0 1 16 6.500v4A2.500 2.500 0 0 1 13.500 13H9l-3 2.500V13A2.500 2.500 0 0 1 4 10.500v-4Z" /><path d="M16 9h1.500A2.500 2.500 0 0 1 20 11.500v4a2.500 2.500 0 0 1-2 2.450V20.500L15 18h-3.500A2.500 2.500 0 0 1 9.300 16.500" /></>,
  clients: <><circle cx="9" cy="8.500" r="3.200" /><path d="M3 19.500c.4-3.200 2.800-5 6-5s5.600 1.800 6 5" /><path d="M15.500 5.600a3.200 3.200 0 0 1 0 5.800M17.500 14.800c2 .7 3.200 2.300 3.500 4.700" /></>,
  inbox: <><path d="M3.500 13.500 6 5.800A2 2 0 0 1 7.900 4.500h8.200A2 2 0 0 1 18 5.800l2.500 7.700v4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-4Z" /><path d="M3.500 13.500H8l1.200 2.500h5.600l1.200-2.500h4.500" /></>,
  calendar: <><rect x="3.500" y="5" width="17" height="15.500" rx="3.500" /><path d="M3.500 10h17M8 3.500v3M16 3.500v3" /></>,
  files: <><path d="M3.500 7.500a2.500 2.500 0 0 1 2.500-2.500h3.200l2 2.300H18a2.500 2.500 0 0 1 2.500 2.500v7.200a2.500 2.500 0 0 1-2.500 2.500H6a2.500 2.500 0 0 1-2.500-2.500v-9.500Z" /></>,
  outputs: <><path d="M6.500 3.500h7l4.500 4.500v10a2.500 2.500 0 0 1-2.500 2.500h-9A2.500 2.500 0 0 1 4 18V6a2.500 2.500 0 0 1 2.500-2.500Z" /><path d="m8.500 13.500 2.200 2.200 4-4.400" /></>,
  skills: <><path d="M13 3.500 5.500 13.200h5.300L10 20.500l8.500-10.300h-5.700L13 3.500Z" /></>,
  suggestions: <><path d="M8.800 16.500c-2-1.200-3.300-3.300-3.300-5.700a6.500 6.500 0 0 1 13 0c0 2.400-1.300 4.500-3.300 5.700v1.500H8.800v-1.500Z" /><path d="M9.800 20.500h4.400" /></>,
  usage: <><path d="M4.200 16.500a8.500 8.500 0 1 1 15.600 0" /><path d="m12 13 3.800-4.300" /><circle cx="12" cy="13.500" r="1.300" fill="currentColor" /></>,
  connections: <><path d="M10 14a4.200 4.200 0 0 0 6 0l3-3a4.200 4.200 0 0 0-6-6l-1 1" /><path d="M14 10a4.200 4.200 0 0 0-6 0l-3 3a4.200 4.200 0 0 0 6 6l1-1" /></>,
  setup: <><circle cx="12" cy="12" r="8.500" /><path d="m15.300 8.700-1.800 4.800-4.800 1.800 1.800-4.800 4.800-1.800Z" /></>,
  settings: <><path d="M4 7.500h9M17 7.500h3M4 16.500h3M11 16.500h9" /><circle cx="15" cy="7.500" r="2.200" /><circle cx="9" cy="16.500" r="2.200" /></>,
  search: <><circle cx="11" cy="11" r="6.500" /><path d="m16 16 4.200 4.200" /></>,
  chevron: <path d="m9.500 6 6 6-6 6" />,
  down: <path d="m6.500 9.500 5.500 5.500 5.500-5.500" />,
  updown: <path d="m8 9.500 4-4 4 4M8 14.500l4 4 4-4" />,
  check: <path d="m5 12.500 4.500 4.500L19 7" />,
  x: <path d="m6.500 6.500 11 11M17.500 6.500l-11 11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  pin: <><path d="M14.500 3.500 20.500 9.500l-2.300.6-2.900 2.900.3 4.300-1.600 1.600-9.400-9.400 1.600-1.600 4.300.3 2.900-2.900.6-2.300Z" /><path d="m4 20 4.500-4.500" /></>,
  clock: <><circle cx="12" cy="12" r="8.500" /><path d="M12 7.500V12l3 2" /></>,
  moon: <path d="M19.500 14.200A8 8 0 0 1 9.800 4.500a8 8 0 1 0 9.700 9.700Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.500v2M12 19.500v2M2.500 12h2M19.500 12h2M5.300 5.300l1.400 1.400M17.300 17.300l1.400 1.400M5.300 18.700l1.400-1.400M17.300 6.700l1.400-1.400" /></>,
  auto: <><circle cx="12" cy="12" r="8.500" /><path d="M12 3.500v17a8.500 8.500 0 0 0 0-17Z" fill="currentColor" /></>,
  more: <><circle cx="5.500" cy="12" r="1.300" fill="currentColor" /><circle cx="12" cy="12" r="1.300" fill="currentColor" /><circle cx="18.500" cy="12" r="1.300" fill="currentColor" /></>,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowdown: <path d="M12 5v14M6 13l6 6 6-6" />,
  external: <><path d="M14 4.500h5.500V10M19.500 4.500l-8 8" /><path d="M18 14v3.500a2 2 0 0 1-2 2H6.500a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H10" /></>,
  warn: <><path d="M12 4 2.800 19.500h18.400L12 4Z" /><path d="M12 10v4.500" /><circle cx="12" cy="17" r=".6" fill="currentColor" /></>,
  sparkle: <><path d="M10 3.500 11.700 8.300 16.500 10l-4.800 1.700L10 16.500l-1.700-4.800L3.500 10l4.800-1.700L10 3.500Z" /><path d="m17.500 14 .9 2.600 2.600.9-2.600.9-.9 2.600-.9-2.600-2.600-.9 2.600-.9.900-2.600Z" /></>,
  sidebar: <><rect x="3.500" y="4.500" width="17" height="15" rx="3.500" /><path d="M9.500 4.500v15" /></>,
  decision: <><path d="M12 20.500V11" /><path d="M12 11 6 5M12 11l6-6" /><path d="M6 9V5h4M18 9V5h-4" /></>,
  approval: <><circle cx="12" cy="12" r="8.500" /><path d="m8.300 12.300 2.600 2.600 4.800-5.300" /></>,
  reply: <><path d="M10 8.500 5 13l5 4.500" /><path d="M5 13h8.500a5.500 5.500 0 0 1 5.500 5.500" /></>,
  risk: <><path d="M12 3.500 19.500 6.500v5c0 4.500-3 7.800-7.500 9-4.500-1.200-7.500-4.500-7.500-9v-5L12 3.500Z" /><path d="M12 8.500v4" /><circle cx="12" cy="15.500" r=".6" fill="currentColor" /></>,
  gmail: <><rect x="3.500" y="5.500" width="17" height="13" rx="3" /><path d="m4.500 7.500 7.500 6 7.500-6" /></>,
  slack: <><path d="M9.500 4v16M14.500 4v16M4 9.500h16M4 14.500h16" /></>,
  linear: <><circle cx="12" cy="12" r="8.500" /><path d="m4.800 13.800 5.400 5.400M5 9.500l9.500 9.500M8 5.500l10.500 10.500" /></>,
  drive: <><path d="M9 4.500h6l5.500 9.500-3 5H6.500l-3-5L9 4.500Z" /><path d="m9 4.500 5.500 9.500M3.500 14h17M15 4.500 9.500 14" /></>,
  analytics: <><rect x="4" y="13" width="4" height="7" rx="1.500" /><rect x="10" y="8.500" width="4" height="11.500" rx="1.500" /><rect x="16" y="4" width="4" height="16" rx="1.500" /></>,
  metricool: <path d="M3.500 17V9.500a3 3 0 0 1 6 0V15a3 3 0 0 0 6 0V9.500a2.500 2.500 0 0 1 5 0V17" />,
  sheets: <><rect x="4" y="3.500" width="16" height="17" rx="3" /><path d="M4 9.500h16M4 15h16M10 9.500v11" /></>,
  billing: <><rect x="3.500" y="6" width="17" height="12.500" rx="3" /><path d="M3.500 10.500h17M7 15h3" /></>,
  doc: <><path d="M6.500 3.500h7l4.500 4.500v10a2.500 2.500 0 0 1-2.500 2.500h-9A2.500 2.500 0 0 1 4 18V6a2.500 2.500 0 0 1 2.500-2.500Z" /><path d="M8 12.500h8M8 16h5" /></>,
  video: <><rect x="3.500" y="6" width="12" height="12" rx="3" /><path d="m15.500 10.500 5-2.500v8l-5-2.500" /></>,
  person: <><circle cx="12" cy="8.500" r="3.700" /><path d="M4.500 20c.6-3.700 3.500-5.800 7.500-5.800s6.900 2.100 7.500 5.800" /></>,
  flag: <><path d="M5.500 20.500v-16" /><path d="M5.500 5h11l-2 3.700 2 3.800h-11" /></>,
  eye: <><path d="M2.500 12s3.500-6.500 9.500-6.500 9.500 6.500 9.500 6.500-3.500 6.500-9.500 6.500S2.500 12 2.500 12Z" /><circle cx="12" cy="12" r="2.800" /></>,
  download: <><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></>,
  trash: <><path d="M4.500 7h15M9.500 7V4.500h5V7M6.500 7l.8 11a2 2 0 0 0 2 1.900h5.400a2 2 0 0 0 2-1.900l.8-11" /></>,
  refresh: <><path d="M19.500 12a7.500 7.500 0 0 1-13.400 4.600M4.500 12a7.500 7.500 0 0 1 13.400-4.600" /><path d="M18.500 3.500v4h-4M5.500 20.500v-4h4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  play: <path d="M8 5.500v13l11-6.500-11-6.500Z" />,
  copy: <><rect x="8.500" y="8.500" width="11" height="11" rx="2.500" /><path d="M15.500 8.500V7a2.500 2.500 0 0 0-2.500-2.500H7A2.500 2.500 0 0 0 4.500 7v6A2.500 2.500 0 0 0 7 15.500h1.500" /></>,
};
P.sheet = P.sheets; P.slides = P.doc; P.pdf = P.doc; P.folder = P.files;

export function Icon({ name, size = 20, className = "", stroke = 1.7 }: { name: string; size?: number; className?: string; stroke?: number }) {
  return (
    <svg className={"ico " + className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name] || P.doc}
    </svg>
  );
}

/** Calm line drawings for empty states. */
export function Illustration({ name }: { name: "clear" | "connect" | "search" | "quiet" }) {
  const c = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="132" height="96" viewBox="0 0 132 96" aria-hidden="true" style={{ color: "var(--text-3)" }}>
      <ellipse cx="66" cy="84" rx="44" ry="5" fill="var(--fill-2)" />
      {name === "clear" && <>
        <circle cx="66" cy="42" r="26" fill="color-mix(in srgb, var(--accent) 10%, transparent)" stroke="var(--accent)" strokeWidth="1.6" />
        <path d="m54 43 8.500 8.500L79 34" {...c} stroke="var(--accent)" strokeWidth="2.6" />
        <path d="M24 30c3-2 6-2 9 0M100 22c3-2 6-2 9 0M20 60h8M104 56h9" {...c} />
        <circle cx="34" cy="16" r="2" fill="var(--warn)" /><circle cx="104" cy="40" r="2.500" fill="var(--good)" />
      </>}
      {name === "connect" && <>
        <rect x="18" y="30" width="38" height="30" rx="9" {...c} /><rect x="76" y="30" width="38" height="30" rx="9" {...c} />
        <path d="M56 45h6M70 45h6" {...c} stroke="var(--accent)" strokeWidth="2.400" /><circle cx="66" cy="45" r="3.500" fill="var(--accent)" />
        <path d="M29 41h16M29 49h10M87 41h16M87 49h10" {...c} opacity=".6" />
      </>}
      {name === "search" && <>
        <circle cx="60" cy="40" r="20" {...c} fill="color-mix(in srgb, var(--accent) 8%, transparent)" /><path d="m75 55 14 14" {...c} strokeWidth="3" stroke="var(--accent)" />
        <path d="M52 40h16M60 32v16" {...c} opacity=".4" />
      </>}
      {name === "quiet" && <>
        <path d="M30 62c0-18 14-34 36-34s36 16 36 34" {...c} fill="color-mix(in srgb, var(--accent) 8%, transparent)" />
        <path d="M22 62h88" {...c} /><circle cx="66" cy="20" r="6" fill="var(--warn)" opacity=".8" />
        <path d="M46 72h40M54 79h24" {...c} opacity=".5" />
      </>}
    </svg>
  );
}

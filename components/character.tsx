import React, { useId } from "react";

// One illustrated person, drawn from a few choices, in the dashboard's "Ledger" style: lit from the
// upper left with a soft rim light, inked outlines, a tailored jacket, and a brass-ringed medallion.
// Every character shares the same face and proportions; only skin tone, hair, beard, glasses and jacket change.
// The scene on Your team animates parts by class name: .ch-head (tilt), .ch-eyes (blink, gaze via --gaze-x),
// and .ch-mouth / .ch-mouth-open (talking).
export const SKINS = ["#F9D8C0", "#EDC09B", "#D6A074", "#B98054", "#8F5B38", "#643D25"];
export const SKIN_NAMES = ["Fair", "Light", "Tan", "Brown", "Deep brown", "Dark"];
export const HAIR_COLORS = ["#1D1614", "#3D2817", "#75492A", "#B88B50", "#E3C27C", "#A7ACB8", "#B24C2B"];
export const HAIR_COLOR_NAMES = ["Black", "Dark brown", "Brown", "Dark blonde", "Blonde", "Grey", "Red"];
export const TOPS = ["#1F3A68", "#2E5E4E", "#8A3B3B", "#3A3F4A", "#A97E4A", "#5B6B80"];
export const TOP_NAMES = ["Navy", "Forest", "Burgundy", "Charcoal", "Camel", "Slate"];
export const HAIRS: [string, string][] = [["short", "Short"], ["swept", "Swept"], ["crop", "Cropped"], ["curly", "Curly"], ["long", "Long"], ["bun", "Bun"], ["none", "None"]];
export const BEARDS: [string, string][] = [["none", "None"], ["short", "Short"], ["full", "Full"]];
export interface Look { skin: number; hair: string; hairColor: number; beard: string; glasses: boolean; top: number }
export const DEFAULT_LOOK: Look = { skin: 1, hair: "short", hairColor: 1, beard: "none", glasses: false, top: 0 };

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};

export function Character({ look, size = 96, label, still, framed = true, className = "" }: { look?: Partial<Look>; size?: number; label?: string; still?: boolean; framed?: boolean; className?: string }) {
  const l = { ...DEFAULT_LOOK, ...(look || {}) };
  const skin = SKINS[l.skin] || SKINS[1], hair = HAIR_COLORS[l.hairColor] || HAIR_COLORS[1], top = TOPS[l.top] || TOPS[0];
  const ink = shade(skin, -0.62), hairInk = shade(hair, -0.45), topInk = shade(top, -0.5);
  const id = "c" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const u = (n: string) => `url(#${id}${n})`;
  const hairPaint = u("h");
  const line = { stroke: ink, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const hairLine = { stroke: hairInk, strokeWidth: 2, strokeLinejoin: "round" as const };
  return (
    <svg className={"character" + (still ? " still" : "") + (className ? " " + className : "")} width={size} height={size} viewBox="0 0 120 120" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <radialGradient id={id + "bg"} cx="0.35" cy="0.25" r="0.85"><stop offset="0" stopColor={shade(top, 0.82)} /><stop offset="0.65" stopColor={shade(top, 0.55)} /><stop offset="1" stopColor={shade(top, 0.3)} /></radialGradient>
        <radialGradient id={id + "s"} cx="0.38" cy="0.32" r="0.75"><stop offset="0" stopColor={shade(skin, 0.22)} /><stop offset="0.6" stopColor={skin} /><stop offset="1" stopColor={shade(skin, -0.16)} /></radialGradient>
        <linearGradient id={id + "h"} x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stopColor={shade(hair, 0.28)} /><stop offset="0.55" stopColor={hair} /><stop offset="1" stopColor={shade(hair, -0.3)} /></linearGradient>
        <linearGradient id={id + "j"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={shade(top, 0.18)} /><stop offset="0.6" stopColor={top} /><stop offset="1" stopColor={shade(top, -0.32)} /></linearGradient>
        <linearGradient id={id + "n"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(skin, -0.3)} /><stop offset="1" stopColor={shade(skin, -0.08)} /></linearGradient>
        <clipPath id={id + "cl"}><circle cx="60" cy="60" r="57" /></clipPath>
      </defs>
      {framed && <><circle cx="60" cy="60" r="59" fill="#B8924A" /><circle cx="60" cy="60" r="57.5" fill="#F3E3BC" opacity="0.55" /><circle cx="60" cy="60" r="57" fill={u("bg")} /></>}
      <g clipPath={u("cl")}>
        <g className="ch-body">
          {l.hair === "long" && <path d="M31 54c-3-25 11-37 29-37s32 12 29 37c-1 16 1 30 6 40H25c5-10 7-24 6-40Z" fill={hairPaint} {...hairLine} />}
          {/* Jacket, shirt and lapels */}
          <path d="M10 126c1-24 18-36 50-36s49 12 50 36Z" fill={u("j")} stroke={topInk} strokeWidth="2" />
          <path d="M45 90.5 60 112l15-21.5c-4-1-9-1.6-15-1.6s-11 .6-15 1.6Z" fill="#FBF7EE" stroke={topInk} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M44 91 52 106l-6 3 2 5-9 2c-2-9 0-18 5-25ZM76 91 68 106l6 3-2 5 9 2c2-9 0-18-5-25Z" fill={shade(top, -0.18)} stroke={topInk} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M60 100v20" stroke={topInk} strokeWidth="1.4" opacity="0.5" />
          {/* Neck with the head's shadow on it */}
          <path d="M50.5 72h19v17c0 5-4.3 8.5-9.5 8.5s-9.5-3.5-9.5-8.5Z" fill={u("n")} {...line} strokeWidth={1.8} />
          <g className="ch-head">
            <ellipse cx="60" cy="83" rx="14" ry="3.5" fill="#000" opacity="0.12" />
            <ellipse cx="36.5" cy="57" rx="5.6" ry="6.4" fill={shade(skin, -0.06)} {...line} /><ellipse cx="83.5" cy="57" rx="5.6" ry="6.4" fill={shade(skin, -0.12)} {...line} />
            <path d="M35.5 57.5c1.5-1.6 3-1.6 4 .2M84.5 57.5c-1.5-1.6-3-1.6-4 .2" stroke={ink} strokeWidth="1.2" fill="none" opacity="0.5" />
            <path d="M37 50c0-16 9.5-25 23-25s23 9 23 25v7c0 14-9.5 23.5-23 23.5S37 71 37 57Z" fill={u("s")} {...line} />
            {/* Rim light on the shadow side and a soft cheek shade */}
            <path d="M80.5 46c1.6 4.5 1.9 10.5.6 16" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.35" />
            <path d="M75 70c-3.5 5-8.5 8-15 8" stroke={shade(skin, -0.3)} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.22" />
            {l.beard === "short" && <path d="M37.3 59c1.4 13.5 10.2 21.5 22.7 21.5S81.3 72.5 82.7 59c-1.7 6-4.3 10-7.5 11.8-2.6-4.6-8.4-6.3-15.2-6.3s-12.6 1.7-15.2 6.3C41.6 69 39 65 37.3 59Z" fill={hairPaint} opacity="0.9" />}
            {l.beard === "full" && <path d="M37 52c0 20 8 33 23 33s23-13 23-33c-1.8 7.5-4.8 12.3-8.5 14-3-3.6-8.5-5-14.5-5s-11.5 1.4-14.5 5c-3.7-1.7-6.7-6.5-8.5-14Z" fill={hairPaint} {...hairLine} strokeWidth={1.6} />}
            <g className="ch-eyes">
              <ellipse cx="51" cy="54.8" rx="3.3" ry="3.5" fill="#FFFDF8" /><ellipse cx="69" cy="54.8" rx="3.3" ry="3.5" fill="#FFFDF8" />
              <g className="ch-pupils"><circle cx="51.2" cy="55.2" r="2.4" fill="#17121C" /><circle cx="69.2" cy="55.2" r="2.4" fill="#17121C" /><circle cx="52.2" cy="54" r="0.9" fill="#fff" /><circle cx="70.2" cy="54" r="0.9" fill="#fff" /></g>
              <path d="M47.6 52.4c2.3-1.5 4.9-1.5 7 0M65.4 52.4c2.3-1.5 4.9-1.5 7 0" stroke={ink} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.8" />
            </g>
            <path d="M45.8 47.6c2.8-2 6.4-2.2 9.4-.8M64.8 46.8c3-1.4 6.6-1.2 9.4.8" stroke={l.hair === "none" ? ink : hairInk} strokeWidth="2.8" strokeLinecap="round" fill="none" />
            <path d="M59.5 57c-1 3-1 5 1.4 5.4" stroke={ink} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.7" />
            <circle cx="45" cy="63" r="4" fill="#E0654A" opacity="0.14" /><circle cx="75" cy="63" r="4" fill="#E0654A" opacity="0.14" />
            <path className="ch-mouth" d="M52.5 66c2 4 4.6 5.6 7.5 5.6s5.5-1.6 7.5-5.6c-5 1-10 1-15 0Z" fill="#FFFDF8" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
            <path className="ch-mouth-open" d="M53.5 65.5c1.6 5.5 4 8 6.5 8s4.9-2.5 6.5-8c-4.3 1-8.7 1-13 0Z" fill="#5B2230" stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
            {l.glasses && <g fill="rgba(255,255,255,0.12)" stroke="#16121C" strokeWidth="2.2"><rect x="43" y="48.5" width="15" height="12" rx="4.5" /><rect x="62" y="48.5" width="15" height="12" rx="4.5" /><path d="M58 53.5h4M43 53l-6-1.5M77 53l6-1.5" fill="none" /></g>}
            {l.hair === "short" && <path d="M36.5 53c-3.5-19 7.5-31 23.5-31s27 12 23.5 31c-1.5-7-4-11.5-7.5-14-10 3.5-23 3.5-32 .5-3.5 2.5-6 6.5-7.5 13.5Z" fill={hairPaint} {...hairLine} />}
            {l.hair === "swept" && <path d="M36.3 53.5C32 33 42 19.5 60 19.5c17 0 28.5 12 23.7 34-1.3-7-3.7-11.8-7-14.5-9 5-22.5 4.5-31.5-3-4.2 3.5-7.2 9.5-8.9 17.5Z" fill={hairPaint} {...hairLine} />}
            {l.hair === "crop" && <path d="M37 51c-1.5-17 8.5-27.5 23-27.5S84.5 34 83 51c-1.2-6-3.5-10.3-6.8-12.8-10.5 2.3-22 2.3-32.4 0C40.5 40.7 38.2 45 37 51Z" fill={hairPaint} {...hairLine} />}
            {l.hair === "curly" && <g fill={hairPaint} {...hairLine} strokeWidth={1.6}><circle cx="42" cy="38" r="8.5" /><circle cx="80" cy="41" r="7.5" /><circle cx="74" cy="31.5" r="9" /><circle cx="51" cy="29" r="9.5" /><circle cx="63" cy="26.5" r="10" /><circle cx="60" cy="36" r="10" /><circle cx="38.5" cy="46" r="5" /><circle cx="82.5" cy="48" r="4.5" /></g>}
            {l.hair === "long" && <path d="M35.5 60C31 36 42 20 60 20s29 16 24.5 40c-1-10-3.5-17-8-21.5-10 4.5-23.5 3.5-31.5-3.5-5 5.5-8 13.5-9.5 25Z" fill={hairPaint} {...hairLine} />}
            {l.hair === "bun" && <><circle cx="60" cy="16.5" r="9.5" fill={hairPaint} {...hairLine} /><path d="M36.5 53c-3.5-19 7.5-31 23.5-31s27 12 23.5 31c-1.5-8-4.5-13-9-15.5-9 2.5-20 2.5-29 0-4.5 2.5-7.5 7.5-9 15.5Z" fill={hairPaint} {...hairLine} /></>}
            {/* A highlight streak across the hair */}
            {l.hair !== "none" && l.hair !== "curly" && <path d="M47 31c5-4 13-5.5 20-3.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.28" />}
          </g>
        </g>
      </g>
      {framed && <circle cx="60" cy="60" r="57" fill="none" stroke="#7A5F2B" strokeWidth="1.2" opacity="0.6" />}
    </svg>
  );
}

import React from "react";

// One friendly illustrated person, drawn from a few choices. Every character shares the same
// face and proportions; only skin tone, hair, beard, glasses and top change.
export const SKINS = ["#F9D8C0", "#EDC09B", "#D6A074", "#B98054", "#8F5B38", "#643D25"];
export const SKIN_NAMES = ["Fair", "Light", "Tan", "Brown", "Deep brown", "Dark"];
export const HAIR_COLORS = ["#1D1614", "#3D2817", "#75492A", "#B88B50", "#E3C27C", "#A7ACB8", "#B24C2B"];
export const HAIR_COLOR_NAMES = ["Black", "Dark brown", "Brown", "Dark blonde", "Blonde", "Grey", "Red"];
export const TOPS = ["#2F6BFF", "#16A37B", "#F0714F", "#7C5CF0", "#E5A01E", "#51607F"];
export const TOP_NAMES = ["Blue", "Green", "Coral", "Violet", "Amber", "Slate"];
export const HAIRS: [string, string][] = [["short", "Short"], ["swept", "Swept"], ["crop", "Cropped"], ["curly", "Curly"], ["long", "Long"], ["bun", "Bun"], ["none", "None"]];
export const BEARDS: [string, string][] = [["none", "None"], ["short", "Short"], ["full", "Full"]];
export interface Look { skin: number; hair: string; hairColor: number; beard: string; glasses: boolean; top: number }
export const DEFAULT_LOOK: Look = { skin: 1, hair: "short", hairColor: 1, beard: "none", glasses: false, top: 0 };

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};

export function Character({ look, size = 96, label, still }: { look?: Partial<Look>; size?: number; label?: string; still?: boolean }) {
  const l = { ...DEFAULT_LOOK, ...(look || {}) };
  const skin = SKINS[l.skin] || SKINS[1], hair = HAIR_COLORS[l.hairColor] || HAIR_COLORS[1], top = TOPS[l.top] || TOPS[0];
  const under = shade(skin, -0.14), line = shade(skin, -0.45), id = `${l.skin}${l.hair}${l.hairColor}${l.beard}${l.top}`;
  return (
    <svg className={"character" + (still ? " still" : "")} width={size} height={size} viewBox="0 0 120 120" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={"bg" + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(top, 0.78)} /><stop offset="1" stopColor={shade(top, 0.5)} /></linearGradient>
        <clipPath id={"cl" + id}><circle cx="60" cy="60" r="60" /></clipPath>
      </defs>
      <circle cx="60" cy="60" r="60" fill={`url(#bg${id})`} />
      <g clipPath={`url(#cl${id})`}>
        <g className="ch-body">
          {l.hair === "long" && <path d="M31 54c-3-25 11-37 29-37s32 12 29 37c-1 16 1 30 6 40H25c5-10 7-24 6-40Z" fill={hair} />}
          <path d="M14 124c1-23 17-34 46-34s45 11 46 34Z" fill={top} />
          <path d="M46 91c4 6 9 9 14 9s10-3 14-9c-4-1.500-9-2-14-2s-10 .500-14 2Z" fill={skin} />
          <rect x="50.500" y="68" width="19" height="26" rx="9.500" fill={under} />
          <g className="ch-head">
            <circle cx="36.500" cy="56" r="5.200" fill={skin} /><circle cx="83.500" cy="56" r="5.200" fill={skin} />
            <path d="M37 50c0-16 9.500-25 23-25s23 9 23 25v7c0 14-9.500 23.500-23 23.500S37 71 37 57Z" fill={skin} />
            {l.beard === "short" && <path d="M37.300 59c1.400 13.500 10.200 21.500 22.700 21.500S81.300 72.500 82.700 59c-1.700 6-4.300 10-7.500 11.800-2.600-4.600-8.400-6.300-15.200-6.300s-12.600 1.700-15.200 6.300C41.600 69 39 65 37.300 59Z" fill={hair} opacity="0.84" />}
            {l.beard === "full" && <path d="M37 52c0 20 8 33 23 33s23-13 23-33c-1.800 7.500-4.800 12.300-8.500 14-3-3.600-8.500-5-14.500-5s-11.500 1.400-14.500 5c-3.700-1.700-6.700-6.500-8.500-14Z" fill={hair} />}
            <g className="ch-eyes"><ellipse cx="51" cy="54.500" rx="2.500" ry="3" fill="#1B1420" /><ellipse cx="69" cy="54.500" rx="2.500" ry="3" fill="#1B1420" /><circle cx="51.900" cy="53.400" r="0.800" fill="#fff" /><circle cx="69.900" cy="53.400" r="0.800" fill="#fff" /></g>
            <path d="M46.500 48.300c2.400-1.700 5.600-1.900 8.300-.700M65.200 47.600c2.700-1.200 5.900-1 8.300.700" stroke={l.hair === "none" ? line : shade(hair, -0.1)} strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M59 57.500c-.800 2.300-.600 3.800 1.600 4" stroke={line} strokeWidth="1.500" strokeLinecap="round" fill="none" opacity="0.55" />
            <path d="M52.500 65.500c2 4.300 4.600 6 7.500 6s5.500-1.700 7.500-6c-5 1-10 1-15 0Z" fill="#fff" stroke={line} strokeWidth="1.300" strokeLinejoin="round" />
            <circle cx="45" cy="62.500" r="3.600" fill="#F0714F" opacity="0.16" /><circle cx="75" cy="62.500" r="3.600" fill="#F0714F" opacity="0.16" />
            {l.glasses && <g fill="none" stroke="#1B1420" strokeWidth="1.700"><rect x="43.500" y="49" width="14" height="11.500" rx="4.500" /><rect x="62.500" y="49" width="14" height="11.500" rx="4.500" /><path d="M57.500 53.500h5M43.500 53l-6-1.500M76.500 53l6-1.500" /></g>}
            {l.hair === "short" && <path d="M36.500 53c-3.500-19 7.500-31 23.500-31s27 12 23.500 31c-1.500-7-4-11.500-7.500-14-10 3.500-23 3.500-32 .500-3.500 2.500-6 6.500-7.500 13.500Z" fill={hair} />}
            {l.hair === "swept" && <path d="M36.300 53.500C32 33 42 19.500 60 19.500c17 0 28.500 12 23.700 34-1.300-7-3.700-11.800-7-14.500-9 5-22.500 4.500-31.500-3-4.200 3.500-7.200 9.500-8.900 17.500Z" fill={hair} />}
            {l.hair === "swept" && <path d="M45.500 36c6-9 17-12 27-7.500" stroke={shade(hair, 0.22)} strokeWidth="1.800" strokeLinecap="round" fill="none" opacity="0.7" />}
            {l.hair === "crop" && <><path d="M37 51c-1.500-17 8.500-27.500 23-27.500S84.500 34 83 51c-1.200-6-3.500-10.300-6.800-12.800-10.500 2.300-22 2.300-32.400 0C40.500 40.700 38.200 45 37 51Z" fill={hair} /><path d="M37 51c-.300-4 .100-7.500 1.200-10.500l3 1.200C39.300 44 38 47 37 51ZM83 51c.300-4-.100-7.500-1.200-10.500l-3 1.200c1.900 2.300 3.200 5.300 4.200 9.300Z" fill={hair} opacity="0.55" /></>}
            {l.hair === "curly" && <g fill={hair}><circle cx="42" cy="38" r="8.500" /><circle cx="51" cy="29" r="9.500" /><circle cx="63" cy="26.500" r="10" /><circle cx="74" cy="31.500" r="9" /><circle cx="80" cy="41" r="7.500" /><circle cx="60" cy="36" r="10" /><circle cx="38.500" cy="46" r="5" /><circle cx="82.500" cy="48" r="4.500" /></g>}
            {l.hair === "long" && <path d="M35.500 60C31 36 42 20 60 20s29 16 24.500 40c-1-10-3.500-17-8-21.500-10 4.500-23.500 3.500-31.500-3.500-5 5.500-8 13.500-9.500 25Z" fill={hair} />}
            {l.hair === "bun" && <><circle cx="60" cy="16.500" r="9.500" fill={hair} /><path d="M36.500 53c-3.500-19 7.500-31 23.500-31s27 12 23.500 31c-1.500-8-4.500-13-9-15.500-9 2.500-20 2.500-29 0-4.500 2.500-7.500 7.500-9 15.500Z" fill={hair} /></>}
          </g>
        </g>
      </g>
    </svg>
  );
}

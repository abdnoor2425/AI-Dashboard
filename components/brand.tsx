import React, { useId } from "react";

/** The AI-Dashboard mark: a brass gauge with an AI spark, on navy. */
export function BrandMark({ size = 36, title = "AI-Dashboard" }: { size?: number; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label={title} style={{ display: "block", flex: "none" }}>
      <defs>
        <linearGradient id={id + "bg"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1B3358" /><stop offset="1" stopColor="#0C1A30" /></linearGradient>
        <linearGradient id={id + "br"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F3D493" /><stop offset=".55" stopColor="#E0B663" /><stop offset="1" stopColor="#B98A3A" /></linearGradient>
        <radialGradient id={id + "gl"} cx=".5" cy=".58" r=".5"><stop offset="0" stopColor="#E0B663" stopOpacity=".28" /><stop offset="1" stopColor="#E0B663" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${id}bg)`} />
      <rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="#FFFFFF" strokeOpacity=".08" strokeWidth="4" />
      <circle cx="256" cy="296" r="200" fill={`url(#${id}gl)`} />
      <g transform="translate(0,-14)">
        <path d="M 106 336 A 150 150 0 0 1 406 336" fill="none" stroke="#F1E6CF" strokeOpacity=".16" strokeWidth="30" strokeLinecap="round" />
        <path d="M 106 336 A 150 150 0 0 1 344.2 214.6" fill="none" stroke={`url(#${id}br)`} strokeWidth="30" strokeLinecap="round" />
        <path transform="translate(256 286) scale(.84) translate(-256 -286)" d="M256 196 C 264 262 278 276 336 286 C 278 296 264 310 256 376 C 248 310 234 296 176 286 C 234 276 248 262 256 196 Z" fill={`url(#${id}br)`} />
        <circle cx="344.2" cy="214.6" r="10" fill="#FFF6E0" />
      </g>
    </svg>
  );
}

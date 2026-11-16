import React from "react";
import { Icon } from "./icons";

// Small, simplified marks so each tool is recognisable at a glance. They are drawn here,
// not copied artwork, and are only used to say which tool a card or connection belongs to.
const MARKS: Record<string, { bg: string; node: React.ReactNode; name: string }> = {
  linear: { name: "Linear", bg: "#5E6AD2", node: <g stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none"><path d="M4.5 13.5l6 6M4.5 8.500l11 11M7 4.800l12.200 12.200M12.500 4.500l7 7" /></g> },
  gmail: { name: "Gmail", bg: "#fff", node: <g fill="none" strokeWidth="2.800" strokeLinecap="round" strokeLinejoin="round"><path d="M4.500 17.500v-10" stroke="#4285F4" /><path d="M19.500 17.500v-10" stroke="#34A853" /><path d="M4.500 7.500l7.500 5.700 7.500-5.700" stroke="#EA4335" /></g> },
  slack: { name: "Slack", bg: "#fff", node: <g fill="none" strokeWidth="3.200" strokeLinecap="round"><path d="M9.200 4.500v9" stroke="#36C5F0" /><path d="M14.800 10.500v9" stroke="#E01E5A" /><path d="M4.500 14.800h9" stroke="#2EB67D" /><path d="M10.500 9.200h9" stroke="#ECB22E" /></g> },
  "google-analytics": { name: "Google Analytics", bg: "#fff", node: <g><rect x="14.500" y="4" width="5" height="16" rx="2.500" fill="#F9AB00" /><rect x="9.500" y="10" width="5" height="10" rx="2.500" fill="#E37400" /><circle cx="6.500" cy="17.500" r="2.500" fill="#E37400" /></g> },
  calendar: { name: "Google Calendar", bg: "#fff", node: <g><rect x="4" y="4" width="16" height="16" rx="3.500" fill="#4285F4" /><rect x="7" y="7" width="10" height="10" rx="1" fill="#fff" /><path d="M9.300 10.200h2.500l-1.300 1.700c1 .1 1.600.7 1.600 1.500 0 1-.8 1.600-1.800 1.600-.600 0-1.100-.200-1.500-.600M14 10.200l1.100-.500v5.300" stroke="#4285F4" strokeWidth="1.100" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g> },
  drive: { name: "Google Drive", bg: "#fff", node: <g><path d="M9 4.500h6l5.500 9.500h-6z" fill="#FFCF48" /><path d="M9 4.500L3.500 14l3 5.200L12 9.700z" fill="#11A861" /><path d="M6.500 19.200h11l3-5.200h-11z" fill="#4688F4" /></g> },
  sheets: { name: "Google Sheets", bg: "#0F9D58", node: <g fill="none" stroke="#fff" strokeWidth="1.700" strokeLinejoin="round"><rect x="5.500" y="6" width="13" height="12" rx="1.500" /><path d="M5.500 10h13M5.500 14h13M10.500 6v12" /></g> },
  metricool: { name: "Metricool", bg: "#16203A", node: <g fill="none" stroke="#fff" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17V9.500l4.300 5 4.300-7.500v10" /><circle cx="18.500" cy="8" r="1.600" fill="#3DD9B4" stroke="none" /></g> },
};
MARKS.analytics = MARKS["google-analytics"];

export const toolName = (tool: string) => MARKS[tool]?.name || tool;

export function Logo({ tool, size = 20 }: { tool: string; size?: number }) {
  const m = MARKS[tool];
  const r = Math.round(size * 0.28);
  if (!m) return <span className="logo-mark" style={{ width: size, height: size, borderRadius: r, background: "var(--fill)", color: "var(--text-2)" }}><Icon name={tool} size={Math.round(size * 0.62)} /></span>;
  return (
    <span className="logo-mark" style={{ width: size, height: size, borderRadius: r, background: m.bg, boxShadow: m.bg === "#fff" ? "inset 0 0 0 1px rgba(20,40,90,.1)" : undefined }} role="img" aria-label={m.name}>
      <svg width={Math.round(size * 0.74)} height={Math.round(size * 0.74)} viewBox="0 0 24 24" aria-hidden="true">{m.node}</svg>
    </span>
  );
}

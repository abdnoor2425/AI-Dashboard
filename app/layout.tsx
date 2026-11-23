import fs from "node:fs";
import path from "node:path";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell";
import { WorkOSShell } from "@/components/workos-shell";
import "./workos.css";

export const metadata: Metadata = { title: "AI-Dashboard", description: "Your whole business on one calm page, on your own computer." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export const dynamic = "force-dynamic";

// The frame of every screen: the rail, the top bar and the empty pages that ui/js fills in.
const shell = () => fs.readFileSync(path.join(process.cwd(), "ui", "shell.html"), "utf8");
// Sets the look before the first paint, so the page never flashes the wrong one. Until you pick a look, it follows the clock.
const LOOK = `try{var h=new Date().getHours(),k=h>=5&&h<8?'dawn':h>=8&&h<17?'day':h>=17&&h<20?'dusk':'night',s=localStorage.getItem('aid-look');if(s==='dawn'||s==='day'||s==='dusk'||s==='night')k=s;var r=document.documentElement;r.dataset.look=k;r.dataset.theme=k==='dawn'||k==='day'?'light':'dark'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Client mode: a WorkOS installation started by its own launcher (scripts/workos.mjs). It has its own pages and no dashboard frame.
  if (process.env.WORKOS_LOCAL_CLIENT === "1") return (
    <html lang="en" data-look="night" data-theme="dark" data-client="1">
      <body><WorkOSShell />{children}</body>
    </html>
  );
  return (
    <html lang="en" data-look="night" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" />
        <script dangerouslySetInnerHTML={{ __html: LOOK }} />
      </head>
      <body><AppShell shell={shell()}>{children}</AppShell></body>
    </html>
  );
}

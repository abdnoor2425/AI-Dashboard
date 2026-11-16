import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell";

export const metadata: Metadata = { title: "AI-Dashboard", description: "Your whole business on one calm page, on your own computer." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" /></head>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}

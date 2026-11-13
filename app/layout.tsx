import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shell";

export const metadata: Metadata = { title: "Keystone", description: "A calm, local-first business dashboard." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..750&display=swap" /></head>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}

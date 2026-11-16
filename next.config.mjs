import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NEXT_TELEMETRY_DISABLED = "1"; // nothing about this app or its use is sent anywhere
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
  // Trace files only inside this folder. Without it, a stray package.json higher up (for example in the
  // person's home folder) makes Next scan the whole home folder, and it fails on locked Windows folders.
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
};
export default nextConfig;

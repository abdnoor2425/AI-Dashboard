process.env.NEXT_TELEMETRY_DISABLED = "1"; // nothing about this app or its use is sent anywhere
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;

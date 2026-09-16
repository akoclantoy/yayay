import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow cross-origin requests from network IP
  allowedDevOrigins: ['10.0.11.220'],
  turbopack: { root: process.cwd() },
};

export default nextConfig;

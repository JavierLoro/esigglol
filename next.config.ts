import type { NextConfig } from "next";
import os from "os";
import pkg from "./package.json";

function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const iface of Object.values(interfaces)) {
    for (const entry of iface ?? []) {
      if (!entry.internal && entry.family === 'IPv4') {
        ips.push(entry.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_GIT_SHA: process.env.COMMIT_SHA ?? '',
  },
  allowedDevOrigins: getLocalIPs(),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ddragon.leagueoflegends.com',
        pathname: '/cdn/*/img/champion/**',
      },
    ],
  },
};

export default nextConfig;

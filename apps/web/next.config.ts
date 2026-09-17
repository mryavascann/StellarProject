import type { NextConfig } from "next";

/**
 * `@kasa/core` ve `config/` TypeScript kaynak olarak gelir; Next bunları derler.
 * Workspace kökü lockfile'dan bulunur, `config/simulation.ts` göreli import ile okunur.
 */
const config: NextConfig = {
  transpilePackages: ["@kasa/api", "@kasa/core", "@kasa/mock-anchor"],
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/health", destination: "/api/health" },
      { source: "/.well-known/stellar.toml", destination: "/api/anchor-proxy/.well-known/stellar.toml" },
      { source: "/auth", destination: "/api/anchor-proxy/auth" },
      { source: "/sep24/:path*", destination: "/api/anchor-proxy/sep24/:path*" },
      { source: "/sep38/:path*", destination: "/api/anchor-proxy/sep38/:path*" },
      { source: "/interactive/:path*", destination: "/api/anchor-proxy/interactive/:path*" },
      { source: "/mock/:path*", destination: "/api/anchor-proxy/mock/:path*" },
    ];
  },
};

export default config;

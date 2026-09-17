import type { NextConfig } from "next";

/**
 * `@kasa/core` ve `config/` TypeScript kaynak olarak gelir; Next bunları derler.
 * Workspace kökü lockfile'dan bulunur, `config/simulation.ts` göreli import ile okunur.
 */
const config: NextConfig = {
  transpilePackages: ["@kasa/core"],
  reactStrictMode: true,
};

export default config;

import path from "node:path";
import { defineConfig } from "vitest/config";

/** JSX esbuild ile otomatik runtime'da derlenir; ayrı React eklentisi gerekmez (vite 5 uyumu). */
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

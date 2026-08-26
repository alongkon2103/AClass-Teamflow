import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Native replacement for vite-tsconfig-paths; resolves the "@/*" alias.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // Unit tests only; Playwright owns e2e (tests/e2e) from Phase 10.
    include: ["tests/unit/**/*.test.ts"],
  },
});

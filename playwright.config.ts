import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * E2E runs against a production build and the real database.
 *
 * Not the dev server: Fast Refresh recompiles on any file change — including
 * Playwright's own artifacts — which invalidates in-flight Server Action ids and
 * leaves submitted forms hanging. Building first also exercises what ships.
 *
 * Artifacts live outside the repo for the same reason: nothing the run writes
 * should land in a watched directory.
 */
const ARTIFACTS = join(tmpdir(), "teamflow-e2e");

// Playwright's bundled Chromium has no build for macOS 13, so local runs use
// the installed Google Chrome; CI (Linux) gets the bundled browser.
const useSystemChrome = process.platform === "darwin" && !process.env.CI;
const chrome = {
  ...devices["Desktop Chrome"],
  ...(useSystemChrome ? { channel: "chrome" as const } : {}),
};

export const STORAGE_STATE = {
  leader: join(ARTIFACTS, "leader.json"),
  member: join(ARTIFACTS, "member.json"),
};

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: join(ARTIFACTS, "results"),
  fullyParallel: false, // the suite shares one database
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
  },

  projects: [
    // Signs in once per role and stores the sessions the others reuse.
    { name: "setup", testMatch: /auth\.setup\.ts/, use: chrome },

    // Exercises the sign-in flow itself, so it must start signed out.
    {
      name: "auth",
      testMatch: /auth\.spec\.ts/,
      use: { ...chrome, storageState: { cookies: [], origins: [] } },
    },

    {
      name: "leader",
      testMatch: /pages\.spec\.ts/,
      use: { ...chrome, storageState: STORAGE_STATE.leader },
      dependencies: ["setup"],
    },

    // The board flow switches roles itself, so it signs in as it goes.
    {
      name: "flows",
      testMatch: /board\.spec\.ts/,
      use: { ...chrome, storageState: { cookies: [], origins: [] } },
      dependencies: ["setup"],
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm start",
        url: "http://localhost:3000/login",
        reuseExistingServer: false,
        timeout: 300_000,
        env: { AUTH_RATE_LIMIT_MAX: "100" },
      },
});

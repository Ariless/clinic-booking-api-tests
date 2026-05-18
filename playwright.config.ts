import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

// Chromium only — avoids frozen WebKit on mac14-arm64 (Playwright warning).
// Install browsers: npx playwright install chromium
// Mobile project uses Pixel 7 (Android Chrome) — no WebKit dependency.
export default defineConfig({
  testDir: "./tests",
  globalTeardown: "./global-teardown",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["allure-playwright"],
      ]
    : [
        ["list"],
        ["allure-playwright"],
      ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    testIdAttribute: "data-qa",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testMatch: ["**/tests/ui/**/*.test.ts"],
    },
  ],
});

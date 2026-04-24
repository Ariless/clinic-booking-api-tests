const { defineConfig, devices } = require("@playwright/test");
require("dotenv").config();

// Chromium only — avoids frozen WebKit on mac14-arm64 (Playwright warning).
// Install browsers: npx playwright install chromium
module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
      ]
    : "list",
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
  ],
});

const { test, expect } = require("@playwright/test");

// Visual regression — compares page screenshots against committed baselines.
// To update baselines: npm run test:visual:update
// Baselines are platform-specific (darwin / linux) — CI baselines are generated separately.

test.describe("Visual regression @visual @ui", () => {
    test.use({ colorScheme: "light" });

    test("login page — empty state @visual", async ({ page }) => {
        await page.goto("/login");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("login-empty.png", {
            maxDiffPixelRatio: 0.02,
            animations: "disabled",
        });
    });

    test("login page — error state after invalid credentials @visual", async ({ page }) => {
        await page.goto("/login");
        await page.getByTestId("login-email").fill("wrong@test.com");
        await page.getByTestId("login-password").fill("wrongpassword");
        await page.getByTestId("login-submit").click();
        await expect(page.getByTestId("login-error")).toBeVisible();
        await expect(page).toHaveScreenshot("login-error.png", {
            maxDiffPixelRatio: 0.02,
            animations: "disabled",
        });
    });

    test("register patient page — empty state @visual", async ({ page }) => {
        await page.goto("/register-patient");
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot("register-patient-empty.png", {
            maxDiffPixelRatio: 0.02,
            animations: "disabled",
        });
    });
});

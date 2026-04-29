const { test, expect } = require("@playwright/test");

test("booking page — unauthenticated user sees sign-in gate @ui", async ({ page }) => {
    await page.goto("/patient/booking");
    await expect(page.getByTestId("booking-guest-gate")).toBeVisible();
    await expect(page.getByTestId("booking-guest-login")).toHaveAttribute("href", /\/login/);
});
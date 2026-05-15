import { test, expect } from "../../fixtures/pages";

test("booking page — unauthenticated user sees sign-in gate @ui", async ({ page }) => {
    await page.goto("/patient/booking");
    await expect(page.getByTestId("booking-guest-gate")).toBeVisible();
    await expect(page.getByTestId("booking-guest-login")).toHaveAttribute("href", /\/login/);
});

test("consultations page — unauthenticated user sees sign-in gate @ui", async ({ consultationsPage }) => {
    await consultationsPage.open();
    await expect(consultationsPage.guestGate).toBeVisible();
    await expect(consultationsPage.section).not.toBeVisible();
});

test("notifications page — unauthenticated user sees sign-in gate @ui", async ({ notificationsPage }) => {
    await notificationsPage.open();
    await expect(notificationsPage.guestGate).toBeVisible();
    await expect(notificationsPage.section).not.toBeVisible();
});

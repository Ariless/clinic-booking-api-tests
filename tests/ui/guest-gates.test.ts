import { test, expect } from "../../fixtures/pages";

test("booking wizard step 4 — unauthenticated user sees sign-in gate @ui", async ({ page }) => {
    // Guest gate lives on step 4; unauthenticated users can browse steps 1–3 freely
    await page.goto("/patient/booking?step=4&specialty=Cardiologist&doctorId=1&slotId=99");
    await page.waitForLoadState("networkidle");
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

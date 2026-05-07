const { test, expect } = require("@playwright/test");
const { ConsultationsPage } = require("../../pages/ConsultationsPage");
const { PatientNotificationsPage } = require("../../pages/PatientNotificationsPage");

test("booking page — unauthenticated user sees sign-in gate @ui", async ({ page }) => {
    await page.goto("/patient/booking");
    await expect(page.getByTestId("booking-guest-gate")).toBeVisible();
    await expect(page.getByTestId("booking-guest-login")).toHaveAttribute("href", /\/login/);
});

test("consultations page — unauthenticated user sees sign-in gate @ui", async ({ page }) => {
    const consultationsPage = new ConsultationsPage(page);
    await consultationsPage.open();
    await expect(consultationsPage.guestGate).toBeVisible();
    await expect(consultationsPage.section).not.toBeVisible();
});

test("notifications page — unauthenticated user sees sign-in gate @ui", async ({ page }) => {
    const notifPage = new PatientNotificationsPage(page);
    await notifPage.open();
    await expect(notifPage.guestGate).toBeVisible();
    await expect(notifPage.section).not.toBeVisible();
});

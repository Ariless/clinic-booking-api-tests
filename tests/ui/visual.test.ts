import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { AppointmentsPage } from "../../pages/AppointmentsPage";
import { AppointmentsClient } from "../../api/AppointmentsClient";

// Visual regression — compares screenshots against committed baselines.
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
        const loginPage = new LoginPage(page);
        await loginPage.submitForm("wrong@test.com", "wrongpassword");
        await expect(loginPage.errorMessage).toBeVisible();
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

    // Badge state tests use CSS property assertions, not pixel snapshots.
    // Reason: badge width varies by 1px between browser states (sub-pixel rendering),
    // causing size-mismatch failures even at 5% tolerance. CSS assertions are more
    // stable and test exactly what matters — the colour coding per state.
    test("patient appointments — pending badge colour @visual", async ({ request, page, user, slot }) => {
        const { slot: slotBody } = slot;
        const appts = new AppointmentsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

        await appts.createAppointment(slotBody.id, patientAuth);

        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();
        const badge = appointmentsPage.badgeByStatus("pending");
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText("Waiting on clinic");
        const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(bg).toBe("rgb(254, 243, 199)");
        const color = await badge.evaluate((el) => getComputedStyle(el).color);
        expect(color).toBe("rgb(146, 64, 14)");
    });

    test("patient appointments — confirmed badge colour @visual", async ({ request, page, user, slot }) => {
        const { slot: slotBody, doctorToken } = slot;
        const appts = new AppointmentsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

        const { body: bookBody } = await appts.createAppointment(slotBody.id, patientAuth);
        await appts.confirmAppointment(bookBody.id, doctorAuth);

        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();
        const badge = appointmentsPage.badgeByStatus("confirmed");
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText("Confirmed");
        const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(bg).toBe("rgb(209, 250, 229)");
        const color = await badge.evaluate((el) => getComputedStyle(el).color);
        expect(color).toBe("rgb(6, 95, 70)");
    });

    test("patient appointments — completed badge colour @visual", async ({ request, page, user, slot }) => {
        const { slot: slotBody, doctorToken } = slot;
        const appts = new AppointmentsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

        const { body: bookBody } = await appts.createAppointment(slotBody.id, patientAuth);
        await appts.confirmAppointment(bookBody.id, doctorAuth);
        await appts.completeAppointment(bookBody.id, doctorAuth);

        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();
        const badge = appointmentsPage.badgeByStatus("completed");
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText("Completed");
        const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(bg).toBe("rgb(241, 245, 249)");
        const color = await badge.evaluate((el) => getComputedStyle(el).color);
        expect(color).toBe("rgb(71, 85, 105)");
    });

    test("patient appointments — cancelled badge colour @visual", async ({ request, page, user, slot }) => {
        const { slot: slotBody } = slot;
        const appts = new AppointmentsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

        const { body: bookBody } = await appts.createAppointment(slotBody.id, patientAuth);
        await appts.cancelAppointment(bookBody.id, patientAuth);

        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();
        const badge = appointmentsPage.badgeByStatus("cancelled");
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText("Cancelled");
        const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
        expect(bg).toBe("rgb(254, 226, 226)");
        const color = await badge.evaluate((el) => getComputedStyle(el).color);
        expect(color).toBe("rgb(153, 27, 27)");
    });
});

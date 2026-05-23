import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { AppointmentsPage } from "../../pages/AppointmentsPage";

const SERIES_ID = "550e8400-e29b-41d4-a716-446655440000";

function paginatedBody(items: object[]) {
    return JSON.stringify({
        data: items,
        page: 1,
        limit: 20,
        total: items.length,
        totalPages: 1,
    });
}

test("patient appointments — series tag shown when seriesId present, absent without @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([
                    { id: 1, slotId: 101, patientId: 1, status: "confirmed" },
                    { id: 2, slotId: 102, patientId: 1, status: "confirmed", seriesId: SERIES_ID },
                ]),
            }),
        );

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        // default sort is id-desc → id=2 (seriesId) renders first, id=1 (no seriesId) second
        const items = appointmentsPage.appointmentsList.locator("li");
        await expect(items.first()).toContainText(`Series ${SERIES_ID.slice(0, 8)}`);
        await expect(items.nth(1)).not.toContainText("Series");
    },
);

test("patient appointments — cancel series button shown only for pending/confirmed with seriesId @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([
                    { id: 1, slotId: 101, patientId: 1, status: "pending", seriesId: SERIES_ID },
                    { id: 2, slotId: 102, patientId: 1, status: "confirmed", seriesId: SERIES_ID },
                    { id: 3, slotId: 103, patientId: 1, status: "pending" },
                    { id: 4, slotId: 104, patientId: 1, status: "cancelled", seriesId: SERIES_ID },
                ]),
            }),
        );

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        await expect(page.locator('[data-qa="patient-appt-cancel-series"]')).toHaveCount(2);
        await expect(page.locator(`[data-qa="patient-appt-cancel-series"][data-series-id="${SERIES_ID}"]`).first()).toBeVisible();
    },
);

test("patient appointments — cancel series via UI removes appointments from list and shows toast @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        let listCallCount = 0;
        await page.route("**/api/v1/appointments/my**", (route) => {
            listCallCount++;
            const items = listCallCount === 1
                ? [
                    { id: 1, slotId: 101, patientId: 1, status: "pending", seriesId: SERIES_ID },
                    { id: 2, slotId: 102, patientId: 1, status: "pending", seriesId: SERIES_ID },
                  ]
                : [];
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody(items),
            });
        });

        await page.route(`**/api/v1/appointments/series/${SERIES_ID}/cancel`, (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ seriesId: SERIES_ID, cancelledCount: 2, cancelled: [] }),
            }),
        );

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        await expect(page.locator('[data-qa="patient-appt-cancel-series"]').first()).toBeVisible();

        page.once("dialog", (dialog) => dialog.accept());
        await page.locator('[data-qa="patient-appt-cancel-series"]').first().click();

        await expect(appointmentsPage.toastSuccess).toBeVisible();
        await expect(page.locator('[data-qa="patient-appt-cancel-series"]')).toHaveCount(0);
    },
);

test("patient appointments — cancel series API error shows inline notice @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([
                    { id: 1, slotId: 101, patientId: 1, status: "pending", seriesId: SERIES_ID },
                ]),
            }),
        );

        await page.route(`**/api/v1/appointments/series/${SERIES_ID}/cancel`, (route) =>
            route.fulfill({
                status: 500,
                contentType: "application/json",
                body: JSON.stringify({ error: "Internal server error" }),
            }),
        );

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        page.once("dialog", (dialog) => dialog.accept());
        await page.locator('[data-qa="patient-appt-cancel-series"]').first().click();

        await expect(appointmentsPage.errorBanner).toBeVisible();
        await expect(appointmentsPage.errorBanner).toContainText("Couldn't cancel the series");
    },
);

import { test, expect } from "../../fixtures";

function paginatedBody(items: object[]) {
    return JSON.stringify({
        data: items,
        page: 1,
        limit: 20,
        total: items.length,
        totalPages: 1,
    });
}

test("patient appointments — reschedule button visible for pending and confirmed, absent for cancelled and completed @ui",
    async ({ page, user, loginPage, appointmentsPage }) => {
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([
                    { id: 1, slotId: 101, patientId: 1, status: "pending" },
                    { id: 2, slotId: 102, patientId: 1, status: "confirmed" },
                    { id: 3, slotId: 103, patientId: 1, status: "cancelled" },
                    { id: 4, slotId: 104, patientId: 1, status: "completed" },
                ]),
            }),
        );

        await appointmentsPage.open();

        await expect(page.locator('[data-qa="patient-appt-reschedule"][data-appt-id="1"]')).toBeVisible();
        await expect(page.locator('[data-qa="patient-appt-reschedule"][data-appt-id="2"]')).toBeVisible();
        await expect(page.locator('[data-qa="patient-appt-reschedule"][data-appt-id="3"]')).not.toBeAttached();
        await expect(page.locator('[data-qa="patient-appt-reschedule"][data-appt-id="4"]')).not.toBeAttached();
    },
);

test("patient appointments — reschedule via UI refreshes list to pending status @ui",
    async ({ page, user, loginPage, appointmentsPage }) => {
        await loginPage.login(user.email, user.password);

        let listCallCount = 0;
        await page.route("**/api/v1/appointments/my**", (route) => {
            listCallCount++;
            const apptStatus = listCallCount === 1 ? "confirmed" : "pending";
            const slotId = listCallCount === 1 ? 10 : 99;
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([{ id: 1, slotId, patientId: 1, status: apptStatus }]),
            });
        });

        await page.route("**/api/v1/appointments/1/reschedule", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ id: 1, slotId: 99, status: "pending" }),
            }),
        );

        await appointmentsPage.open();

        await expect(appointmentsPage.appointmentByStatus("confirmed")).toBeVisible();

        await page.locator('[data-qa="patient-appt-reschedule"][data-appt-id="1"]').click();
        await expect(page.getByTestId("patient-appt-reschedule-slot-input")).toBeVisible();

        await page.getByTestId("patient-appt-reschedule-slot-input").fill("99");
        await page.getByTestId("patient-appt-reschedule-confirm").click();

        await expect(appointmentsPage.appointmentByStatus("pending")).toBeVisible();
        await expect(appointmentsPage.toastSuccess).toBeVisible();
    },
);

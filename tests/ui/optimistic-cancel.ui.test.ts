import { test, expect } from "../../fixtures";

function paginatedBody(items: object[]) {
    return JSON.stringify({ data: items, page: 1, limit: 20, total: items.length, totalPages: 1 });
}

const PENDING_APPT = { id: 1, slotId: 101, patientId: 1, status: "pending" };

test.describe("patient appointments — optimistic cancel @ui", () => {

    test("patient appointments — row fades and cancel button disabled immediately after confirm @ui",
        async ({ page, user, loginPage, appointmentsPage }) => {
            await loginPage.login(user.email, user.password);

            await page.route("**/api/v1/appointments/my**", route =>
                route.fulfill({ status: 200, contentType: "application/json", body: paginatedBody([PENDING_APPT]) }),
            );

            let resolveCancel!: () => void;
            await page.route("**/api/v1/appointments/1/cancel**", async route => {
                await new Promise<void>(r => { resolveCancel = r; });
                await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 1, status: "cancelled" }) });
            });

            await appointmentsPage.open();

            const cancelBtn = page.locator('[data-qa="patient-appt-cancel"][data-appt-id="1"]');
            const li = page.locator('[data-qa="patient-appt-item"][data-appt-id="1"]');
            await expect(cancelBtn).toBeVisible();

            page.once("dialog", d => d.accept());
            await cancelBtn.click();

            // while API is in-flight — DOM must already reflect optimistic state
            await expect(cancelBtn).toBeDisabled();
            await expect(li).toHaveCSS("opacity", "0.35");

            resolveCancel();
        },
    );

    test("patient appointments — row and button restored when cancel API returns 500 @ui",
        async ({ page, user, loginPage, appointmentsPage }) => {
            await loginPage.login(user.email, user.password);

            await page.route("**/api/v1/appointments/my**", route =>
                route.fulfill({ status: 200, contentType: "application/json", body: paginatedBody([PENDING_APPT]) }),
            );

            await page.route("**/api/v1/appointments/1/cancel**", route =>
                route.fulfill({
                    status: 500,
                    contentType: "application/json",
                    body: JSON.stringify({ errorCode: "INTERNAL_ERROR", message: "Something went wrong." }),
                }),
            );

            await appointmentsPage.open();

            const cancelBtn = page.locator('[data-qa="patient-appt-cancel"][data-appt-id="1"]');
            const li = page.locator('[data-qa="patient-appt-item"][data-appt-id="1"]');

            page.once("dialog", d => d.accept());
            await cancelBtn.click();

            await expect(cancelBtn).toBeEnabled();
            await expect(li).toHaveCSS("opacity", "1");
            await expect(page.getByTestId("patient-appt-banner")).toBeVisible();
        },
    );

    test("patient appointments — second click while cancel in flight sends no extra request @ui",
        async ({ page, user, loginPage, appointmentsPage }) => {
            await loginPage.login(user.email, user.password);

            let listCallCount = 0;
            await page.route("**/api/v1/appointments/my**", route => {
                listCallCount++;
                const status = listCallCount === 1 ? "pending" : "cancelled";
                route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: paginatedBody([{ ...PENDING_APPT, status }]),
                });
            });

            let requestCount = 0;
            let resolveCancel!: () => void;
            await page.route("**/api/v1/appointments/1/cancel**", async route => {
                requestCount++;
                await new Promise<void>(r => { resolveCancel = r; });
                await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 1, status: "cancelled" }) });
            });

            await appointmentsPage.open();

            const cancelBtn = page.locator('[data-qa="patient-appt-cancel"][data-appt-id="1"]');
            await expect(cancelBtn).toBeVisible();

            page.once("dialog", d => d.accept());
            await cancelBtn.click();

            // button is disabled — verify second click is blocked before releasing route
            await expect(cancelBtn).toBeDisabled();
            await cancelBtn.click({ force: true });
            expect(requestCount).toBe(1);

            resolveCancel();
            // second list call returns "cancelled" — cancel button not rendered for cancelled status
            await expect(cancelBtn).not.toBeAttached();
        },
    );

});

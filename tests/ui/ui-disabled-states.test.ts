import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { BookingPage } from "../../pages/BookingPage";
import { AppointmentsPage } from "../../pages/AppointmentsPage";

function paginatedBody(items: object[]) {
    return JSON.stringify({ data: items, page: 1, limit: 20, total: items.length, totalPages: 1 });
}

const FUTURE_START = "2026-08-01T09:00:00.000Z";
const FUTURE_END = "2026-08-01T10:00:00.000Z";

test("booking page — doctor select disabled until specialty chosen, enabled after @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        // **/api/v1/doctors without trailing ** matches only the list endpoint, not /doctors/:id/slots
        await page.route("**/api/v1/doctors", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify([{ id: 1, name: "John Doe", specialty: "Cardiologist" }]),
            }),
        );

        const bookingPage = new BookingPage(page);
        await bookingPage.open();

        // Doctor select starts disabled — set in HTML before any specialty is chosen
        await expect(bookingPage.bookingDoctor).toBeDisabled();

        // Select specialty → doctor dropdown becomes enabled
        await bookingPage.bookingSpeciality.selectOption("Cardiologist");
        await expect(bookingPage.bookingDoctor).toBeEnabled();
    },
);

test("patient appointments — offer accept button re-enabled after API error @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([]),
            }),
        );

        await page.route("**/api/v1/appointments/waitlist/me**", (route) =>
            route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
        );

        // exact path — does not match /waitlist-offers/1/accept
        await page.route("**/api/v1/appointments/waitlist-offers", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify([
                    {
                        id: 1,
                        doctorName: "John Doe",
                        startTime: FUTURE_START,
                        endTime: FUTURE_END,
                        expiresAt: new Date(Date.now() + 3600000).toISOString(),
                    },
                ]),
            }),
        );

        await page.route("**/api/v1/appointments/waitlist-offers/*/accept**", (route) =>
            route.fulfill({
                status: 500,
                contentType: "application/json",
                body: JSON.stringify({ error: "Internal server error" }),
            }),
        );

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        const acceptBtn = appointmentsPage.offerAcceptButton();
        await expect(acceptBtn).toBeVisible();
        await expect(acceptBtn).toBeEnabled();

        // Accept → confirm dialog → API returns 500
        page.once("dialog", (dialog) => dialog.accept());
        await acceptBtn.click();

        // Error notice shown
        await expect(appointmentsPage.errorBanner).toBeVisible();

        // Button re-enabled after error — not stuck in disabled state
        await expect(acceptBtn).toBeEnabled();
    },
);

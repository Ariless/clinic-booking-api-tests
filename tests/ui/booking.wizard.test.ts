import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { BookingPage } from "../../pages/BookingPage";

const MOCK_DOCTOR = { id: 1, name: "Dr. Alice Smith", specialty: "Cardiologist" };
const MOCK_SLOT = {
    id: 99,
    doctorId: 1,
    status: "open",
    startTime: "2099-06-15T09:00:00.000Z",
    endTime: "2099-06-15T09:30:00.000Z",
};

test.describe("booking wizard — progress and navigation @ui", () => {

    test("booking wizard — step label shows 'Step 1 of 4' and step 1 visible on load @smoke @ui",
        async ({ page, user }) => {
            await page.route("**/api/v1/doctors", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_DOCTOR]) }),
            );

            const loginPage = new LoginPage(page);
            await loginPage.login(user.email, user.password);

            const bookingPage = new BookingPage(page);
            await bookingPage.open();

            await expect(bookingPage.wizardStepLabel).toHaveText("Step 1 of 4");
            await expect(bookingPage.wizardStep1).toBeVisible();
            await expect(bookingPage.wizardStep2).not.toBeVisible();
            await expect(bookingPage.wizardStep3).not.toBeVisible();
            await expect(bookingPage.wizardStep4).not.toBeVisible();
        },
    );

    test("booking wizard — Next button disabled until specialty is chosen @ui",
        async ({ page, user }) => {
            await page.route("**/api/v1/doctors", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_DOCTOR]) }),
            );

            const loginPage = new LoginPage(page);
            await loginPage.login(user.email, user.password);

            const bookingPage = new BookingPage(page);
            await bookingPage.open();

            await expect(bookingPage.step1Next).toBeDisabled();
            await bookingPage.bookingSpeciality.selectOption(MOCK_DOCTOR.specialty);
            await expect(bookingPage.step1Next).toBeEnabled();
        },
    );

    test("booking wizard — URL-skip to step 3 without doctorId redirects to step 1 @ui",
        async ({ page, user }) => {
            await page.route("**/api/v1/doctors", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_DOCTOR]) }),
            );

            const loginPage = new LoginPage(page);
            await loginPage.login(user.email, user.password);

            const bookingPage = new BookingPage(page);
            // Navigate to step 3 with specialty but no doctorId — resolvedStep() clamps to 1
            await bookingPage.openAtStep(3, { specialty: MOCK_DOCTOR.specialty });
            await page.waitForLoadState("networkidle");

            await expect(bookingPage.wizardStepLabel).toHaveText("Step 1 of 4");
            await expect(bookingPage.wizardStep1).toBeVisible();
            await expect(bookingPage.wizardStep3).not.toBeVisible();
        },
    );

    test("booking wizard — back from step 2 returns to step 1 with specialty preserved @ui",
        async ({ page, user }) => {
            await page.route("**/api/v1/doctors", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_DOCTOR]) }),
            );

            const loginPage = new LoginPage(page);
            await loginPage.login(user.email, user.password);

            const bookingPage = new BookingPage(page);
            await bookingPage.openAtStep(2, { specialty: MOCK_DOCTOR.specialty });
            await page.waitForLoadState("networkidle");

            await expect(bookingPage.wizardStep2).toBeVisible();

            await Promise.all([
                page.waitForURL(/step=1/),
                bookingPage.step2Back.click(),
            ]);

            await page.waitForLoadState("networkidle");
            await expect(bookingPage.wizardStep1).toBeVisible();
            // Specialty pre-populated from URL param on return
            await expect(bookingPage.bookingSpeciality).toHaveValue(MOCK_DOCTOR.specialty);
        },
    );

    test("booking wizard step 3 — Next disabled until time is selected @ui",
        async ({ page, user }) => {
            await page.route("**/api/v1/doctors", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_DOCTOR]) }),
            );
            await page.route("**/api/v1/doctors/*/slots**", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_SLOT]) }),
            );

            const loginPage = new LoginPage(page);
            await loginPage.login(user.email, user.password);

            const bookingPage = new BookingPage(page);
            await bookingPage.openAtStep(3, {
                specialty: MOCK_DOCTOR.specialty,
                doctorId: String(MOCK_DOCTOR.id),
            });
            await page.waitForLoadState("networkidle");

            // First day is auto-selected and options populated, but Next is still disabled
            await expect(bookingPage.step3Next).toBeDisabled();

            // Select a time → Next becomes enabled
            const firstTime = await bookingPage.bookingTimeSlot.locator("option").nth(1).getAttribute("value");
            await bookingPage.bookingTimeSlot.selectOption(firstTime!);
            await expect(bookingPage.step3Next).toBeEnabled();
        },
    );

    test("booking wizard step 4 — 409 shows slot-taken message and back button remains @ui",
        async ({ page, user }) => {
            await page.route("**/api/v1/doctors", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_DOCTOR]) }),
            );
            await page.route("**/api/v1/doctors/*/slots**", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_SLOT]) }),
            );
            await page.route("**/api/v1/appointments", (route) => {
                if (route.request().method() === "POST") {
                    route.fulfill({
                        status: 409,
                        contentType: "application/json",
                        body: JSON.stringify({ errorCode: "SLOT_TAKEN", message: "Slot is already booked" }),
                    });
                } else {
                    route.continue();
                }
            });

            const loginPage = new LoginPage(page);
            await loginPage.login(user.email, user.password);

            const bookingPage = new BookingPage(page);
            await bookingPage.openAtStep(4, {
                specialty: MOCK_DOCTOR.specialty,
                doctorId: String(MOCK_DOCTOR.id),
                slotId: String(MOCK_SLOT.id),
            });
            await page.waitForLoadState("networkidle");

            await bookingPage.submitBookingButton.click();

            await expect(bookingPage.bookingFormMessage).toContainText("slot was just taken");
            await expect(bookingPage.step4Back).toBeVisible();
        },
    );

    test("booking wizard — progress dots reflect current step @ui",
        async ({ page, user }) => {
            await page.route("**/api/v1/doctors", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_DOCTOR]) }),
            );
            await page.route("**/api/v1/doctors/*/slots**", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([MOCK_SLOT]) }),
            );

            const loginPage = new LoginPage(page);
            await loginPage.login(user.email, user.password);
            const bookingPage = new BookingPage(page);

            // Step 1: dot-1 active, others plain
            await bookingPage.open();
            await expect(bookingPage.wizardDot1).toHaveClass(/is-active/);
            await expect(bookingPage.wizardDot2).not.toHaveClass(/is-active|is-done/);

            // Step 2: dot-1 done, dot-2 active
            await bookingPage.openAtStep(2, { specialty: MOCK_DOCTOR.specialty });
            await page.waitForLoadState("networkidle");
            await expect(bookingPage.wizardDot1).toHaveClass(/is-done/);
            await expect(bookingPage.wizardDot2).toHaveClass(/is-active/);

            // Step 4: dots 1-3 done, dot-4 active
            await bookingPage.openAtStep(4, {
                specialty: MOCK_DOCTOR.specialty,
                doctorId: String(MOCK_DOCTOR.id),
                slotId: String(MOCK_SLOT.id),
            });
            await page.waitForLoadState("networkidle");
            await expect(bookingPage.wizardDot1).toHaveClass(/is-done/);
            await expect(bookingPage.wizardDot2).toHaveClass(/is-done/);
            await expect(bookingPage.wizardDot3).toHaveClass(/is-done/);
            await expect(bookingPage.wizardDot4).toHaveClass(/is-active/);
        },
    );
});

import { test, expect } from "../../fixtures";
import { AppointmentsClient } from "../../api/AppointmentsClient";

const SERVER_ERROR = { status: 500, body: JSON.stringify({ errorCode: "INTERNAL_ERROR", message: "Server error" }) };

test.describe("API error states — page.route() @ui", () => {

    test("booking wizard step 4 — POST /appointments 500, error message visible, submit still present @ui", async ({ page, user, slot, loginPage, bookingPage }) => {
        const { slot: slotBody, doctor } = slot;

        await loginPage.login(user.email, user.password);

        // Navigate directly to step 4 with all wizard params populated
        await bookingPage.openAtStep(4, {
            specialty: doctor.specialty,
            doctorId: String(doctor.doctorRecordId),
            slotId: String(slotBody.id),
        });
        await page.waitForLoadState("networkidle");

        await page.route("**/api/v1/appointments", (route) => {
            if (route.request().method() === "POST") {
                route.fulfill(SERVER_ERROR);
            } else {
                route.continue();
            }
        });

        await bookingPage.submitBookingButton.click();

        await expect(bookingPage.bookingFormMessage).toBeVisible();
        await expect(bookingPage.bookingFormMessage).not.toBeEmpty();
        await expect(bookingPage.submitBookingButton).toBeVisible();
    });

    test("patient appointments — cancel 500, appointment stays in list, error shown @ui", async ({ request, page, user, slot, loginPage, appointmentsPage }) => {
        const { slot: slotBody } = slot;
        const appts = new AppointmentsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

        await appts.createAppointment(slotBody.id, patientAuth);

        await loginPage.login(user.email, user.password);

        await appointmentsPage.open();
        await expect(appointmentsPage.appointmentByStatus("pending")).toBeVisible();

        await page.route("**/api/v1/appointments/*/cancel", (route) => route.fulfill(SERVER_ERROR));

        page.on("dialog", (d) => d.accept());
        await appointmentsPage.cancelButton.click();

        await expect(appointmentsPage.errorBanner).toBeVisible();
        await expect(appointmentsPage.appointmentByStatus("pending")).toBeVisible();
    });

    test("patient appointments — network drop on load, error banner shown @ui", async ({ page, user, loginPage, appointmentsPage }) => {
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my**", (route) => route.abort());

        await appointmentsPage.open();

        await expect(appointmentsPage.errorBanner).toBeVisible();
        await expect(appointmentsPage.appointmentsList).toBeVisible();
    });
});

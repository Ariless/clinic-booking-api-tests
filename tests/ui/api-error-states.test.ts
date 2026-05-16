import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { BookingPage } from "../../pages/BookingPage";
import { AppointmentsPage } from "../../pages/AppointmentsPage";
import { AppointmentsClient } from "../../api/AppointmentsClient";

const SERVER_ERROR = { status: 500, body: JSON.stringify({ errorCode: "INTERNAL_ERROR", message: "Server error" }) };

test.describe("API error states — page.route() @ui", () => {

    test("booking page — POST /appointments 500, error banner visible, page intact @ui", async ({ request, page, user, slot }) => {
        const { slot: slotBody, doctor } = slot;

        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        const bookingPage = new BookingPage(page);
        await bookingPage.open();

        await expect(bookingPage.bookingDoctorWrap).toBeVisible();
        await bookingPage.bookingSpeciality.selectOption(doctor.specialty);
        await expect(bookingPage.bookingDoctor).toBeEnabled();
        await bookingPage.bookingDoctor.selectOption(doctor.name);
        await expect(bookingPage.bookingSlotPicker).toBeVisible();
        const firstDay = await bookingPage.bookingDaySlot.locator("option").nth(1).getAttribute("value");
        await bookingPage.bookingDaySlot.selectOption(firstDay!);
        await expect(bookingPage.bookingTimeSlot).toBeEnabled();
        const firstTime = await bookingPage.bookingTimeSlot.locator("option").nth(1).getAttribute("value");
        await bookingPage.bookingTimeSlot.selectOption(firstTime!);

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

    test("patient appointments — cancel 500, appointment stays in list, error shown @ui", async ({ request, page, user, slot }) => {
        const { slot: slotBody } = slot;
        const appts = new AppointmentsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

        await appts.createAppointment(slotBody.id, patientAuth);

        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();
        await expect(appointmentsPage.appointmentByStatus("pending")).toBeVisible();

        await page.route("**/api/v1/appointments/*/cancel", (route) => route.fulfill(SERVER_ERROR));

        page.on("dialog", (d) => d.accept());
        await appointmentsPage.cancelButton.click();

        await expect(appointmentsPage.errorBanner).toBeVisible();
        await expect(appointmentsPage.appointmentByStatus("pending")).toBeVisible();
    });

    test("patient appointments — network drop on load, error banner shown @ui", async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my", (route) => route.abort());

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        await expect(appointmentsPage.errorBanner).toBeVisible();
        await expect(appointmentsPage.appointmentsList).toBeVisible();
    });
});

import { test, expect } from "../../fixtures";
import { AppointmentsClient } from "../../api/AppointmentsClient";

function paginatedBody(items: object[]) {
    return JSON.stringify({ data: items, page: 1, limit: 20, total: items.length, totalPages: 1 });
}

// Two slots on different days — prevents the booking page from auto-selecting
// the only available day, which would immediately enable the time picker
const FUTURE_SLOTS = [
    { id: 1, startTime: "2026-09-01T09:00:00.000Z", endTime: "2026-09-01T10:00:00.000Z", isAvailable: true },
    { id: 2, startTime: "2026-09-02T09:00:00.000Z", endTime: "2026-09-02T10:00:00.000Z", isAvailable: true },
];

const MOCK_DOCTOR = { id: 1, name: "Dr. Smith", specialty: "Cardiologist" };

// ─── patient appointments ─────────────────────────────────────────────────────

test.describe("patient appointments — empty and success states @ui", () => {

    test("patient appointments — 'No visits yet' shown when list is empty @ui",
        async ({ page, user, loginPage, appointmentsPage }) => {
            await loginPage.login(user.email, user.password);

            await page.route("**/api/v1/appointments/my**", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: paginatedBody([]) }),
            );

            await appointmentsPage.open();

            await expect(page.getByTestId("patient-appt-empty")).toBeVisible();
            await expect(page.getByText("No visits yet")).toBeVisible();
        },
    );

    test("patient appointments — 'No results' shown when filter matches no visits @ui",
        async ({ page, user, loginPage, appointmentsPage }) => {
            await loginPage.login(user.email, user.password);

            await page.route("**/api/v1/appointments/my**", (route) =>
                route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: paginatedBody([{
                        id: 1,
                        status: "pending",
                        slotStartTime: "2026-09-01T09:00:00.000Z",
                        slotEndTime: "2026-09-01T10:00:00.000Z",
                        doctorName: "Dr. Smith",
                        specialty: "Cardiologist",
                    }]),
                }),
            );

            await appointmentsPage.open();

            await page.getByTestId("patient-appt-filter-status").selectOption("completed");

            await expect(page.getByText("No results")).toBeVisible();
            await expect(page.getByText("No visits match this filter")).toBeVisible();
        },
    );

    test("patient appointments — success toast shown after cancel @ui",
        async ({ request, page, user, slot, loginPage, appointmentsPage }) => {
            const appts = new AppointmentsClient(request);
            const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
            await appts.createAppointment(slot.slot.id, patientAuth);

            await loginPage.login(user.email, user.password);

            await appointmentsPage.open();
            await expect(appointmentsPage.appointmentByStatus("pending")).toBeVisible();

            page.once("dialog", (d) => d.accept());
            await appointmentsPage.cancelButton.click();

            await expect(appointmentsPage.toastSuccess).toBeVisible();
            await expect(appointmentsPage.toastSuccess).toContainText("cancelled");
        },
    );
});

// ─── booking page ─────────────────────────────────────────────────────────────

test.describe("booking page — empty, success, and disabled states @ui", () => {

    test("booking page — empty panel shown when no doctors available @ui",
        async ({ page, user, loginPage, bookingPage }) => {
            await loginPage.login(user.email, user.password);

            await page.route("**/api/v1/doctors", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
            );

            await bookingPage.open();

            await expect(page.getByTestId("booking-doctors-empty")).toBeVisible();
        },
    );

    test("booking wizard step 3 — empty slots panel shown when doctor has no available times @ui",
        async ({ page, user, loginPage, bookingPage }) => {
            await loginPage.login(user.email, user.password);

            await page.route("**/api/v1/doctors", (route) =>
                route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify([MOCK_DOCTOR]),
                }),
            );
            await page.route("**/api/v1/doctors/*/slots**", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
            );

            await bookingPage.openAtStep(3, { specialty: MOCK_DOCTOR.specialty, doctorId: String(MOCK_DOCTOR.id) });
            await page.waitForLoadState("networkidle");

            await expect(page.getByTestId("booking-slots-empty")).toBeVisible();
        },
    );

    test("booking wizard — success message shown after booking @ui",
        async ({ user, slot, loginPage, bookingPage }) => {
            await loginPage.login(user.email, user.password);

            await bookingPage.walkWizard(slot.doctor.specialty, slot.doctor.name);

            await bookingPage.submitBookingButton.click();

            await expect(bookingPage.bookingSuccessMessage).toBeVisible();
        },
    );

    test("booking wizard step 3 — slot pickers visible and time enabled when slots exist @ui",
        async ({ page, user, loginPage, bookingPage }) => {
            await loginPage.login(user.email, user.password);

            await page.route("**/api/v1/doctors", (route) =>
                route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify([MOCK_DOCTOR]),
                }),
            );
            await page.route("**/api/v1/doctors/*/slots**", (route) =>
                route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify(FUTURE_SLOTS),
                }),
            );

            await bookingPage.openAtStep(3, { specialty: MOCK_DOCTOR.specialty, doctorId: String(MOCK_DOCTOR.id) });
            await page.waitForLoadState("networkidle");

            await expect(bookingPage.bookingSlotPicker).toBeVisible();
            // First day auto-selected → time select is enabled without manual day selection
            await expect(bookingPage.bookingTimeSlot).toBeEnabled();
        },
    );
});

// ─── doctor appointments ──────────────────────────────────────────────────────

test.describe("doctor appointments — empty and error states @ui", () => {

    test("doctor appointments — 'No incoming requests' shown when list is empty @ui",
        async ({ page, slot, loginPage, doctorAppointmentsPage: doctorPage }) => {
            await loginPage.login(slot.doctor.email, slot.doctor.password);

            await page.route("**/api/v1/appointments/doctor**", (route) =>
                route.fulfill({ status: 200, contentType: "application/json", body: paginatedBody([]) }),
            );

            await doctorPage.open();

            await expect(page.getByTestId("doctor-appt-empty")).toBeVisible();
            await expect(page.getByText("No incoming requests")).toBeVisible();
        },
    );

    test("doctor appointments — error banner shown on network failure @ui",
        async ({ page, slot, loginPage, doctorAppointmentsPage: doctorPage }) => {
            await loginPage.login(slot.doctor.email, slot.doctor.password);

            await page.route("**/api/v1/appointments/doctor**", (route) => route.abort());

            await doctorPage.open();

            await expect(page.getByTestId("doctor-appt-banner-error")).toBeVisible();
        },
    );
});

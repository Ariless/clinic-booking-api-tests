import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { DoctorAppointmentsPage } from "../../pages/DoctorAppointmentsPage";
import { AppointmentsClient } from "../../api/AppointmentsClient";
import { seedDoctors } from "../../data/seedAccounts";

const doctor = seedDoctors[0];

test("patient books via API — doctor appointments page shows booking toast without reload @e2e", async ({
    page,
    request,
    user,
    slot,
}) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    // 1. DOCTOR logs in via UI and opens appointments page
    const loginPage = new LoginPage(page);
    await loginPage.login(doctor.email, doctor.password);

    const doctorApptPage = new DoctorAppointmentsPage(page);
    await doctorApptPage.open();

    // 2. WAIT for WebSocket connection to be established
    await doctorApptPage.waitForConnection();

    // 3. PATIENT books via API — triggers appointment.booked WS event to doctor
    const { status: bookStatus } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);

    // 4. ASSERT toast appears in doctor UI without any page reload
    await expect(doctorApptPage.wsToast).toBeVisible();
    await expect(doctorApptPage.wsToast).toContainText("New booking received");
});

test("patient cancels via API — doctor appointments page shows cancellation toast without reload @e2e", async ({
    page,
    request,
    user,
    slot,
}) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    // 1. PATIENT books first via API (before doctor opens the page)
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);

    // 2. DOCTOR logs in via UI and opens appointments page
    const loginPage = new LoginPage(page);
    await loginPage.login(doctor.email, doctor.password);

    const doctorApptPage = new DoctorAppointmentsPage(page);
    await doctorApptPage.open();

    // 3. WAIT for WebSocket connection to be established
    await doctorApptPage.waitForConnection();

    // 4. PATIENT cancels via API — triggers appointment.cancelled_by_patient WS event
    const { status: cancelStatus } = await appointments.cancelAppointment(bookBody.id, patientAuth);
    expect(cancelStatus).toBe(200);

    // 5. ASSERT cancellation toast appears in doctor UI without any page reload
    await expect(doctorApptPage.wsToast).toBeVisible();
    await expect(doctorApptPage.wsToast).toContainText("A patient cancelled");
});

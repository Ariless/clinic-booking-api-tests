const { test, expect } = require("../../fixtures");
const { LoginPage } = require("../../pages/LoginPage");
const { PatientNotificationsPage } = require("../../pages/PatientNotificationsPage");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

test("doctor confirms via API — patient notification page shows appointment.confirmed @e2e", async ({ request, page, user, slot }) => {
    const { slot: slotBody, doctorToken } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    // 1. BOOK via API
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);

    // 2. LOGIN as patient via UI and open notifications page
    const loginPage = new LoginPage(page);
    await loginPage.login(user.email, user.password);

    const notifPage = new PatientNotificationsPage(page);
    await notifPage.open();

    // 3. WAIT for WebSocket connection to be established
    await notifPage.waitForConnection();

    // 4. DOCTOR confirms via API — triggers notifyPatient on server
    const { status: confirmStatus } = await appointments.confirmAppointment(bookBody.id, doctorAuth);
    expect(confirmStatus).toBe(200);

    // 5. ASSERT notification item appears in the UI
    await expect(notifPage.notifItem("appointment.confirmed")).toBeVisible();
    await expect(
        notifPage.notifItem("appointment.confirmed").getByTestId("patient-notif-item-label")
    ).toContainText("confirmed");
});

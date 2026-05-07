const { test, expect } = require("../../fixtures");
const { LoginPage } = require("../../pages/LoginPage");
const { AppointmentsPage } = require("../../pages/AppointmentsPage");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

test("doctor confirms via API — patient UI shows confirmed status @e2e", async ({ request, page, user, slot }) => {
    const { slot: slotBody, doctorToken } = slot;
    const appointments = new AppointmentsClient(request);

    // 1. BOOK via API
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(bookStatus).toBe(201);

    // 2. CONFIRM via API
    const { status: confirmStatus } = await appointments.confirmAppointment(bookBody.id, {
        headers: { Authorization: `Bearer ${doctorToken}` },
    });
    expect(confirmStatus).toBe(200);

    // 3. LOGIN via UI
    const loginPage = new LoginPage(page);
    await loginPage.login(user.email, user.password);

    // 4. OPEN appointments page
    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.open();

    // 5. ASSERT confirmed status visible in UI
    await expect(appointmentsPage.appointmentByStatus("confirmed")).toBeVisible();
});

const { test, expect } = require("../../fixtures");
const { LoginPage } = require("../../pages/LoginPage");
const { AppointmentsPage } = require("../../pages/AppointmentsPage");
const { AppointmentsClient } = require("../../api/AppointmentsClient");
const { dbClient } = require("../../utils/dbClient");

test("patient leaves waitlist via UI — removed from waitlist in API @e2e", async ({ request, page, user, slot }) => {
    const { doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    // 1. JOIN waitlist via API
    const { status: joinStatus, body: joinBody } = await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
    expect(joinStatus).toBe(201);

    // 2. LOGIN via UI
    const loginPage = new LoginPage(page);
    await loginPage.login(user.email, user.password);

    // 3. OPEN appointments page
    const appointmentsPage = new AppointmentsPage(page);
    await appointmentsPage.open();

    // 4. ASSERT waitlist section visible with the entry
    await expect(appointmentsPage.waitlistSection).toBeVisible();
    await expect(appointmentsPage.waitlistItem()).toBeVisible();

    // 5. ACCEPT dialog and click Leave
    page.on("dialog", (dialog) => dialog.accept());
    await appointmentsPage.waitlistLeaveButton().click();

    // 6. ASSERT waitlist item gone from UI
    await expect(appointmentsPage.waitlistItem()).not.toBeVisible();

    // 7. VERIFY cross-layer — waitlist empty in API
    const { status: listStatus, body: listBody } = await appointments.getMyWaitlist(patientAuth);
    expect(listStatus).toBe(200);
    const stillOnList = listBody.find((w) => w.id === joinBody.id);
    expect(stillOnList).toBeUndefined();

    // 8. VERIFY DB — waitlist entry physically removed
    const dbWaitlist = dbClient.getWaitlistByPatient(user.user.id);
    const stillInDb = dbWaitlist.find((w) => w.id === joinBody.id);
    expect(stillInDb, "DB: waitlist entry must be deleted").toBeUndefined();
});

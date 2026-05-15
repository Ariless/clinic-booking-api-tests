import { test, expect } from "../../fixtures/twoUsersFixture";
import { AppointmentsClient } from "../../api/AppointmentsClient";
import { DoctorsClient } from "../../api/DoctorsClient";
import { LoginPage } from "../../pages/LoginPage";
import { AppointmentsPage } from "../../pages/AppointmentsPage";
import { dbClient } from "../../utils/dbClient";
import { nextSeedSlotWindow } from "../../data/seedAccounts";

test("offer accept — patient sees offer in UI, accepts, booking swapped @e2e", async ({ request, page, user, user2, slot }) => {
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    // Create second slot for same doctor
    const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
    const { status: slot2Status, body: slot2 } = await doctors.createSlot(
        doctor.doctorRecordId, seedSlotStart, seedSlotEnd, true, doctorAuth
    );
    expect(slot2Status).toBe(201);

    try {
        // API setup: user1 books slot1, user2 books slot2, user1 joins waitlist
        const { status: book1Status, body: book1Body } = await appointments.createAppointment(slot1Body.id, patientAuth);
        expect(book1Status).toBe(201);

        const { status: book2Status, body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        expect(book2Status).toBe(201);

        const { status: joinStatus } = await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        expect(joinStatus).toBe(201);

        // user2 cancels → offer created for user1
        const { status: cancelStatus } = await appointments.cancelAppointment(book2Body.id, patient2Auth);
        expect(cancelStatus).toBe(200);

        // UI: user1 logs in and opens appointments page
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        // Offers section must be visible with one offer item
        await expect(appointmentsPage.offersSection).toBeVisible();
        await expect(appointmentsPage.offerItem()).toBeVisible();

        // Click Accept — confirm dialog appears ("Are you sure you want to swap…")
        page.on("dialog", (dialog) => dialog.accept());
        await appointmentsPage.offerAcceptButton().click();

        // Offers section must disappear after accept
        await expect(appointmentsPage.offersSection).not.toBeVisible();

        // Cross-layer API: old booking cancelled, new booking on slot2 exists
        const { body: myAppts } = await appointments.listMy(patientAuth);
        const oldAppt = myAppts.find((a: { id: number; status: string }) => a.id === book1Body.id);
        expect(oldAppt.status, "old appointment must be cancelled after accept").toBe("cancelled");

        const newAppt = myAppts.find((a: { slotId: number; status: string }) => a.slotId === slot2.id && a.status === "pending");
        expect(newAppt, "new appointment on offered slot must exist").toBeDefined();

        // DB: slot1 freed, slot2 now belongs to user1, waitlist removed
        const dbSlot1Appts = dbClient.getActiveAppointmentsForSlot(slot1Body.id);
        expect(dbSlot1Appts, "DB: slot1 must have no active appointments after accept").toHaveLength(0);

        const dbSlot2Appts = dbClient.getActiveAppointmentsForSlot(slot2.id);
        expect(dbSlot2Appts, "DB: slot2 must have exactly one active appointment").toHaveLength(1);
        expect(dbSlot2Appts[0].patientId, "DB: slot2 appointment must belong to user1").toBe(user.user.id);

        const dbWaitlist = dbClient.getWaitlistByPatient(user.user.id);
        expect(dbWaitlist.some((w: { doctorId: number }) => w.doctorId === doctor.doctorRecordId), "DB: waitlist entry must be removed after accept").toBe(false);
    } finally {
        await doctors.deleteSlot(slot2.id, doctorAuth);
    }
});

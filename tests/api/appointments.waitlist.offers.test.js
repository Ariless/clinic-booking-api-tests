const { test, expect } = require("../../fixtures/twoUsersFixture");
const { AppointmentsClient } = require("../../api/AppointmentsClient");
const { DoctorsClient } = require("../../api/DoctorsClient");
const { dbClient } = require("../../utils/dbClient");
const { nextSeedSlotWindow } = require("../../data/seedAccounts");

// Helper: create a second slot for the same doctor and return it with cleanup
async function withSecondSlot(doctors, doctor, doctorAuth, fn) {
    const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
    const { status, body: slot2 } = await doctors.createSlot(
        doctor.doctorRecordId, seedSlotStart, seedSlotEnd, true, doctorAuth
    );
    if (status !== 201) throw new Error(`second slot creation failed: ${JSON.stringify(slot2)}`);
    try {
        return await fn(slot2);
    } finally {
        await doctors.deleteSlot(slot2.id, doctorAuth);
    }
}

test("GET /api/v1/appointments/waitlist-offers — returns pending offers for patient @api", async ({ request, user, user2, slot }) => {
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    await withSecondSlot(doctors, doctor, doctorAuth, async (slot2) => {
        // user1 books slot1 → active appointment
        const { status: book1Status } = await appointments.createAppointment(slot1Body.id, patientAuth);
        expect(book1Status).toBe(201);

        // user2 books slot2
        const { status: book2Status, body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        expect(book2Status).toBe(201);

        // user1 joins waitlist (has active booking on slot1)
        const { status: joinStatus } = await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        expect(joinStatus).toBe(201);

        // user2 cancels slot2 → offer should be created for user1
        const { status: cancelStatus } = await appointments.cancelAppointment(book2Body.id, patient2Auth);
        expect(cancelStatus).toBe(200);

        // user1 should see a pending offer
        const { status: offersStatus, body: offers } = await appointments.getWaitlistOffers(patientAuth);
        expect(offersStatus).toBe(200);
        expect(Array.isArray(offers)).toBe(true);
        expect(offers.length).toBeGreaterThanOrEqual(1);

        const offer = offers.find(o => o.slotId === slot2.id);
        expect(offer, "offer for freed slot should exist").toBeDefined();
        expect(offer.status).toBe("pending");
        expect(offer.patientId).toBe(user.user.id);
    });
});

test("POST /waitlist-offers/:id/accept — old booking cancelled, new booking created, waitlist removed @api", async ({ request, user, user2, slot }) => {
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    await withSecondSlot(doctors, doctor, doctorAuth, async (slot2) => {
        // user1 books slot1
        const { status: book1Status, body: book1Body } = await appointments.createAppointment(slot1Body.id, patientAuth);
        expect(book1Status).toBe(201);

        // user2 books slot2
        const { status: book2Status, body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        expect(book2Status).toBe(201);

        // user1 joins waitlist
        const { status: joinStatus } = await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        expect(joinStatus).toBe(201);

        // user2 cancels → offer created for user1
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find(o => o.slotId === slot2.id);
        expect(offer).toBeDefined();

        // user1 accepts the offer
        const { status: acceptStatus, body: acceptBody } = await appointments.acceptOffer(offer.id, patientAuth);
        expect(acceptStatus).toBe(200);
        expect(acceptBody.status).toBe("accepted");

        // old appointment (slot1) must be cancelled
        const { body: myAppts } = await appointments.listMy(patientAuth);
        const oldAppt = myAppts.find(a => a.id === book1Body.id);
        expect(oldAppt.status, "old appointment must be cancelled after accept").toBe("cancelled");

        // new appointment on slot2 must be pending
        const newAppt = myAppts.find(a => a.slotId === slot2.id && a.status === "pending");
        expect(newAppt, "new appointment on offered slot must exist").toBeDefined();

        // waitlist entry must be removed
        const { body: waitlist } = await appointments.getMyWaitlist(patientAuth);
        expect(waitlist.some(w => w.doctorId === doctor.doctorRecordId)).toBe(false);

        // DB: slot1 must be available again
        const dbSlot1 = dbClient.getActiveAppointmentsForSlot(slot1Body.id);
        expect(dbSlot1, "DB: slot1 must have no active appointments after accept").toHaveLength(0);
    });
});

test("POST /waitlist-offers/:id/decline — old booking unchanged, patient stays on waitlist @api", async ({ request, user, user2, slot }) => {
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    await withSecondSlot(doctors, doctor, doctorAuth, async (slot2) => {
        // user1 books slot1
        const { status: book1Status, body: book1Body } = await appointments.createAppointment(slot1Body.id, patientAuth);
        expect(book1Status).toBe(201);

        // user2 books slot2
        const { status: book2Status, body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        expect(book2Status).toBe(201);

        // user1 joins waitlist
        await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);

        // user2 cancels → offer created for user1
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find(o => o.slotId === slot2.id);
        expect(offer).toBeDefined();

        // user1 declines the offer
        const { status: declineStatus, body: declineBody } = await appointments.declineOffer(offer.id, patientAuth);
        expect(declineStatus).toBe(200);
        expect(declineBody.status).toBe("declined");

        // original appointment on slot1 must still be active
        const { body: myAppts } = await appointments.listMy(patientAuth);
        const orig = myAppts.find(a => a.id === book1Body.id);
        expect(orig.status, "original appointment must remain active after decline").toBe("pending");

        // waitlist entry must remain
        const { body: waitlist } = await appointments.getMyWaitlist(patientAuth);
        expect(waitlist.some(w => w.doctorId === doctor.doctorRecordId), "patient must stay on waitlist after decline").toBe(true);

        // slot2 must be free (no active appointments)
        const dbSlot2 = dbClient.getActiveAppointmentsForSlot(slot2.id);
        expect(dbSlot2, "DB: slot2 must be free after decline").toHaveLength(0);
    });
});

test("POST /waitlist-offers/:id/accept — 409 OFFER_ALREADY_RESOLVED when offer already accepted @api", async ({ request, user, user2, slot }) => {
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    await withSecondSlot(doctors, doctor, doctorAuth, async (slot2) => {
        await appointments.createAppointment(slot1Body.id, patientAuth);
        const { body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find(o => o.slotId === slot2.id);

        // Accept once
        await appointments.acceptOffer(offer.id, patientAuth);

        // Try to accept again
        const { status, body } = await appointments.acceptOffer(offer.id, patientAuth);
        expect(status).toBe(409);
        expect(body.errorCode).toBe("OFFER_ALREADY_RESOLVED");
    });
});

import { APIRequestContext } from '@playwright/test';
import { test, expect } from '../../fixtures/twoUsersFixture';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { DebugClient } from '../../api/DebugClient';
import { dbClient } from '../../utils/dbClient';
import { AppointmentErrors } from '../../enums/appointments';
import { nextSeedSlotWindow, SeedDoctor } from '../../data/seedAccounts';
import { debugRoutesEnabled, DEBUG_ROUTES_SKIP_MSG } from '../../config/sutCapabilities';

interface AuthOpts {
    headers: Record<string, string>;
}

interface SlotBody {
    id: number;
    [key: string]: unknown;
}

async function withSecondSlot(
    request: APIRequestContext,
    doctors: DoctorsClient,
    doctor: SeedDoctor,
    doctorAuth: AuthOpts,
    fn: (slot2: SlotBody) => Promise<void>
): Promise<void> {
    const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
    const { status, body: slot2 } = await doctors.createSlot(
        doctor.doctorRecordId, seedSlotStart, seedSlotEnd, true, doctorAuth
    );
    if (status !== 201) throw new Error(`second slot creation failed: ${JSON.stringify(slot2)}`);
    try {
        return await fn(slot2 as SlotBody);
    } finally {
        const appts = new AppointmentsClient(request);
        const { body: doctorAppts } = await appts.listDoctor(doctorAuth);
        const active = (Array.isArray(doctorAppts) ? doctorAppts : []).filter(
            (a: Record<string, unknown>) =>
                a.slotId === (slot2 as SlotBody).id && ['pending', 'confirmed'].includes(a.status as string),
        );
        for (const appt of active) {
            await appts.cancelAsDoctor(appt.id as number, doctorAuth);
        }
        await doctors.deleteSlot((slot2 as SlotBody).id, doctorAuth);
    }
}

test("GET /api/v1/appointments/waitlist-offers — returns pending offers for patient @api", async ({ request, user, user2, slot }) => {
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    await withSecondSlot(request, doctors, doctor, doctorAuth, async (slot2) => {
        const { status: book1Status } = await appointments.createAppointment(slot1Body.id, patientAuth);
        expect(book1Status).toBe(201);

        const { status: book2Status, body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        expect(book2Status).toBe(201);

        const { status: joinStatus } = await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        expect(joinStatus).toBe(201);

        const { status: cancelStatus } = await appointments.cancelAppointment(book2Body.id, patient2Auth);
        expect(cancelStatus).toBe(200);

        const { status: offersStatus, body: offers } = await appointments.getWaitlistOffers(patientAuth);
        expect(offersStatus).toBe(200);
        expect(Array.isArray(offers)).toBe(true);
        expect(offers.length).toBeGreaterThanOrEqual(1);

        const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);
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

    await withSecondSlot(request, doctors, doctor, doctorAuth, async (slot2) => {
        const { status: book1Status, body: book1Body } = await appointments.createAppointment(slot1Body.id, patientAuth);
        expect(book1Status).toBe(201);

        const { status: book2Status, body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        expect(book2Status).toBe(201);

        const { status: joinStatus } = await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        expect(joinStatus).toBe(201);

        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);
        expect(offer).toBeDefined();

        const { status: acceptStatus, body: acceptBody } = await appointments.acceptOffer(offer.id, patientAuth);
        expect(acceptStatus).toBe(200);
        expect(acceptBody.status).toBe("accepted");

        const { body: myAppts } = await appointments.listMy(patientAuth);
        const oldAppt = myAppts.find((a: { id: number }) => a.id === book1Body.id);
        expect(oldAppt.status, "old appointment must be cancelled after accept").toBe("cancelled");

        const newAppt = myAppts.find((a: { slotId: number; status: string }) => a.slotId === slot2.id && a.status === "pending");
        expect(newAppt, "new appointment on offered slot must exist").toBeDefined();

        const { body: waitlist } = await appointments.getMyWaitlist(patientAuth);
        expect(waitlist.some((w: { doctorId: number }) => w.doctorId === doctor.doctorRecordId)).toBe(false);

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

    await withSecondSlot(request, doctors, doctor, doctorAuth, async (slot2) => {
        const { status: book1Status, body: book1Body } = await appointments.createAppointment(slot1Body.id, patientAuth);
        expect(book1Status).toBe(201);

        const { status: book2Status, body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        expect(book2Status).toBe(201);

        await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);
        expect(offer).toBeDefined();

        const { status: declineStatus, body: declineBody } = await appointments.declineOffer(offer.id, patientAuth);
        expect(declineStatus).toBe(200);
        expect(declineBody.status).toBe("declined");

        const { body: myAppts } = await appointments.listMy(patientAuth);
        const orig = myAppts.find((a: { id: number }) => a.id === book1Body.id);
        expect(orig.status, "original appointment must remain active after decline").toBe("pending");

        const { body: waitlist } = await appointments.getMyWaitlist(patientAuth);
        expect(waitlist.some((w: { doctorId: number }) => w.doctorId === doctor.doctorRecordId), "patient must stay on waitlist after decline").toBe(true);

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

    await withSecondSlot(request, doctors, doctor, doctorAuth, async (slot2) => {
        await appointments.createAppointment(slot1Body.id, patientAuth);
        const { body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);

        await appointments.acceptOffer(offer.id, patientAuth);

        const { status, body } = await appointments.acceptOffer(offer.id, patientAuth);
        expect(status).toBe(409);
        expect(body.errorCode).toBe("OFFER_ALREADY_RESOLVED");
    });
});

test("POST /waitlist-offers/:id/accept — 410 OFFER_EXPIRED is persisted, not rolled back @api", async ({ request, user, user2, slot }) => {
    test.skip(!debugRoutesEnabled, DEBUG_ROUTES_SKIP_MSG);
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const debug = new DebugClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    await withSecondSlot(request, doctors, doctor, doctorAuth, async (slot2) => {
        await appointments.createAppointment(slot1Body.id, patientAuth);
        const { body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);
        expect(offer).toBeDefined();

        const { status: expireStatus } = await debug.expireOffer(offer.id);
        expect(expireStatus, "debug routes must be enabled: NODE_ENV=development ENABLE_DEBUG_ROUTES=true").toBe(200);

        const { status, body } = await appointments.acceptOffer(offer.id, patientAuth);
        expect(status).toBe(410);
        expect(body.errorCode).toBe(AppointmentErrors.OFFER_EXPIRED);

        const stored = dbClient.getOfferById(offer.id);
        expect(stored, "offer row must exist").toBeDefined();
        expect(stored!.status, "410 told the client it expired — the row must say so too").toBe("expired");
    });
});

test("POST /waitlist-offers/:id/accept — 410 releases the held slot instead of freezing it @api", async ({ request, user, user2, slot }) => {
    test.skip(!debugRoutesEnabled, DEBUG_ROUTES_SKIP_MSG);
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const debug = new DebugClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    await withSecondSlot(request, doctors, doctor, doctorAuth, async (slot2) => {
        await appointments.createAppointment(slot1Body.id, patientAuth);
        const { body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);

        await debug.expireOffer(offer.id);
        await appointments.acceptOffer(offer.id, patientAuth);

        const dbSlot = dbClient.getSlotById(slot2.id);
        expect(dbSlot!.isAvailable, "a slot held by an expired offer must go back on sale").toBe(1);
    });
});

test("POST /debug/run-offer-expiry — sweep releases a slot nobody ever answered for @api", async ({ request, user, user2, slot }) => {
    test.skip(!debugRoutesEnabled, DEBUG_ROUTES_SKIP_MSG);
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const debug = new DebugClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    await withSecondSlot(request, doctors, doctor, doctorAuth, async (slot2) => {
        await appointments.createAppointment(slot1Body.id, patientAuth);
        const { body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);

        await debug.expireOffer(offer.id);

        // The patient never accepts and never declines — only the timer can resolve this.
        const { status: sweepStatus, body: sweepBody } = await debug.runOfferExpiry();
        expect(sweepStatus).toBe(200);
        expect(sweepBody.expired).toBeGreaterThanOrEqual(1);

        const dbSlot = dbClient.getSlotById(slot2.id);
        expect(dbSlot!.isAvailable, "silent patient must not hold the slot forever").toBe(1);
        expect(dbClient.getOfferById(offer.id)!.status).toBe("expired");
    });
});

test("POST /debug/run-offer-expiry — expired offer is not handed back to the same patient @api", async ({ request, user, user2, slot }) => {
    test.skip(!debugRoutesEnabled, DEBUG_ROUTES_SKIP_MSG);
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const debug = new DebugClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    await withSecondSlot(request, doctors, doctor, doctorAuth, async (slot2) => {
        await appointments.createAppointment(slot1Body.id, patientAuth);
        const { body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);

        await debug.expireOffer(offer.id);
        await debug.runOfferExpiry();

        // The patient is still on the waitlist, so a naive re-offer would loop on them forever.
        const { body: afterOffers } = await appointments.getWaitlistOffers(patientAuth);
        const reoffered = afterOffers.filter((o: { slotId: number }) => o.slotId === slot2.id);
        expect(reoffered, "a patient who let the offer lapse must not be re-offered the same slot").toHaveLength(0);
    });
});

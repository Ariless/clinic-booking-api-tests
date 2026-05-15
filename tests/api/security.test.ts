import { test, expect } from '../../fixtures/twoUsersFixture';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { endpoints } from '../../data/testData';
import { nextSeedSlotWindow } from '../../data/seedAccounts';

test("GET /api/v1/appointments/:id — 401 when no auth token provided @api @security", async ({ request, user, slot }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status } = await appointments.getAppointment(bookBody.id, {});
    expect(status).toBe(401);
});

test("GET /api/v1/appointments/:id — 403 when patient reads another patient's appointment @api @security", async ({ request, user, user2, slot }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status, body } = await appointments.getAppointment(bookBody.id, patient2Auth);
    expect(status).toBe(403);
    expect(body.errorCode).toBe("FORBIDDEN");
});

test("PATCH /api/v1/appointments/:id/cancel — 403 when patient cancels another patient's appointment @api @security", async ({ request, user, user2, slot }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status, body } = await appointments.cancelAppointment(bookBody.id, patient2Auth);
    expect(status).toBe(403);
    expect(body.errorCode).toBe("FORBIDDEN");
});

test("DELETE /api/v1/appointments/waitlist/:id — 403 when patient deletes another patient's waitlist entry @api @security", async ({ request, user, user2, slot }) => {
    const appointments = new AppointmentsClient(request);
    const { doctor } = slot;
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };

    const { status: joinStatus, body: joinBody } = await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
    expect(joinStatus).toBe(201);

    try {
        const { status, body } = await appointments.leaveWaitlist(joinBody.id, patient2Auth);
        expect(status).toBe(403);
        expect(body.errorCode).toBe("FORBIDDEN");
    } finally {
        await appointments.leaveWaitlist(joinBody.id, patientAuth);
    }
});

test("POST /api/v1/appointments/waitlist-offers/:id/accept — 403 when patient accepts another patient's offer @api @security", async ({ request, user, user2, slot }) => {
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
    const { status: slotStatus, body: slot2 } = await doctors.createSlot(
        doctor.doctorRecordId, seedSlotStart, seedSlotEnd, true, doctorAuth
    );
    expect(slotStatus).toBe(201);

    try {
        await appointments.createAppointment(slot1Body.id, patientAuth);
        const { body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);
        expect(offer, "offer must exist for user1").toBeDefined();

        const { status, body } = await appointments.acceptOffer(offer.id, patient2Auth);
        expect(status).toBe(403);
        expect(body.errorCode).toBe("FORBIDDEN");
    } finally {
        await doctors.deleteSlot(slot2.id, doctorAuth);
    }
});

test("POST /api/v1/appointments/waitlist-offers/:id/decline — 403 when patient declines another patient's offer @api @security", async ({ request, user, user2, slot }) => {
    const { slot: slot1Body, doctorToken, doctor } = slot;
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
    const { status: slotStatus, body: slot2 } = await doctors.createSlot(
        doctor.doctorRecordId, seedSlotStart, seedSlotEnd, true, doctorAuth
    );
    expect(slotStatus).toBe(201);

    try {
        await appointments.createAppointment(slot1Body.id, patientAuth);
        const { body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
        await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
        await appointments.cancelAppointment(book2Body.id, patient2Auth);

        const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
        const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);
        expect(offer, "offer must exist for user1").toBeDefined();

        const { status, body } = await appointments.declineOffer(offer.id, patient2Auth);
        expect(status).toBe(403);
        expect(body.errorCode).toBe("FORBIDDEN");
    } finally {
        await doctors.deleteSlot(slot2.id, doctorAuth);
    }
});

test("GET /api/v1/auth/me — 401 with tampered JWT payload @api @security", async ({ request, user }) => {
    const [header, payload, signature] = user.token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    decoded.role = "admin";
    const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    const response = await request.get(endpoints.authMe, {
        headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    expect(response.status()).toBe(401);
});

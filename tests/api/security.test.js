const { test, expect } = require("../../fixtures/twoUsersFixture");
const { AppointmentsClient } = require("../../api/AppointmentsClient");
const { DoctorsClient } = require("../../api/DoctorsClient");
const { endpoints } = require("../../data/testData");
const { nextSeedSlotWindow } = require("../../data/seedAccounts");

// ─── IDOR — horizontal privilege escalation ──────────────────────────────────

test("GET /api/v1/appointments/:id — 401 when no auth token provided @api @security", async ({ request, user, slot }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    // No token — unauthenticated user should not be able to read any appointment
    const { status } = await appointments.getAppointment(bookBody.id, {});
    expect(status).toBe(401);
});

test("GET /api/v1/appointments/:id — 403 when patient reads another patient's appointment @api @security", async ({ request, user, user2, slot }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };

    // user books an appointment
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    // user2 tries to read user's appointment — should be forbidden
    const { status, body } = await appointments.getAppointment(bookBody.id, patient2Auth);
    expect(status).toBe(403);
    expect(body.errorCode).toBe("FORBIDDEN");
});

test("PATCH /api/v1/appointments/:id/cancel — 403 when patient cancels another patient's appointment @api @security", async ({ request, user, user2, slot }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };

    // user books an appointment
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    // user2 tries to cancel user's appointment — should be forbidden
    const { status, body } = await appointments.cancelAppointment(bookBody.id, patient2Auth);
    expect(status).toBe(403);
    expect(body.errorCode).toBe("FORBIDDEN");
});

// ─── BOLA — object-level authorization ───────────────────────────────────────

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
        const offer = offers.find(o => o.slotId === slot2.id);
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
        const offer = offers.find(o => o.slotId === slot2.id);
        expect(offer, "offer must exist for user1").toBeDefined();

        const { status, body } = await appointments.declineOffer(offer.id, patient2Auth);
        expect(status).toBe(403);
        expect(body.errorCode).toBe("FORBIDDEN");
    } finally {
        await doctors.deleteSlot(slot2.id, doctorAuth);
    }
});

// ─── JWT manipulation ─────────────────────────────────────────────────────────

test("GET /api/v1/auth/me — 401 with tampered JWT payload @api @security", async ({ request, user }) => {
    // JWT = header.payload.signature — tamper the payload, keep the original signature
    // Server will reject: signature no longer matches the modified payload
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

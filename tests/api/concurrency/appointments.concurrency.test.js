const { test, expect } = require("../../../fixtures/twoUsersFixture");
const { AppointmentsClient } = require("../../../api/AppointmentsClient");
const { AuthClient } = require("../../../api/AuthClient");
const { DoctorsClient } = require("../../../api/DoctorsClient");
const { UserClient } = require("../../../api/UserClient");
const { seedDoctors, nextSeedSlotWindow } = require("../../../data/seedAccounts");
const { generateUser } = require("../../../utils/userUtils");
const { assertSchema } = require("../../../utils/schemaValidator");
const { validateAppointment } = require("../../../data/schemas/appointmentSchemas");

// ─── Test 1: double-cancel same appointment ──────────────────────────────────
// One patient fires two PATCH /:id/cancel simultaneously for the same appointment.
// Expected: exactly one 200 (cancelled) and one 422 INVALID_TRANSITION.
test("PATCH /api/v1/appointments/:id/cancel — one 200 and one 422 INVALID_TRANSITION when two cancels race for the same appointment @api @concurrency", async ({ request, user, slot }) => {
        const { slot: slotBody } = slot;
        const appointments = new AppointmentsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
        expect(bookStatus).toBe(201);
        assertSchema(bookBody, validateAppointment);
        expect(bookBody.status).toBe("pending");
        expect(bookBody.slotId).toBe(slotBody.id);


    const [cancel1, cancel2] = await Promise.all([
        appointments.cancelAppointment(bookBody.id, patientAuth),
        appointments.cancelAppointment(bookBody.id, patientAuth),
    ]);

    const statuses = [cancel1.status, cancel2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 422]);

    const success = [cancel1, cancel2].find(r => r.status === 200);
    const failure = [cancel1, cancel2].find(r => r.status === 422);
    expect(success.body.status).toBe("cancelled");
    expect(failure.body.errorCode).toBe("INVALID_TRANSITION");
});

// ─── Test 2: concurrent cancels trigger exactly one waitlist promotion ────────
// user books slot1, user2 books slot2 (same doctor).
// user3 joins waitlist for that doctor.
// user and user2 cancel simultaneously.
// Expected: user3 is promoted to exactly one appointment — not two.
test("PATCH /api/v1/appointments/:id/cancel — waitlist patient promoted exactly once when two slots freed concurrently @api @concurrency", async ({ request, user, user2, slot }) => {
    const appointments = new AppointmentsClient(request);
    const auth = new AuthClient(request);
    const doctors = new DoctorsClient(request);
    const users = new UserClient(request);

    // Setup: login as doctor to create a second slot
    const doctor = seedDoctors[0];
    const { body: loginBody } = await auth.verifyLogin(doctor.email, doctor.password);
    const doctorToken = loginBody.token;
    const { seedSlotStart, seedSlotEnd, seedSlotIsAvailable } = nextSeedSlotWindow();
    const { status: slot2Status, body: slot2Body } = await doctors.createSlot(
        doctor.doctorRecordId,
        seedSlotStart,
        seedSlotEnd,
        seedSlotIsAvailable,
        { headers: { Authorization: `Bearer ${doctorToken}` } }
    );
    expect(slot2Status).toBe(201);
    // Setup: auth headers + destructure slot from fixture
    const { slot: slotBody } = slot;
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };

    // Setup: book slot (from fixture) as user, slot2 as user2
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);
    assertSchema(bookBody, validateAppointment);
    expect(bookBody.status).toBe("pending");
    expect(bookBody.slotId).toBe(slotBody.id);

    const { status: book2Status, body: book2Body } = await appointments.createAppointment(slot2Body.id, patient2Auth);
    expect(book2Status).toBe(201);
    assertSchema(book2Body, validateAppointment);
    expect(book2Body.status).toBe("pending");
    expect(book2Body.slotId).toBe(slot2Body.id);

    // Setup: register user3 and join waitlist
    const user3Data = generateUser();
    const { status: regStatus, body: regBody } = await users.registerPatient(user3Data);
    expect(regStatus).toBe(201);
    const user3Token = regBody.token;
    const user3Auth = { headers: { Authorization: `Bearer ${user3Token}` } };

    const { status: waitlistStatus } = await appointments.joinWaitlist(doctor.doctorRecordId, user3Auth);
    expect(waitlistStatus).toBe(201);

    // Action: cancel both appointments simultaneously
    const [cancel1, cancel2] = await Promise.all([
        appointments.cancelAppointment(bookBody.id, patientAuth),
        appointments.cancelAppointment(book2Body.id, patient2Auth),
    ]);
    expect(cancel1.status).toBe(200);
    expect(cancel2.status).toBe(200);

    // Assert: user3 has exactly one pending appointment — promoted once, not twice
    const { status: listStatus, body: listBody } = await appointments.listMy(user3Auth);
    expect(listStatus).toBe(200);
    const pendingAppointments = listBody.filter((a) => a.status === "pending");
    expect(pendingAppointments).toHaveLength(1);

    // Cleanup: cancel any active appointments on slot2, then delete slot2 and user3
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
    const { body: doctorAppts } = await appointments.listDoctor(doctorAuth);
    const activeOnSlot2 = (Array.isArray(doctorAppts) ? doctorAppts : []).filter(
        a => a.slotId === slot2Body.id && ["pending", "confirmed"].includes(a.status),
    );
    for (const appt of activeOnSlot2) {
        await appointments.cancelAsDoctor(appt.id, doctorAuth);
    }
    await doctors.deleteSlot(slot2Body.id, doctorAuth);
    await users.deleteMyAccount(user3Token);
});
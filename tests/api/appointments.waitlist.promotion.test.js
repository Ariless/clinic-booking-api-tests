const { test, expect } = require("../../fixtures/twoUsersFixture");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

async function assertPromoted(appointments, auth, slotId, doctorId) {
    const { status: listStatus, body: listBody } = await appointments.listMy(auth);
    expect(listStatus).toBe(200);
    const promoted = listBody.find((a) => a.slotId === slotId);
    expect(promoted, "promoted appointment should exist").toBeDefined();
    expect(promoted.status).toBe("pending");

    const { status: wlStatus, body: wlBody } = await appointments.getMyWaitlist(auth);
    expect(wlStatus).toBe(200);
    expect(wlBody.some((w) => w.doctorId === doctorId)).toBe(false);
}

test("PATCH /api/v1/appointments/:id/cancel — waitlist patient auto-promoted to freed slot @api", async ({ request, user, user2, slot }) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status: joinStatus } = await appointments.joinWaitlist(slot.doctor.doctorRecordId, patient2Auth);
    expect(joinStatus).toBe(201);

    const { status: cancelStatus } = await appointments.cancelAppointment(bookBody.id, patientAuth);
    expect(cancelStatus).toBe(200);

    await assertPromoted(appointments, patient2Auth, slotBody.id, slot.doctor.doctorRecordId);
});

test("PATCH /api/v1/appointments/:id/reject — waitlist patient auto-promoted to freed slot @api", async ({ request, user, user2, slot }) => {
    const { slot: slotBody, doctorToken } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status: joinStatus } = await appointments.joinWaitlist(slot.doctor.doctorRecordId, patient2Auth);
    expect(joinStatus).toBe(201);

    const { status: rejectStatus } = await appointments.rejectAppointment(bookBody.id, doctorAuth);
    expect(rejectStatus).toBe(200);

    await assertPromoted(appointments, patient2Auth, slotBody.id, slot.doctor.doctorRecordId);
});

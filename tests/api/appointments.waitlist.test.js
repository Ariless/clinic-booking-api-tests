const { test, expect } = require("../../fixtures");
const { AppointmentsClient } = require("../../api/AppointmentsClient");
const { seedPatient } = require("../../data/seedAccounts");
const {AuthClient} = require("../../api/AuthClient");

test("POST/GET/DELETE /api/v1/appointments/waitlist — join, view, leave happy path @api", async ({ request, user, slot }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = {headers: {Authorization: `Bearer ${user.token}`}};

    const {status: joinStatus, body: joinBody} = await appointments.joinWaitlist(slot.doctor.doctorRecordId, patientAuth)
    expect(joinStatus).toBe(201);
    expect(joinBody.doctorId).toBe(slot.doctor.doctorRecordId);

    const {status: listStatus, body: listBody} = await appointments.getMyWaitlist(patientAuth)
    expect(listStatus).toBe(200);
    expect(listBody).toHaveLength(1);

    const {status: leaveStatus, body: leaveBody} = await appointments.leaveWaitlist(joinBody.id, patientAuth)
    expect(leaveStatus).toBe(200);
    expect(leaveBody.removed).toBe(true);
})

test("POST /api/v1/appointments/waitlist — 409 WAITLIST_DUPLICATE on duplicate join @api", async ({ request, user, slot }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: joinStatus, body: joinBody } = await appointments.joinWaitlist(slot.doctor.doctorRecordId, patientAuth);
    expect(joinStatus).toBe(201);
    expect(joinBody.doctorId).toBe(slot.doctor.doctorRecordId);

    try {
        const { status: conflictStatus, body: conflictBody } = await appointments.joinWaitlist(slot.doctor.doctorRecordId, patientAuth);
        expect(conflictStatus).toBe(409);
        expect(conflictBody.errorCode).toBe("WAITLIST_DUPLICATE");
    } finally {
        await appointments.leaveWaitlist(joinBody.id, patientAuth);
    }
})

test("DELETE /api/v1/appointments/waitlist/:id — 403 FORBIDDEN when patient deletes another's entry @api", async ({ request, user, slot }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: joinStatus, body: joinBody } = await appointments.joinWaitlist(slot.doctor.doctorRecordId, patientAuth);
    expect(joinStatus).toBe(201);
    expect(joinBody.doctorId).toBe(slot.doctor.doctorRecordId);

    try {
        const auth = new AuthClient(request);
        const { status: loginStatus, body: loginBody } = await auth.verifyLogin(seedPatient.email, seedPatient.password);
        expect(loginStatus).toBe(200);

        const { status: leaveStatus, body: leaveBody } = await appointments.leaveWaitlist(joinBody.id, {
            headers: { Authorization: `Bearer ${loginBody.token}` },
        });
        expect(leaveStatus).toBe(403);
        expect(leaveBody.errorCode).toBe("FORBIDDEN");
    } finally {
        await appointments.leaveWaitlist(joinBody.id, patientAuth);
    }
})

import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { AuthClient } from '../../api/AuthClient';
import { seedPatient } from '../../data/seedAccounts';
import { dbClient } from '../../utils/dbClient';

test("POST/GET/DELETE /api/v1/appointments/waitlist — join, view, leave happy path @api", async ({ request, user, slot }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: joinStatus, body: joinBody } = await appointments.joinWaitlist(slot.doctor.doctorRecordId, patientAuth);
    expect(joinStatus).toBe(201);
    expect(joinBody.doctorId).toBe(slot.doctor.doctorRecordId);

    const { status: listStatus, body: listBody } = await appointments.getMyWaitlist(patientAuth);
    expect(listStatus).toBe(200);
    expect(listBody).toHaveLength(1);

    const dbAfterJoin = dbClient.getWaitlistByPatient(user.user.id);
    expect(dbAfterJoin).toHaveLength(1);
    expect(dbAfterJoin[0].doctorId, "DB: waitlist entry must reference correct doctor").toBe(slot.doctor.doctorRecordId);

    const { status: leaveStatus, body: leaveBody } = await appointments.leaveWaitlist(joinBody.id, patientAuth);
    expect(leaveStatus).toBe(200);
    expect(leaveBody.removed).toBe(true);

    const dbAfterLeave = dbClient.getWaitlistByPatient(user.user.id);
    expect(dbAfterLeave, "DB: waitlist entry must be removed after leave").toHaveLength(0);
});

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

        const dbRows = dbClient.getWaitlistByPatient(user.user.id);
        expect(dbRows, "DB: duplicate join must not create a second row").toHaveLength(1);
    } finally {
        await appointments.leaveWaitlist(joinBody.id, patientAuth);
    }
});

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
});

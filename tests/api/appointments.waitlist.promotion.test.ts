import { test, expect } from '../../fixtures/twoUsersFixture';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { dbClient } from '../../utils/dbClient';

interface AuthOpts {
    headers: Record<string, string>;
}

async function assertPromoted(
    appointments: AppointmentsClient,
    auth: AuthOpts,
    slotId: number,
    doctorId: number
): Promise<void> {
    const { status: listStatus, body: listBody } = await appointments.listMy(auth);
    expect(listStatus).toBe(200);
    const promoted = listBody.find((a: { slotId: number }) => a.slotId === slotId);
    expect(promoted, "promoted appointment should exist").toBeDefined();
    expect(promoted.status).toBe("pending");

    const { status: wlStatus, body: wlBody } = await appointments.getMyWaitlist(auth);
    expect(wlStatus).toBe(200);
    expect(wlBody.some((w: { doctorId: number }) => w.doctorId === doctorId)).toBe(false);
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

    const dbWaitlist = dbClient.getWaitlistByPatient(user2.user.id);
    expect(dbWaitlist, "DB: waitlist entry must be removed after promotion").toHaveLength(0);
    const dbAppts = dbClient.getActiveAppointmentsForSlot(slotBody.id);
    expect(dbAppts).toHaveLength(1);
    expect(dbAppts[0].patientId, "DB: promoted appointment must belong to patient2").toBe(user2.user.id);
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

    const dbWaitlist = dbClient.getWaitlistByPatient(user2.user.id);
    expect(dbWaitlist, "DB: waitlist entry must be removed after promotion").toHaveLength(0);
    const dbAppts = dbClient.getActiveAppointmentsForSlot(slotBody.id);
    expect(dbAppts).toHaveLength(1);
    expect(dbAppts[0].patientId, "DB: promoted appointment must belong to patient2").toBe(user2.user.id);
});

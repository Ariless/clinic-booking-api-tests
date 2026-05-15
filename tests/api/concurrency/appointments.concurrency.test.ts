import { test, expect } from '../../../fixtures/twoUsersFixture';
import { AppointmentsClient } from '../../../api/AppointmentsClient';
import { AuthClient } from '../../../api/AuthClient';
import { DoctorsClient } from '../../../api/DoctorsClient';
import { UserClient } from '../../../api/UserClient';
import { seedDoctors, nextSeedSlotWindow } from '../../../data/seedAccounts';
import { generateUser } from '../../../utils/userUtils';
import { assertSchema } from '../../../utils/schemaValidator';
import { validateAppointment } from '../../../data/schemas/appointmentSchemas';

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
    expect(success!.body.status).toBe("cancelled");
    expect(failure!.body.errorCode).toBe("INVALID_TRANSITION");
});

test("PATCH /api/v1/appointments/:id/cancel — waitlist patient promoted exactly once when two slots freed concurrently @api @concurrency", async ({ request, user, user2, slot }) => {
    const appointments = new AppointmentsClient(request);
    const auth = new AuthClient(request);
    const doctors = new DoctorsClient(request);
    const users = new UserClient(request);

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

    const { slot: slotBody } = slot;
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };

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

    const user3Data = generateUser();
    const { status: regStatus, body: regBody } = await users.registerPatient(user3Data);
    expect(regStatus).toBe(201);
    const user3Token = regBody.token;
    const user3Auth = { headers: { Authorization: `Bearer ${user3Token}` } };

    const { status: waitlistStatus } = await appointments.joinWaitlist(doctor.doctorRecordId, user3Auth);
    expect(waitlistStatus).toBe(201);

    const [cancel1, cancel2] = await Promise.all([
        appointments.cancelAppointment(bookBody.id, patientAuth),
        appointments.cancelAppointment(book2Body.id, patient2Auth),
    ]);
    expect(cancel1.status).toBe(200);
    expect(cancel2.status).toBe(200);

    const { status: listStatus, body: listBody } = await appointments.listMy(user3Auth);
    expect(listStatus).toBe(200);
    const pendingAppointments = listBody.filter((a: { status: string }) => a.status === "pending");
    expect(pendingAppointments).toHaveLength(1);

    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
    const { body: doctorAppts } = await appointments.listDoctor(doctorAuth);
    const activeOnSlot2 = (Array.isArray(doctorAppts) ? doctorAppts : []).filter(
        (a: { slotId: number; status: string }) => a.slotId === slot2Body.id && ["pending", "confirmed"].includes(a.status)
    );
    for (const appt of activeOnSlot2) {
        await appointments.cancelAsDoctor(appt.id, doctorAuth);
    }
    await doctors.deleteSlot(slot2Body.id, doctorAuth);
    await users.deleteMyAccount(user3Token);
});

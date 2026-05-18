import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { AuthClient } from '../../api/AuthClient';
import { assertSchema } from '../../utils/schemaValidator';
import { validatePaginatedAppointments } from '../../data/schemas/appointmentSchemas';
import { validateError } from '../../data/schemas/errorSchema';
import { seedDoctors, nextSeedSlotWindow } from '../../data/seedAccounts';

test("GET /appointments/my — 200 paginated envelope shape valid with defaults @smoke", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    await appointments.createAppointment(slotBody.id, patientAuth);

    const { status, body } = await appointments.listMyPaginated(undefined, undefined, patientAuth);
    expect(status).toBe(200);
    assertSchema(body, validatePaginatedAppointments);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.totalPages).toBe(Math.ceil(body.total / 20));
});

test("GET /appointments/my?page=1&limit=5 — 200 respects limit, totalPages = ceil(total / 5) @api", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    await appointments.createAppointment(slotBody.id, patientAuth);

    const { status, body } = await appointments.listMyPaginated(1, 5, patientAuth);
    expect(status).toBe(200);
    assertSchema(body, validatePaginatedAppointments);
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(body.limit).toBe(5);
    expect(body.totalPages).toBe(Math.ceil(body.total / 5));
});

test("GET /appointments/my?page=2&limit=1 — 200 correct offset skips newest appointment @api", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    // apptA booked first — lower id, appears on page 2 with ORDER BY id DESC
    const { body: apptA } = await appointments.createAppointment(slotBody.id, patientAuth);

    const auth = new AuthClient(request);
    const doctor2 = seedDoctors[1];
    const { body: loginBody } = await auth.verifyLogin(doctor2.email, doctor2.password);
    const doctorAuth2 = { headers: { Authorization: `Bearer ${loginBody.token}` } };

    const doctors = new DoctorsClient(request);
    const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
    const { body: slot2 } = await doctors.createSlot(doctor2.doctorRecordId, seedSlotStart, seedSlotEnd, true, doctorAuth2);

    // apptB booked second — higher id, appears on page 1 with ORDER BY id DESC
    const { body: apptB } = await appointments.createAppointment(slot2.id, patientAuth);

    try {
        const { status: s1, body: b1 } = await appointments.listMyPaginated(1, 1, patientAuth);
        expect(s1).toBe(200);
        expect(b1.data[0].id).toBe(apptB.id);

        const { status: s2, body: b2 } = await appointments.listMyPaginated(2, 1, patientAuth);
        expect(s2).toBe(200);
        expect(b2.data[0].id).toBe(apptA.id);
    } finally {
        await appointments.cancelAppointment(apptB.id, patientAuth);
        await doctors.deleteSlot(slot2.id, doctorAuth2);
    }
});

test("GET /appointments/my?limit=0 — 400 VALIDATION_ERROR @api", async ({ request, user }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status, body } = await appointments.listMyPaginated(undefined, 0, patientAuth);
    expect(status).toBe(400);
    assertSchema(body, validateError);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
});

test("GET /appointments/my?page=0 — 400 VALIDATION_ERROR @api", async ({ request, user }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status, body } = await appointments.listMyPaginated(0, undefined, patientAuth);
    expect(status).toBe(400);
    assertSchema(body, validateError);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
});

test("GET /appointments/my?page=NaN — 400 VALIDATION_ERROR for non-integer page @api", async ({ request, user }) => {
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    // Number("abc") === NaN → serialised as "NaN" in the query string
    const { status, body } = await appointments.listMyPaginated(Number("abc"), undefined, patientAuth);
    expect(status).toBe(400);
    assertSchema(body, validateError);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
});

test("GET /appointments/doctor — 200 paginated envelope shape valid with defaults @smoke", async ({ request, user, slot }) => {
    const { slot: slotBody, doctorToken } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    await appointments.createAppointment(slotBody.id, patientAuth);

    const { status, body } = await appointments.listDoctorPaginated(undefined, undefined, doctorAuth);
    expect(status).toBe(200);
    assertSchema(body, validatePaginatedAppointments);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.totalPages).toBe(Math.ceil(body.total / 20));
});

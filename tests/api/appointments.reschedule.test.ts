import { APIRequestContext } from '@playwright/test';
import { test, expect } from '../../fixtures/twoUsersFixture';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { AuthClient } from '../../api/AuthClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { dbClient } from '../../utils/dbClient';
import { nextSeedSlotWindow, seedDoctors } from '../../data/seedAccounts';

async function createExtraSlot(
    request: APIRequestContext,
    doctorRecordId: number,
    doctorToken: string,
): Promise<{ slotId: number; cleanup: () => Promise<void> }> {
    const { seedSlotStart, seedSlotEnd, seedSlotIsAvailable } = nextSeedSlotWindow();
    const doctors = new DoctorsClient(request);
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

    const { status, body } = await doctors.createSlot(
        doctorRecordId,
        seedSlotStart,
        seedSlotEnd,
        seedSlotIsAvailable,
        doctorAuth,
    );
    if (status !== 201) throw new Error(`extra slot creation failed: ${JSON.stringify(body)}`);

    const slotId = body.id as number;

    return {
        slotId,
        cleanup: async () => {
            const appts = new AppointmentsClient(request);
            const { body: doctorAppts } = await appts.listDoctor(doctorAuth);
            const active = (Array.isArray(doctorAppts) ? doctorAppts : []).filter(
                (a: Record<string, unknown>) =>
                    a.slotId === slotId && ['pending', 'confirmed'].includes(a.status as string),
            );
            for (const appt of active) {
                await appts.cancelAsDoctor(appt.id as number, doctorAuth);
            }
            await doctors.deleteSlot(slotId, doctorAuth);
        },
    };
}

test('PATCH /api/v1/appointments/:id/reschedule — 200 pending → new slot, status pending @api @smoke',
    async ({ request, user, slot }) => {
        const { slot: slotBody, doctor, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
        expect(bookStatus).toBe(201);

        const { slotId: newSlotId, cleanup } = await createExtraSlot(request, doctor.doctorRecordId, doctorToken);
        try {
            const { status, body } = await appointments.rescheduleAppointment(bookBody.id, newSlotId, patientAuth);
            expect(status).toBe(200);
            expect(body.slotId).toBe(newSlotId);
            expect(body.status).toBe('pending');

            const dbOldSlot = dbClient.getSlotById(slotBody.id);
            expect(dbOldSlot!.isAvailable, 'DB: old slot freed').toBe(1);

            const dbNewSlot = dbClient.getSlotById(newSlotId);
            expect(dbNewSlot!.isAvailable, 'DB: new slot taken').toBe(0);

            const dbAppt = dbClient.getAppointmentById(bookBody.id);
            expect(dbAppt!.slotId, 'DB: appointment references new slot').toBe(newSlotId);
            expect(dbAppt!.status, 'DB: status is pending').toBe('pending');
        } finally {
            await cleanup();
        }
    },
);

test('PATCH /api/v1/appointments/:id/reschedule — 200 confirmed → status resets to pending @api',
    async ({ request, user, slot }) => {
        const { slot: slotBody, doctor, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
        const appointments = new AppointmentsClient(request);

        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
        expect(bookStatus).toBe(201);

        const { status: confirmStatus } = await appointments.confirmAppointment(bookBody.id, doctorAuth);
        expect(confirmStatus).toBe(200);

        const { slotId: newSlotId, cleanup } = await createExtraSlot(request, doctor.doctorRecordId, doctorToken);
        try {
            const { status, body } = await appointments.rescheduleAppointment(bookBody.id, newSlotId, patientAuth);
            expect(status).toBe(200);
            expect(body.status).toBe('pending');

            const dbAppt = dbClient.getAppointmentById(bookBody.id);
            expect(dbAppt!.status, 'DB: confirmed resets to pending on reschedule').toBe('pending');
        } finally {
            await cleanup();
        }
    },
);

test('PATCH /api/v1/appointments/:id/reschedule — 409 new slot already taken @api',
    async ({ request, user, user2, slot }) => {
        const { slot: slotBody, doctor, doctorToken } = slot;
        const patient1Auth = { headers: { Authorization: `Bearer ${user.token}` } };
        const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patient1Auth);
        expect(bookStatus).toBe(201);

        const { slotId: newSlotId, cleanup } = await createExtraSlot(request, doctor.doctorRecordId, doctorToken);
        try {
            const { status: book2Status } = await appointments.createAppointment(newSlotId, patient2Auth);
            expect(book2Status).toBe(201);

            const { status, body } = await appointments.rescheduleAppointment(bookBody.id, newSlotId, patient1Auth);
            expect(status).toBe(409);
            expect(body.errorCode).toBe('SLOT_TAKEN');
        } finally {
            await cleanup();
        }
    },
);

test('PATCH /api/v1/appointments/:id/reschedule — 422 cannot reschedule cancelled appointment @api',
    async ({ request, user, slot }) => {
        const { slot: slotBody, doctor, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
        expect(bookStatus).toBe(201);

        const { status: cancelStatus } = await appointments.cancelAppointment(bookBody.id, patientAuth);
        expect(cancelStatus).toBe(200);

        const { slotId: newSlotId, cleanup } = await createExtraSlot(request, doctor.doctorRecordId, doctorToken);
        try {
            const { status, body } = await appointments.rescheduleAppointment(bookBody.id, newSlotId, patientAuth);
            expect(status).toBe(422);
            expect(body.errorCode).toBe('INVALID_TRANSITION');
        } finally {
            await cleanup();
        }
    },
);

test('PATCH /api/v1/appointments/:id/reschedule — 422 new slot belongs to different doctor @api',
    async ({ request, user, slot }) => {
        const { slot: slotBody } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
        expect(bookStatus).toBe(201);

        const doctor2 = seedDoctors[1];
        const auth = new AuthClient(request);
        const { body: d2Login } = await auth.verifyLogin(doctor2.email, doctor2.password);
        const doctor2Token = d2Login.token as string;

        const { slotId: doctor2SlotId, cleanup } = await createExtraSlot(
            request, doctor2.doctorRecordId, doctor2Token,
        );
        try {
            const { status, body } = await appointments.rescheduleAppointment(
                bookBody.id, doctor2SlotId, patientAuth,
            );
            expect(status).toBe(422);
            expect(body.errorCode).toBe('DOCTOR_MISMATCH');
        } finally {
            await cleanup();
        }
    },
);

test('PATCH /api/v1/appointments/:id/reschedule — 422 same slot as current @api',
    async ({ request, user, slot }) => {
        const { slot: slotBody } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
        expect(bookStatus).toBe(201);

        const { status, body } = await appointments.rescheduleAppointment(bookBody.id, slotBody.id, patientAuth);
        expect(status).toBe(422);
        expect(body.errorCode).toBe('SAME_SLOT');
    },
);

test('PATCH /api/v1/appointments/:id/reschedule — 403 patient does not own appointment @api',
    async ({ request, user, user2, slot }) => {
        const { slot: slotBody, doctor, doctorToken } = slot;
        const patient1Auth = { headers: { Authorization: `Bearer ${user.token}` } };
        const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patient1Auth);
        expect(bookStatus).toBe(201);

        const { slotId: newSlotId, cleanup } = await createExtraSlot(request, doctor.doctorRecordId, doctorToken);
        try {
            const { status, body } = await appointments.rescheduleAppointment(bookBody.id, newSlotId, patient2Auth);
            expect(status).toBe(403);
            expect(body.errorCode).toBe('FORBIDDEN');
        } finally {
            await cleanup();
        }
    },
);

test('PATCH /api/v1/appointments/:id/reschedule — old slot freed and waitlist patient promoted @api',
    async ({ request, user, user2, slot }) => {
        const { slot: slotBody, doctor, doctorToken } = slot;
        const patient1Auth = { headers: { Authorization: `Bearer ${user.token}` } };
        const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patient1Auth);
        expect(bookStatus).toBe(201);

        const { status: waitStatus } = await appointments.joinWaitlist(doctor.doctorRecordId, patient2Auth);
        expect(waitStatus).toBe(201);

        const { slotId: newSlotId, cleanup } = await createExtraSlot(request, doctor.doctorRecordId, doctorToken);
        try {
            const { status, body } = await appointments.rescheduleAppointment(bookBody.id, newSlotId, patient1Auth);
            expect(status).toBe(200);
            expect(body.slotId).toBe(newSlotId);

            const { status: myStatus, body: myBody } = await appointments.listMy(patient2Auth);
            expect(myStatus).toBe(200);
            const promoted = (Array.isArray(myBody) ? myBody : []).find(
                (a: { slotId: number }) => a.slotId === slotBody.id,
            );
            expect(promoted, 'patient2 promoted to freed slot').toBeDefined();
            expect(promoted.status).toBe('pending');

            const { status: wlStatus, body: wlBody } = await appointments.getMyWaitlist(patient2Auth);
            expect(wlStatus).toBe(200);
            expect(
                wlBody.some((w: { doctorId: number }) => w.doctorId === doctor.doctorRecordId),
                'patient2 removed from waitlist after promotion',
            ).toBe(false);

            const dbOldSlot = dbClient.getSlotById(slotBody.id);
            expect(dbOldSlot!.isAvailable, 'DB: old slot taken by promoted patient').toBe(0);

            const dbWaitlist = dbClient.getWaitlistByPatient(user2.user.id);
            expect(dbWaitlist, 'DB: patient2 waitlist entry removed').toHaveLength(0);

            const dbAppts = dbClient.getActiveAppointmentsForSlot(slotBody.id);
            expect(dbAppts).toHaveLength(1);
            expect(dbAppts[0].patientId, 'DB: slot appointment belongs to patient2').toBe(user2.user.id);
        } finally {
            await cleanup();
        }
    },
);

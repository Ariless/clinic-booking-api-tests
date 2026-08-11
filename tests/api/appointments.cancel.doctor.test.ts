import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { assertSchema } from '../../utils/schemaValidator';
import { validateAppointment } from '../../data/schemas/appointmentSchemas';
import { assertSlotAvailable } from '../../utils/slotAssertion';
import { dbClient } from '../../utils/dbClient';

test.describe('PATCH /api/v1/appointments/:id/cancel-as-doctor', () => {
    test("PATCH /api/v1/appointments/:id/cancel-as-doctor — 200 confirmed → cancelled @api", async ({ request, user, slot }) => {
        const { slot: slotBody, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

        const appointments = new AppointmentsClient(request);
        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
        expect(bookStatus).toBe(201);

        const { status: confirmStatus } = await appointments.confirmAppointment(bookBody.id, doctorAuth);
        expect(confirmStatus).toBe(200);

        const { status: cancelStatus, body: cancelBody } = await appointments.cancelAsDoctor(bookBody.id, doctorAuth);
        expect(cancelStatus).toBe(200);
        assertSchema(cancelBody, validateAppointment);
        expect(cancelBody.status).toBe("cancelled");
    });

    test("PATCH /api/v1/appointments/:id/cancel-as-doctor — 200 frees the slot after doctor cancels @api", async ({ request, user, slot }) => {
        const { slot: slotBody, doctorToken, doctor, seedSlotStart, seedSlotEnd } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

        const appointments = new AppointmentsClient(request);
        const { body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
        await appointments.confirmAppointment(bookBody.id, doctorAuth);
        await appointments.cancelAsDoctor(bookBody.id, doctorAuth);

        const doctors = new DoctorsClient(request);
        const { status: slotsStatus, body: slotsBody } = await doctors.listPublicSlots(doctor.doctorRecordId);
        expect(slotsStatus).toBe(200);
        const listedSlot = slotsBody.find((s: { id: number }) => s.id === slotBody.id);
        assertSlotAvailable(listedSlot, doctor, { startTime: seedSlotStart, endTime: seedSlotEnd });

        const dbSlot = dbClient.getSlotById(slotBody.id);
        expect(dbSlot!.isAvailable, "DB: slot must be freed after doctor cancels").toBe(1);
    });

    test("PATCH /api/v1/appointments/:id/cancel-as-doctor — 200 persists cancelled status in DB @api", async ({ request, user, slot }) => {
        const { slot: slotBody, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };

        const appointments = new AppointmentsClient(request);
        const { body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
        await appointments.confirmAppointment(bookBody.id, doctorAuth);
        await appointments.cancelAsDoctor(bookBody.id, doctorAuth);

        const dbAppt = dbClient.getAppointmentById(bookBody.id);
        expect(dbAppt!.status, "DB: appointment status must be cancelled").toBe("cancelled");
    });
});

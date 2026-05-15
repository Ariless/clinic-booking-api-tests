import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { assertSlotAvailable } from '../../utils/slotAssertion';
import { dbClient } from '../../utils/dbClient';

test("PATCH /api/v1/appointments/:id/cancel — 200 patient cancels own appointment, slot freed @api", async ({ request, user, slot }) => {
    const { slot: slotBody, doctor, seedSlotStart, seedSlotEnd } = slot;

    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status: cancelStatus, body: cancelBody } = await appointments.cancelAppointment(bookBody.id, patientAuth);
    expect(cancelStatus).toBe(200);
    expect(cancelBody.status).toBe("cancelled");

    const doctors = new DoctorsClient(request);
    const { status: slotsStatus, body: slotsBody } = await doctors.listPublicSlots(doctor.doctorRecordId);
    expect(slotsStatus).toBe(200);
    const listedSlot = slotsBody.find((s: { id: number }) => s.id === slotBody.id);
    assertSlotAvailable(listedSlot, doctor, { startTime: seedSlotStart, endTime: seedSlotEnd });

    const dbSlot = dbClient.getSlotById(slotBody.id);
    expect(dbSlot!.isAvailable, "DB: slot must be freed after cancel").toBe(1);
    const dbAppt = dbClient.getAppointmentById(bookBody.id);
    expect(dbAppt!.status, "DB: appointment status must be cancelled").toBe("cancelled");
});

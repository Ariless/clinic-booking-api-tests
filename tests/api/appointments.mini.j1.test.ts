import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { assertSchema } from '../../utils/schemaValidator';
import { validateAppointment } from '../../data/schemas/appointmentSchemas';
import { dbClient } from '../../utils/dbClient';

test("POST /api/v1/appointments — 201 patient books slot, GET /my shows pending @smoke", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);
    assertSchema(bookBody, validateAppointment);
    expect(bookBody.status).toBe("pending");
    expect(bookBody.slotId).toBe(slotBody.id);

    const { status: myStatus, body: myBody } = await appointments.listMy(patientAuth);
    expect(myStatus).toBe(200);
    const row = myBody.find((a: { id: number }) => a.id === bookBody.id);
    expect(row, "appointment should appear in GET /appointments/my").toBeTruthy();
    expect(row.status).toBe("pending");

    const dbSlot = dbClient.getSlotById(slotBody.id);
    expect(dbSlot!.isAvailable, "DB: slot must be unavailable after booking").toBe(0);
    const dbAppt = dbClient.getAppointmentById(bookBody.id);
    expect(dbAppt!.status, "DB: appointment status must be pending").toBe("pending");
    expect(dbAppt!.patientId, "DB: appointment must belong to the patient").toBe(bookBody.patientId);
});

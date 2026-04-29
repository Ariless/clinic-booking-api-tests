const { test, expect } = require("../../fixtures");
const { AppointmentsClient } = require("../../api/AppointmentsClient");
const { DoctorsClient } = require("../../api/DoctorsClient");
const { assertSlotAvailable } = require("../../utils/slotAssertion");

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
    const listedSlot = slotsBody.find((s) => s.id === slotBody.id);
    assertSlotAvailable(listedSlot, doctor, { startTime: seedSlotStart, endTime: seedSlotEnd });
});

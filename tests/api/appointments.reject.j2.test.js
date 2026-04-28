const { test, expect } = require("../../fixtures");
const { AppointmentsClient } = require("../../api/AppointmentsClient");
const { DoctorsClient } = require("../../api/DoctorsClient");

test("PATCH /api/v1/appointments/:id/reject — J2 pending → rejected @api", async ({ request, user, slot }) => {
    const { slot: slotBody, doctorToken, doctor, seedSlotStart, seedSlotEnd } = slot;

    const appointments = new AppointmentsClient(request);
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(bookStatus).toBe(201);

    const { status: rejectStatus, body: rejectBody } = await appointments.rejectAppointment(bookBody.id, {
        headers: { Authorization: `Bearer ${doctorToken}` },
    });
    expect(rejectStatus).toBe(200);
    expect(rejectBody.id).toBe(bookBody.id);
    expect(rejectBody.status).toBe("rejected");
    expect(rejectBody.slotId).toBe(slotBody.id);

    const doctors = new DoctorsClient(request);
    const { status: slotsStatus, body: slotsBody } = await doctors.listPublicSlots(doctor.doctorRecordId);
    expect(slotsStatus).toBe(200);
    const listedSlot = slotsBody.find((s) => s.id === slotBody.id);
    expect(listedSlot, "slot reappears in public slots after reject").toBeDefined();
    expect(listedSlot.isAvailable).toBeTruthy();
    expect(listedSlot.doctorId).toBe(doctor.doctorRecordId);
    expect(listedSlot.startTime).toBe(seedSlotStart);
    expect(listedSlot.endTime).toBe(seedSlotEnd);
});

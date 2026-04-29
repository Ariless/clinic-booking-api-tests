const { test, expect } = require("../../fixtures/twoUsersFixture");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

test("POST /api/v1/appointments — 409 SLOT_TAKEN when slot is already booked @api", async ({ request, user, user2, slot }) => {
    const { slot: slotBody } = slot;

    const appointments = new AppointmentsClient(request);
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(bookStatus).toBe(201);
    expect(bookBody.status).toBe("pending");

    const { status: conflictStatus, body: conflictBody } = await appointments.createAppointment(slotBody.id, {
        headers: { Authorization: `Bearer ${user2.token}` },
    });
    expect(conflictStatus).toBe(409);
    expect(conflictBody.errorCode).toBe("SLOT_TAKEN");
});

const { test, expect } = require("../../fixtures");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

test("POST /api/v1/appointments — 201 patient books slot, GET /my shows pending @smoke", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);
    expect(bookBody.status).toBe("pending");
    expect(bookBody.slotId).toBe(slotBody.id);

    const { status: myStatus, body: myBody } = await appointments.listMy(patientAuth);
    expect(myStatus).toBe(200);
    const row = myBody.find((a) => a.id === bookBody.id);
    expect(row, "appointment should appear in GET /appointments/my").toBeTruthy();
    expect(row.status).toBe("pending");
});

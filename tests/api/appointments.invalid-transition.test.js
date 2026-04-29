const { test, expect } = require("../../fixtures");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

test("PATCH /api/v1/appointments/:id/confirm — 422 INVALID_TRANSITION when already confirmed @api", async ({ request, user, slot }) => {
    const { slot: slotBody, doctorToken } = slot;

    const appointments = new AppointmentsClient(request);
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(bookStatus).toBe(201);

    const { status: confirmStatus, body: confirmBody } = await appointments.confirmAppointment(bookBody.id, {
        headers: { Authorization: `Bearer ${doctorToken}` },
    });
    expect(confirmStatus).toBe(200);
    expect(confirmBody.status).toBe("confirmed");

    const { status: confirmStatus1, body: confirmBody1 } = await appointments.confirmAppointment(bookBody.id, {
        headers: { Authorization: `Bearer ${doctorToken}` },
    });
    expect(confirmStatus1).toBe(422);
    expect(confirmBody1.message).toBeTruthy();
    expect(confirmBody1.errorCode).toBe("INVALID_TRANSITION");
    expect(confirmBody1.requestId).toBeTruthy();
})

test("PATCH /api/v1/appointments/:id/confirm — 422 INVALID_TRANSITION when appointment already rejected @api", async ({ request, user, slot }) => {
    const { slot: slotBody, doctorToken } = slot;

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

    const { status: confirmStatus1, body: confirmBody1 } = await appointments.confirmAppointment(bookBody.id, {
        headers: { Authorization: `Bearer ${doctorToken}` },
    });
    expect(confirmStatus1).toBe(422);
    expect(confirmBody1.message).toBeTruthy();
    expect(confirmBody1.errorCode).toBe("INVALID_TRANSITION");
    expect(confirmBody1.requestId).toBeTruthy();
})

test("PATCH /api/v1/appointments/:id/cancel — 422 INVALID_TRANSITION when already cancelled @api", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;

    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status: cancelStatus, body: cancelBody } = await appointments.cancelAppointment(bookBody.id, patientAuth);
    expect(cancelStatus).toBe(200);
    expect(cancelBody.status).toBe("cancelled");

    const { status: cancelStatus1, body: cancelBody1 } = await appointments.cancelAppointment(bookBody.id, patientAuth);
    expect(cancelStatus1).toBe(422);
    expect(cancelBody1.message).toBeTruthy()
    expect(cancelBody1.errorCode).toBe("INVALID_TRANSITION");
    expect(cancelBody1.requestId).toBeTruthy();
});
const { test, expect } = require("../../fixtures");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

test("PATCH /api/v1/appointments/:id/confirm — 403 FORBIDDEN when patient tries to confirm @api", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;

    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status: confirmStatus, body: confirmBody } = await appointments.confirmAppointment(bookBody.id, {
        headers: { Authorization: `Bearer ${user.token}` },
    });

    expect(confirmStatus).toBe(403);
    expect(confirmBody.errorCode).toBe("FORBIDDEN");
});

test("PATCH /api/v1/appointments/:id/reject — 403 FORBIDDEN when patient tries to reject @api", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);
    const { status: rejectStatus, body: rejectBody } = await appointments.rejectAppointment(bookBody.id, {
        headers: { Authorization: `Bearer ${user.token}` },
    })
    expect(rejectStatus).toBe(403);
    expect(rejectBody.errorCode).toBe("FORBIDDEN");
})

test("GET /api/v1/appointments/my — 403 FORBIDDEN when doctor accesses patient-only route @api", async ({ request, user, slot }) => {
    const appointments = new AppointmentsClient(request);
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const { status: myStatus, body: myBody } = await appointments.listMy(doctorAuth);
    expect(myStatus).toBe(403);
    expect(myBody.errorCode).toBe("FORBIDDEN");
});

test("GET /api/v1/appointments/doctor — 403 FORBIDDEN when patient accesses doctor-only route @api", async ({ request, user }) => {
    const { endpoints } = require("../../data/testData");
    const { assertSchema } = require("../../utils/schemaValidator");
    const { validateError } = require("../../data/schemas/errorSchema");
    const response = await request.get(endpoints.appointmentsDoctor, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    assertSchema(body, validateError);
    expect(body.errorCode).toBe("FORBIDDEN");
});
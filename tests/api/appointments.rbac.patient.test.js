const { test, expect } = require("../../fixtures");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

test("Patient cannot confirm an appointment @api", async ({ request, user, slot }) => {
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

test("Patient cannot reject an appointment @api", async ({ request, user, slot }) => {
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

test("Doctor cannot GET /appointments/my @api", async ({ request, user, slot }) => {
    const appointments = new AppointmentsClient(request);
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const { status: myStatus, body: myBody } = await appointments.listMy(doctorAuth);
    expect(myStatus).toBe(403);
    expect(myBody.errorCode).toBe("FORBIDDEN");
})
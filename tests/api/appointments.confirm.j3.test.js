const { test, expect } = require("../../fixtures");
const { AppointmentsClient } = require("../../api/AppointmentsClient");
const { DoctorsClient } = require("../../api/DoctorsClient");

test("PATCH /api/v1/appointments/:id/confirm — J3 pending → confirmed @api", async ({ request, user, slot }) => {
    const { slot: slotBody, doctorToken, doctor } = slot;
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const appointments = new AppointmentsClient(request);
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status: confirmStatus, body: confirmBody } = await appointments.confirmAppointment(bookBody.id, {
        headers: { Authorization: `Bearer ${doctorToken}` },
    });
    expect(confirmStatus).toBe(200);
    expect(confirmBody.status).toBe("confirmed");

    const { status: myStatus, body: myBody } = await appointments.listMy(patientAuth);
    expect(myStatus).toBe(200);
    const confirmedRow = myBody.find((a) => a.id === bookBody.id);
    expect(confirmedRow, "appointment after confirm").toBeTruthy();
    expect(confirmedRow.status).toBe("confirmed");

    const doctors = new DoctorsClient(request);
    const { status: slotsStatus, body: slotsBody } = await doctors.listPublicSlots(doctor.doctorRecordId);
    expect(slotsStatus).toBe(200);
    const listedSlot = slotsBody.find((s) => s.id === slotBody.id);
    expect(listedSlot, "slot is no longer available after confirm").toBeFalsy();
});

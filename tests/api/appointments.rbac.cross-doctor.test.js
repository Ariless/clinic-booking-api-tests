const { test, expect } = require("../../fixtures");
const { AuthClient } = require("../../api/AuthClient");
const { AppointmentsClient } = require("../../api/AppointmentsClient");
const { seedDoctors } = require("../../data/seedAccounts");

test("Doctor cannot confirm another doctor's appointment — 403 @api", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;

    const appointments = new AppointmentsClient(request);
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(bookStatus).toBe(201);

    const auth = new AuthClient(request);
    const { body: loginBody } = await auth.verifyLogin(seedDoctors[1].email, seedDoctors[1].password);
    const doctor2Token = loginBody.token;

    const { status, body } = await appointments.confirmAppointment(bookBody.id, {
        headers: { Authorization: `Bearer ${doctor2Token}` },
    });
    expect(status).toBe(403);
    expect(body.errorCode).toBe("FORBIDDEN");
});

test("Doctor cannot reject another doctor's appointment — 403 @api", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;

    const appointments = new AppointmentsClient(request);
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(bookStatus).toBe(201);

    const auth = new AuthClient(request);
    const { body: loginBody } = await auth.verifyLogin(seedDoctors[1].email, seedDoctors[1].password);
    const doctor2Token = loginBody.token;

    const { status, body } = await appointments.rejectAppointment(bookBody.id, {
        headers: { Authorization: `Bearer ${doctor2Token}` },
    });
    expect(status).toBe(403);
    expect(body.errorCode).toBe("FORBIDDEN");
});

test("Doctor cannot cancel-as-doctor another doctor's appointment — 403 @api", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;

    const appointments = new AppointmentsClient(request);
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(bookStatus).toBe(201);

    const auth = new AuthClient(request);
    const { body: loginBody } = await auth.verifyLogin(seedDoctors[1].email, seedDoctors[1].password);
    const doctor2Token = loginBody.token;

    const { status, body } = await appointments.cancelAsDoctor(bookBody.id, {
        headers: { Authorization: `Bearer ${doctor2Token}` },
    });
    expect(status).toBe(403);
    expect(body.errorCode).toBe("FORBIDDEN");
});

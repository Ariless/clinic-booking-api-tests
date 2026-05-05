const { test, expect } = require("../../fixtures");
const { AppointmentsClient } = require("../../api/AppointmentsClient");
const { createWebhookTestServer } = require("../../utils/webhookTestServer");

// To run these tests:
// 1. Start SUT:  WEBHOOK_URL=http://localhost:9001 npm run dev
// 2. Run tests:  WEBHOOK_URL=http://localhost:9001 npx playwright test notifications.webhook.test.js
// Note: appointment.confirmed is covered in tests/e2e/booking.cross-layer.test.js

const WEBHOOK_CONFIGURED = Boolean(process.env.WEBHOOK_URL);
const webhookServer = createWebhookTestServer();

test.beforeAll(async () => {
  if (!WEBHOOK_CONFIGURED) return;
  await webhookServer.start();
});

test.afterAll(async () => {
  await webhookServer.stop();
});

test.describe("notifications — webhook delivery @webhook", () => {
  test.skip(
    !WEBHOOK_CONFIGURED,
    "Restart SUT with WEBHOOK_URL=http://localhost:9001 npm run dev, then: WEBHOOK_URL=http://localhost:9001 npx playwright test notifications.webhook.test.js"
  );

  test("PATCH /api/v1/appointments/:id/reject — webhook fires appointment.rejected @webhook", async ({
    request,
    user,
    slot,
  }) => {
    const { slot: slotBody, doctorToken } = slot;
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(
      slotBody.id,
      patientAuth
    );
    expect(bookStatus).toBe(201);

    const webhookPromise = webhookServer.waitForWebhook();
    const { status: rejectStatus } = await appointments.rejectAppointment(bookBody.id, doctorAuth);
    expect(rejectStatus).toBe(200);

    const payload = await webhookPromise;
    expect(payload.event).toBe("appointment.rejected");
    expect(payload.appointmentId).toBe(bookBody.id);
    expect(payload.patientId).toBe(user.user.id);
    expect(payload.status).toBe("rejected");
    expect(typeof payload.timestamp).toBe("string");
  });

  test("PATCH /api/v1/appointments/:id/cancel — webhook fires appointment.cancelled_by_patient @webhook", async ({
    request,
    user,
    slot,
  }) => {
    const { slot: slotBody } = slot;
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(
      slotBody.id,
      patientAuth
    );
    expect(bookStatus).toBe(201);

    const webhookPromise = webhookServer.waitForWebhook();
    const { status: cancelStatus } = await appointments.cancelAppointment(bookBody.id, patientAuth);
    expect(cancelStatus).toBe(200);

    const payload = await webhookPromise;
    expect(payload.event).toBe("appointment.cancelled_by_patient");
    expect(payload.appointmentId).toBe(bookBody.id);
    expect(payload.patientId).toBe(user.user.id);
    expect(payload.status).toBe("cancelled");
    expect(typeof payload.timestamp).toBe("string");
  });

  test("PATCH /api/v1/appointments/:id/cancel-as-doctor — webhook fires appointment.cancelled_by_doctor @webhook", async ({
    request,
    user,
    slot,
  }) => {
    const { slot: slotBody, doctorToken } = slot;
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(
      slotBody.id,
      patientAuth
    );
    expect(bookStatus).toBe(201);

    const webhookPromise = webhookServer.waitForWebhook();
    const { status: cancelStatus } = await appointments.cancelAsDoctor(bookBody.id, doctorAuth);
    expect(cancelStatus).toBe(200);

    const payload = await webhookPromise;
    expect(payload.event).toBe("appointment.cancelled_by_doctor");
    expect(payload.appointmentId).toBe(bookBody.id);
    expect(payload.patientId).toBe(user.user.id);
    expect(payload.status).toBe("cancelled");
    expect(typeof payload.timestamp).toBe("string");
  });
});

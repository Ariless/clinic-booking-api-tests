const WebSocket = require("ws");
const { test, expect } = require("../../fixtures");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

// To run: npx playwright test notifications.ws.test.js
// SUT must be running (standard: npm run dev — no extra env vars needed)

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const WS_URL = BASE_URL.replace(/^http/, "ws") + "/ws";

function connectDoctor(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
    setTimeout(() => reject(new Error("WS connect timeout")), 3000);
  });
}

function waitForMessage(ws, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WS message timeout")), timeoutMs);
    ws.once("message", (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

test.describe("notifications — WebSocket delivery @ws", () => {
  test("POST /api/v1/appointments — doctor WS receives appointment.booked when patient books @ws", async ({
    request,
    user,
    slot,
  }) => {
    const { slot: slotBody, doctorToken } = slot;
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const ws = await connectDoctor(doctorToken);
    const messagePromise = waitForMessage(ws);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(
      slotBody.id,
      patientAuth
    );
    expect(bookStatus).toBe(201);

    const payload = await messagePromise;
    ws.close();

    expect(payload.event).toBe("appointment.booked");
    expect(payload.appointmentId).toBe(bookBody.id);
    expect(payload.patientId).toBe(user.user.id);
    expect(payload.status).toBe("pending");
    expect(typeof payload.timestamp).toBe("string");
  });

  test("PATCH /api/v1/appointments/:id/cancel — doctor WS receives appointment.cancelled_by_patient @ws", async ({
    request,
    user,
    slot,
  }) => {
    const { slot: slotBody, doctorToken } = slot;
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(
      slotBody.id,
      patientAuth
    );
    expect(bookStatus).toBe(201);

    const ws = await connectDoctor(doctorToken);
    const messagePromise = waitForMessage(ws);

    const { status: cancelStatus } = await appointments.cancelAppointment(bookBody.id, patientAuth);
    expect(cancelStatus).toBe(200);

    const payload = await messagePromise;
    ws.close();

    expect(payload.event).toBe("appointment.cancelled_by_patient");
    expect(payload.appointmentId).toBe(bookBody.id);
    expect(payload.patientId).toBe(user.user.id);
    expect(payload.status).toBe("cancelled");
    expect(typeof payload.timestamp).toBe("string");
  });

  test("WS connect with invalid token — connection rejected with code 4001 @ws", async ({ request }) => {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`${WS_URL}?token=invalid.token.here`);
      ws.once("close", (code) => {
        try {
          expect(code).toBe(4001);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      ws.once("error", () => {}); // suppress node error event
      setTimeout(() => reject(new Error("WS close timeout")), 3000);
    });
  });
});

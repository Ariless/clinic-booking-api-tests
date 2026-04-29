const { test, expect } = require("../../fixtures/userFixture");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

const BOOKING_MAX = parseInt(process.env.RATE_LIMIT_BOOKING_MAX ?? "20");

test.describe("POST /api/v1/appointments — booking rate limit @rate-limit", () => {
    test.skip(BOOKING_MAX > 5, `RATE_LIMIT_BOOKING_MAX=${BOOKING_MAX}; set RATE_LIMIT_BOOKING_MAX=2 and RATE_LIMIT_BOOKING_WINDOW_MS=5000 to run this suite`);

    test("429 RATE_LIMITED after exhausting per-IP booking limit @rate-limit", async ({ request, user }) => {
        const appointments = new AppointmentsClient(request);
        const opts = { headers: { Authorization: `Bearer ${user.token}` } };

        for (let i = 0; i < BOOKING_MAX; i++) {
            await appointments.createAppointment(999999, opts);
        }

        const { status, body } = await appointments.createAppointment(999999, opts);
        expect(status).toBe(429);
        expect(body.errorCode).toBe("RATE_LIMITED");
        expect(body.message).toBeTruthy();
        expect(body.requestId).toBeTruthy();
    });
});
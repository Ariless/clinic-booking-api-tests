import { test, expect } from "../../fixtures";
import { AppointmentsClient } from "../../api/AppointmentsClient";
import { createWebhookTestServer } from "../../utils/webhookTestServer";

test("patient books via UI wizard — appointment appears as pending in API @e2e", async ({ request, user, slot, loginPage, bookingPage }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    // 1. LOGIN via UI
    await loginPage.login(user.email, user.password);

    // 2. WALK through all 4 wizard steps (specialty → doctor → slot → confirm)
    await bookingPage.walkWizard(slot.doctor.specialty, slot.doctor.name);

    // 3. SUBMIT booking on step 4
    await bookingPage.submitBookingButton.click();

    // 4. ASSERT success message visible in UI
    await expect(bookingPage.bookingSuccessMessage).toBeVisible();

    // 5. VERIFY via API — appointment exists with status pending
    const response = await request.get("/api/v1/appointments/my", patientAuth);
    expect(response.status()).toBe(200);
    const body = await response.json();
    const appointments = Array.isArray(body) ? body : (body?.data ?? []);
    const pending = appointments.find((a: { status: string }) => a.status === "pending");
    expect(pending).toBeTruthy();
});

// ─── Webhook cross-layer ──────────────────────────────────────────────────────

const WEBHOOK_CONFIGURED = Boolean(process.env.WEBHOOK_URL);
const webhookServer = createWebhookTestServer();

test.describe("booking + notification — cross-layer @e2e @webhook", () => {
    test.skip(
        !WEBHOOK_CONFIGURED,
        "Restart SUT with WEBHOOK_URL=http://localhost:9001 npm run dev, then: WEBHOOK_URL=http://localhost:9001 npx playwright test booking.cross-layer.test.ts"
    );

    test.beforeAll(async () => {
        await webhookServer.start();
    });

    test.afterAll(async () => {
        await webhookServer.stop();
    });

    test("patient books → doctor confirms via API — webhook fires appointment.confirmed @e2e @webhook", async ({ request, user, slot }) => {
        const { slot: slotBody, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
        const appointments = new AppointmentsClient(request);

        const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
        expect(bookStatus).toBe(201);

        const webhookPromise = webhookServer.waitForWebhook();
        const { status: confirmStatus, body: confirmBody } = await appointments.confirmAppointment(
            bookBody.id,
            doctorAuth
        );
        expect(confirmStatus).toBe(200);
        expect(confirmBody.status).toBe("confirmed");

        const payload = await webhookPromise;
        expect(payload.event).toBe("appointment.confirmed");
        expect(payload.appointmentId).toBe(bookBody.id);
        expect(payload.patientId).toBe(user.user.id);
        expect(payload.status).toBe("confirmed");
        expect(typeof payload.timestamp).toBe("string");
    });
});

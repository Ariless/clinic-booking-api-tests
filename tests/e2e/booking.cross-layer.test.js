const { test, expect } = require("../../fixtures");
const { LoginPage } = require("../../pages/LoginPage");
const { BookingPage } = require("../../pages/BookingPage");
const { AppointmentsClient } = require("../../api/AppointmentsClient");
const { createWebhookTestServer } = require("../../utils/webhookTestServer");

test("patient books via UI — appointment appears as pending in API @e2e", async ({ request, page, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    // 1. LOGIN via UI
    const loginPage = new LoginPage(page);
    await loginPage.login(user.email, user.password);

    // 2. NAVIGATE to booking page — wait for doctors API to finish loading
    const bookingPage = new BookingPage(page);
    await bookingPage.open()

    // 3. SELECT specialty — wait for doctors wrap to confirm options are in DOM
    await expect(bookingPage.bookingDoctorWrap).toBeVisible();
    await bookingPage.bookingSpeciality.selectOption(slot.doctor.specialty);

    // 4. WAIT for doctor dropdown to be enabled, then select
    await expect(bookingPage.bookingDoctor).toBeEnabled();
    await bookingPage.bookingDoctor.selectOption(slot.doctor.name);

    // 5. WAIT for slot pickers to appear, then select first available day
    await expect(bookingPage.bookingSlotPicker).toBeVisible();
    const slotDay = bookingPage.bookingDaySlot;
    const firstDay = await slotDay.locator("option").nth(1).getAttribute("value");
    await slotDay.selectOption(firstDay);

    // 6. WAIT for time dropdown to be enabled, then select first available time
    const slotTime = bookingPage.bookingTimeSlot;
    await expect(slotTime).toBeEnabled();
    const firstTime = await slotTime.locator("option").nth(1).getAttribute("value");
    await slotTime.selectOption(firstTime);

    // 7. SUBMIT booking
    await bookingPage.submitBookingButton.click();

    // 8. ASSERT success message visible in UI
    await expect(bookingPage.bookingSuccessMessage).toBeVisible();

    // 9. VERIFY via API — appointment exists with status pending
    const response = await request.get("/api/v1/appointments/my", patientAuth);
    expect(response.status()).toBe(200);
    const appointments = await response.json();
    const pending = appointments.find((a) => a.status === "pending");
    expect(pending).toBeTruthy();
});

// ─── Webhook cross-layer ──────────────────────────────────────────────────────

const WEBHOOK_CONFIGURED = Boolean(process.env.WEBHOOK_URL);
const webhookServer = createWebhookTestServer();

test.describe("booking + notification — cross-layer @e2e @webhook", () => {
  test.skip(
    !WEBHOOK_CONFIGURED,
    "Restart SUT with WEBHOOK_URL=http://localhost:9001 npm run dev, then: WEBHOOK_URL=http://localhost:9001 npx playwright test booking.cross-layer.test.js"
  );

  test.beforeAll(async () => {
    await webhookServer.start();
  });

  test.afterAll(async () => {
    await webhookServer.stop();
  });

  test("patient books → doctor confirms via API — webhook fires appointment.confirmed @e2e @webhook", async ({
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
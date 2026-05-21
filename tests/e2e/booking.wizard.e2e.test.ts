import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { BookingPage } from "../../pages/BookingPage";
import { dbClient } from "../../utils/dbClient";

test("booking wizard — full happy path creates appointment in DB @e2e @smoke",
    async ({ request, page, user, slot }) => {
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

        // 1. Login
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        // 2. Walk all 4 wizard steps — returns slotId selected in step 3
        const bookingPage = new BookingPage(page);
        const selectedSlotId = Number(await bookingPage.walkWizard(slot.doctor.specialty, slot.doctor.name));

        // 3. Submit booking on step 4
        await bookingPage.submitBookingButton.click();

        // 4. UI: success message visible, action buttons hidden
        await expect(bookingPage.bookingSuccessMessage).toBeVisible();
        await expect(bookingPage.submitBookingButton).not.toBeVisible();

        // 5. API: appointment appears as pending for the selected slot
        const res = await request.get("/api/v1/appointments/my", patientAuth);
        expect(res.status()).toBe(200);
        const body = await res.json();
        const appts = Array.isArray(body) ? body : (body?.data ?? []);
        const pending = appts.find((a: { status: string; slotId: number }) =>
            a.status === "pending" && a.slotId === selectedSlotId,
        );
        expect(pending, "API: pending appointment for the selected slot must exist").toBeTruthy();

        // 6. DB: appointment row exists with correct patient and slot
        const dbAppts = dbClient.getActiveAppointmentsForSlot(selectedSlotId);
        expect(dbAppts).toHaveLength(1);
        expect(dbAppts[0].patientId).toBe(user.user.id);
    },
);

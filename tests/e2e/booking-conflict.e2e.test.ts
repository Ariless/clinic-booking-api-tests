import { test, expect } from "../../fixtures/twoUsersFixture";
import { LoginPage } from "../../pages/LoginPage";
import { BookingPage } from "../../pages/BookingPage";
import { AppointmentsClient } from "../../api/AppointmentsClient";
import { dbClient } from "../../utils/dbClient";

test("booking wizard — UI shows slot-taken error when slot taken by another patient @e2e", async ({ request, page, user, user2, slot }) => {
    const appointments = new AppointmentsClient(request);

    // 1. USER2 logs in via UI and walks through all 4 wizard steps
    const loginPage = new LoginPage(page);
    await loginPage.login(user2.email, user2.password);

    const bookingPage = new BookingPage(page);
    // walkWizard returns the slot ID that user2 selected in step 3
    const selectedSlotId = Number(await bookingPage.walkWizard(slot.doctor.specialty, slot.doctor.name));

    // 2. USER1 books the SAME slot via API while user2 is on the confirm screen
    const { status: bookStatus } = await appointments.createAppointment(selectedSlotId, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(bookStatus).toBe(201);

    // 3. USER2 submits — slot is now taken → 409 → slot-taken message
    await bookingPage.submitBookingButton.click();

    // 4. ASSERT slot-taken error visible; back button still available
    await expect(bookingPage.bookingFormMessage).toContainText("slot was just taken");
    await expect(bookingPage.step4Back).toBeVisible();

    // DB: only one active appointment must exist for this slot (user1's)
    const dbAppts = dbClient.getActiveAppointmentsForSlot(selectedSlotId);
    expect(dbAppts, "DB: exactly one active appointment must exist for the slot").toHaveLength(1);
    expect(dbAppts[0].patientId, "DB: the booking must belong to user1, not user2").toBe(user.user.id);
});

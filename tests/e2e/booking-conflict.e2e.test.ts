import { test, expect } from "../../fixtures/twoUsersFixture";
import { LoginPage } from "../../pages/LoginPage";
import { BookingPage } from "../../pages/BookingPage";
import { AppointmentsClient } from "../../api/AppointmentsClient";
import { dbClient } from "../../utils/dbClient";

test("booking page — UI shows error when slot taken by another patient @e2e", async ({ request, page, user, user2, slot }) => {
    const appointments = new AppointmentsClient(request);

    // 1. USER2 logs in via UI and selects the slot (slot is still available)
    const loginPage = new LoginPage(page);
    await loginPage.login(user2.email, user2.password);

    const bookingPage = new BookingPage(page);
    await bookingPage.open();
    await bookingPage.bookingSpeciality.selectOption(slot.doctor.specialty);

    await expect(bookingPage.bookingDoctor).toBeEnabled();
    await bookingPage.bookingDoctor.selectOption(slot.doctor.name);

    await expect(bookingPage.bookingSlotPicker).toBeVisible();
    const slotDay = bookingPage.bookingDaySlot;
    const firstDay = await slotDay.locator("option").nth(1).getAttribute("value");
    await slotDay.selectOption(firstDay);

    const slotTime = bookingPage.bookingTimeSlot;
    await expect(slotTime).toBeEnabled();
    const firstTime = await slotTime.locator("option").nth(1).getAttribute("value");
    await slotTime.selectOption(firstTime);

    // 2. USER books the same slot via API while user2 has it selected
    const { status: bookStatus } = await appointments.createAppointment(slot.slot.id, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(bookStatus).toBe(201);

    // 3. USER2 submits — slot is now taken
    await bookingPage.submitBookingButton.click();

    // 4. ASSERT error message visible in UI
    await expect(bookingPage.bookingFormMessage).toBeVisible();

    // DB: only one active appointment must exist for this slot (user1's)
    const dbAppts = dbClient.getActiveAppointmentsForSlot(slot.slot.id);
    expect(dbAppts, "DB: exactly one active appointment must exist for the slot").toHaveLength(1);
    expect(dbAppts[0].patientId, "DB: the booking must belong to user1, not user2").toBe(user.user.id);
});

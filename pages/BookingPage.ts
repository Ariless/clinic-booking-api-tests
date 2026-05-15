import { Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class BookingPage extends BasePage {
    readonly bookingDoctorWrap = this.page.getByTestId("booking-doctors-wrap");
    readonly bookingSpeciality = this.page.getByTestId("booking-specialty");
    readonly bookingDoctor = this.page.getByTestId("booking-doctor");
    readonly bookingSlotPicker = this.page.getByTestId("booking-slot-pickers");
    readonly bookingDaySlot = this.page.getByTestId("booking-slot-day");
    readonly bookingTimeSlot = this.page.getByTestId("booking-slot-time");
    readonly submitBookingButton = this.page.getByTestId("booking-submit");
    readonly bookingSuccessMessage = this.page.getByTestId("booking-success-message");
    readonly bookingFormMessage = this.page.getByTestId("booking-form-message");

    constructor(page: Page) {
        super(page);
        this.url = "/patient/booking";
    }

    async open() {
        await Promise.all([
            this.page.waitForResponse((res) => res.url().includes("/api/v1/doctors") && res.status() === 200),
            this.navigate(this.url),
        ]);
    }
}
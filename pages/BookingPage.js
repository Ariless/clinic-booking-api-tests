const BasePage = require("./BasePage");

class BookingPage extends BasePage {
    constructor(page) {
        super(page);
        this.url = "/patient/booking";
        this.bookingDoctorWrap = page.getByTestId("booking-doctors-wrap");
        this.bookingSpeciality = page.getByTestId("booking-specialty");
        this.bookingDoctor = page.getByTestId("booking-doctor");
        this.bookingSlotPicker = page.getByTestId("booking-slot-pickers");
        this.bookingDaySlot = page.getByTestId("booking-slot-day");
        this.bookingTimeSlot = page.getByTestId("booking-slot-time");
        this.submitBookingButton = page.getByTestId("booking-submit");
        this.bookingSuccessMessage = page.getByTestId("booking-success-message");
        this.bookingFormMessage = page.getByTestId("booking-form-message");
    }

    async open() {
        await Promise.all([
            this.page.waitForResponse((res) => res.url().includes("/api/v1/doctors") && res.status() === 200),
            this.navigate(this.url),
        ]);
    }
}

module.exports = { BookingPage }
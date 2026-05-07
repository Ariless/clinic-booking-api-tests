const BasePage = require("./BasePage");

class AppointmentsPage extends BasePage {
    constructor(page) {
        super(page);
        this.url = "/patient/appointments";
        this.appointmentsList = page.getByTestId("patient-appt-list");
        this.waitlistSection = page.getByTestId("patient-waitlist-section");
        this.waitlistList = page.getByTestId("patient-waitlist-list");
        this.offersSection = page.getByTestId("patient-offers-section");
        this.offersList = page.getByTestId("patient-offers-list");
    }

    async open() {
        await this.navigate(this.url);
    }

    appointmentByStatus(status) {
        const labels = {
            pending: "Waiting on clinic",
            confirmed: "Confirmed",
            cancelled: "Cancelled",
            rejected: "Rejected"
        };
        return this.appointmentsList.getByText(labels[status] ?? status);
    }

    waitlistItem() {
        return this.waitlistList.getByTestId("patient-waitlist-item");
    }

    waitlistLeaveButton() {
        return this.waitlistList.getByTestId("patient-waitlist-leave");
    }

    offerItem() {
        return this.offersList.getByTestId("patient-offer-item");
    }

    offerAcceptButton() {
        return this.offersList.getByTestId("patient-offer-accept").first();
    }

    offerDeclineButton() {
        return this.offersList.getByTestId("patient-offer-decline").first();
    }
}

module.exports = { AppointmentsPage }
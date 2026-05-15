import { Page } from "@playwright/test";
import { BasePage } from "./BasePage";

type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "rejected";

export class AppointmentsPage extends BasePage {
    readonly appointmentsList = this.page.getByTestId("patient-appt-list");
    readonly waitlistSection = this.page.getByTestId("patient-waitlist-section");
    readonly waitlistList = this.page.getByTestId("patient-waitlist-list");
    readonly offersSection = this.page.getByTestId("patient-offers-section");
    readonly offersList = this.page.getByTestId("patient-offers-list");

    constructor(page: Page) {
        super(page);
        this.url = "/patient/appointments";
    }

    appointmentByStatus(status: AppointmentStatus) {
        const labels: Record<AppointmentStatus, string> = {
            pending: "Waiting on clinic",
            confirmed: "Confirmed",
            cancelled: "Cancelled",
            rejected: "Rejected",
        };
        return this.appointmentsList.getByText(labels[status]);
    }

    waitlistItem() { return this.waitlistList.getByTestId("patient-waitlist-item"); }
    waitlistLeaveButton() { return this.waitlistList.getByTestId("patient-waitlist-leave"); }
    offerItem() { return this.offersList.getByTestId("patient-offer-item"); }
    offerAcceptButton() { return this.offersList.getByTestId("patient-offer-accept").first(); }
    offerDeclineButton() { return this.offersList.getByTestId("patient-offer-decline").first(); }
}
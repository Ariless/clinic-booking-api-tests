import { Page } from "@playwright/test";
import { BasePage } from "./BasePage";

type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "rejected" | "completed";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
    pending: "Waiting on clinic",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    rejected: "Rejected",
    completed: "Completed",
};

export class AppointmentsPage extends BasePage {
    readonly appointmentsList = this.page.getByTestId("patient-appt-list");
    readonly errorBanner = this.page.getByTestId("patient-appt-banner");
    readonly cancelButton = this.page.getByTestId("patient-appt-cancel").first();
    readonly waitlistSection = this.page.getByTestId("patient-waitlist-section");
    readonly waitlistList = this.page.getByTestId("patient-waitlist-list");
    readonly offersSection = this.page.getByTestId("patient-offers-section");
    readonly offersList = this.page.getByTestId("patient-offers-list");
    readonly toastSuccess = this.page.locator(".toast.toast--success");
    readonly pagination = this.page.getByTestId("patient-appt-pagination");
    readonly pageInfo = this.page.getByTestId("patient-appt-page-info");
    readonly prevPageButton = this.page.getByTestId("patient-appt-prev-page");
    readonly nextPageButton = this.page.getByTestId("patient-appt-next-page");
    readonly pageSizeSelect = this.page.getByTestId("patient-appt-page-size");

    constructor(page: Page) {
        super(page);
        this.url = "/patient/appointments";
    }

    appointmentByStatus(status: AppointmentStatus) {
        return this.appointmentsList.getByText(STATUS_LABELS[status]);
    }

    badgeByStatus(status: AppointmentStatus) {
        return this.appointmentsList
            .locator('[data-qa="status-badge"]')
            .filter({ hasText: STATUS_LABELS[status] });
    }

    waitlistItem() { return this.waitlistList.getByTestId("patient-waitlist-item"); }
    waitlistLeaveButton() { return this.waitlistList.getByTestId("patient-waitlist-leave"); }
    offerItem() { return this.offersList.getByTestId("patient-offer-item"); }
    offerAcceptButton() { return this.offersList.getByTestId("patient-offer-accept").first(); }
    offerDeclineButton() { return this.offersList.getByTestId("patient-offer-decline").first(); }
}
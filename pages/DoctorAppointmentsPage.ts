import { Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class DoctorAppointmentsPage extends BasePage {
    readonly appointmentsList = this.page.getByTestId("doctor-appt-list");
    readonly toastSuccess = this.page.locator(".toast.toast--success");
    readonly wsStatus = this.page.locator("[data-qa='doctor-ws-status']");
    readonly wsToast = this.page.locator("[data-qa='doctor-ws-toast']");
    readonly pagination = this.page.getByTestId("doctor-appt-pagination");
    readonly pageInfo = this.page.getByTestId("doctor-appt-page-info");
    readonly prevPageButton = this.page.getByTestId("doctor-appt-prev-page");
    readonly nextPageButton = this.page.getByTestId("doctor-appt-next-page");
    readonly pageSizeSelect = this.page.getByTestId("doctor-appt-page-size");

    constructor(page: Page) {
        super(page);
        this.url = "/doctor/appointments";
    }

    async waitForConnection() {
        await this.page.waitForSelector("[data-qa='doctor-ws-status'][data-qa-ws='connected']", { state: "attached" });
    }

    confirmButton(apptId: number | string) {
        return this.page.locator(`[data-qa="doctor-appt-confirm"][data-appt-id="${apptId}"]`);
    }
}
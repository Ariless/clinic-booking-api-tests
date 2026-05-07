const BasePage = require("./BasePage");

class DoctorAppointmentsPage extends BasePage {
    constructor(page) {
        super(page);
        this.url = "/doctor/appointments";
        this.appointmentsList = page.getByTestId("doctor-appt-list");
        this.bannerSuccess = page.getByTestId("doctor-appt-banner-success");
        this.wsStatus = page.locator("[data-qa='doctor-ws-status']");
        this.wsToast = page.locator("[data-qa='doctor-ws-toast']");
    }

    async open() {
        await this.navigate(this.url);
    }

    async waitForConnection() {
        await this.page.waitForSelector("[data-qa='doctor-ws-status'][data-qa-ws='connected']", { state: "attached" });
    }

    confirmButton(apptId) {
        return this.page.locator(`[data-qa="doctor-appt-confirm"][data-appt-id="${apptId}"]`);
    }
}

module.exports = { DoctorAppointmentsPage };

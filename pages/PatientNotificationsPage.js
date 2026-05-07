const BasePage = require("./BasePage");

class PatientNotificationsPage extends BasePage {
    constructor(page) {
        super(page);
        this.url = "/patient/notifications";
        this.guestGate = page.getByTestId("patient-notif-guest-gate");
        this.section = page.getByTestId("patient-notif-section");
        this.wsStatus = page.getByTestId("patient-notif-ws-status");
        this.notifList = page.getByTestId("patient-notif-list");
        this.emptyState = page.getByTestId("patient-notif-empty");
    }

    async open() {
        await this.navigate(this.url);
    }

    async waitForConnection() {
        await this.wsStatus.and(this.page.locator("[data-qa-ws='connected']")).waitFor();
    }

    notifItem(event) {
        return this.page.locator(`[data-qa="patient-notif-item"][data-event="${event}"]`);
    }
}

module.exports = { PatientNotificationsPage };

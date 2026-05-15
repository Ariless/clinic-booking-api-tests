import { Page } from "@playwright/test";
  import { BasePage } from "./BasePage";

  export class PatientNotificationsPage extends BasePage {
    readonly guestGate = this.page.getByTestId("patient-notif-guest-gate");
    readonly section = this.page.getByTestId("patient-notif-section");
    readonly wsStatus = this.page.getByTestId("patient-notif-ws-status");
    readonly notifList = this.page.getByTestId("patient-notif-list");

    constructor(page: Page) {
      super(page);
      this.url = "/patient/notifications";
    }

    async waitForConnection() {
      await this.wsStatus.and(this.page.locator("[data-qa-ws='connected']")).waitFor();
    }

    notifItem(event: string) {
      return this.page.locator(`[data-qa="patient-notif-item"][data-event="${event}"]`);
    }
  }
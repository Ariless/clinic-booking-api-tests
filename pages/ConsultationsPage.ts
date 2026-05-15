import { Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class ConsultationsPage extends BasePage {
    readonly guestGate = this.page.getByTestId("patient-consult-guest-gate");
    readonly section = this.page.getByTestId("patient-consult-section");
    readonly doctorSelect = this.page.getByTestId("patient-consult-doctor-select");
    readonly paymentMethodInput = this.page.getByTestId("patient-consult-payment-method");
    readonly submitButton = this.page.getByTestId("patient-consult-submit");
    readonly bannerSuccess = this.page.getByTestId("patient-consult-banner-success");
    readonly bannerError = this.page.getByTestId("patient-consult-banner-error");
    readonly consultList = this.page.getByTestId("patient-consult-list");
    readonly emptyState = this.page.getByTestId("patient-consult-empty");
    constructor(page: Page) {
        super(page);
        this.url = "/patient/consultations";
    }

    async bookConsultation(doctorId: number, paymentMethod: string) {
        await this.doctorSelect.selectOption(String(doctorId));
        await this.paymentMethodInput.fill(paymentMethod);
        await this.submitButton.click();
    }
}
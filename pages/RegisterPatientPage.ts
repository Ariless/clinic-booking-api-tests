import { Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class RegisterPage extends BasePage {
    readonly patientName = this.page.getByTestId("register-patient-name");
    readonly patientEmail = this.page.getByTestId("register-patient-email");
    readonly patientPassword = this.page.getByTestId("register-patient-password");
    readonly submitPatientButton = this.page.getByTestId("register-patient-submit");
    readonly submitErrorMessage = this.page.getByTestId("register-patient-error");

    constructor(page: Page) {
        super(page);
        this.url = "/register/patient";
    }

    async submitForm(name: string, email: string, password: string) {
        await this.navigate(this.url);
        await this.patientName.fill(name);
        await this.patientEmail.fill(email);
        await this.patientPassword.fill(password);
        await this.submitPatientButton.click();
    }
}
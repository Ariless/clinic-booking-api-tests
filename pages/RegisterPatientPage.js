const BasePage = require("./BasePage");

class RegisterPage extends BasePage {
    constructor(page) {
        super(page);
        this.url = "/register/patient";
        this.patientName = page.getByTestId("register-patient-name");
        this.patientEmail = page.getByTestId("register-patient-email");
        this.patientPassword = page.getByTestId("register-patient-password");
        this.submitPatientButton = page.getByTestId("register-patient-submit");
        this.submitErrorMessage = page.getByTestId("register-patient-error");
    }

    async submitForm(name, email, password) {
        await this.navigate(this.url);
        await this.patientName.fill(name);
        await this.patientEmail.fill(email);
        await this.patientPassword.fill(password);
        await this.submitPatientButton.click();
    }
}

module.exports = { RegisterPage };
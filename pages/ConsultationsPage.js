const BasePage = require("./BasePage");

class ConsultationsPage extends BasePage {
    constructor(page) {
        super(page);
        this.url = "/patient/consultations";
        this.guestGate = page.getByTestId("patient-consult-guest-gate");
        this.section = page.getByTestId("patient-consult-section");
        this.doctorSelect = page.getByTestId("patient-consult-doctor-select");
        this.paymentMethodInput = page.getByTestId("patient-consult-payment-method");
        this.submitButton = page.getByTestId("patient-consult-submit");
        this.bannerSuccess = page.getByTestId("patient-consult-banner-success");
        this.bannerError = page.getByTestId("patient-consult-banner-error");
        this.consultList = page.getByTestId("patient-consult-list");
        this.emptyState = page.getByTestId("patient-consult-empty");
    }

    async open() {
        await this.navigate(this.url);
    }

    async bookConsultation(doctorId, paymentMethod) {
        await this.doctorSelect.selectOption(String(doctorId));
        await this.paymentMethodInput.fill(paymentMethod);
        await this.submitButton.click();
    }
}

module.exports = { ConsultationsPage };

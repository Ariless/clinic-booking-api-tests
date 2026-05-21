import { Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class BookingPage extends BasePage {
    // Step 1 selectors
    readonly bookingDoctorWrap = this.page.getByTestId("booking-doctors-wrap");
    readonly bookingSpeciality = this.page.getByTestId("booking-specialty");

    // Step 2 selectors
    readonly bookingDoctor = this.page.getByTestId("booking-doctor");

    // Step 3 selectors
    readonly bookingSlotPicker = this.page.getByTestId("booking-slot-pickers");
    readonly bookingDaySlot = this.page.getByTestId("booking-slot-day");
    readonly bookingTimeSlot = this.page.getByTestId("booking-slot-time");

    // Step 4 selectors
    readonly submitBookingButton = this.page.getByTestId("booking-submit");
    readonly bookingSuccessMessage = this.page.getByTestId("booking-success-message");
    readonly bookingFormMessage = this.page.getByTestId("booking-form-message");
    readonly bookingGuestGate = this.page.getByTestId("booking-guest-gate");
    readonly bookingGuestLogin = this.page.getByTestId("booking-guest-login");

    // Shared
    readonly bookingErrorBanner = this.page.getByTestId("booking-banner-error");
    readonly wizardSummary = this.page.getByTestId("wizard-summary");

    // Progress indicator
    readonly wizardStepLabel = this.page.locator('[data-qa="wizard-step-label"]');
    readonly wizardDot1 = this.page.locator('[data-qa="wizard-dot-1"]');
    readonly wizardDot2 = this.page.locator('[data-qa="wizard-dot-2"]');
    readonly wizardDot3 = this.page.locator('[data-qa="wizard-dot-3"]');
    readonly wizardDot4 = this.page.locator('[data-qa="wizard-dot-4"]');

    // Step sections
    readonly wizardStep1 = this.page.locator('[data-qa="wizard-step-1"]');
    readonly wizardStep2 = this.page.locator('[data-qa="wizard-step-2"]');
    readonly wizardStep3 = this.page.locator('[data-qa="wizard-step-3"]');
    readonly wizardStep4 = this.page.locator('[data-qa="wizard-step-4"]');

    // Scoped next/back buttons per step (multiple wizard-next elements exist in DOM)
    readonly step1Next = this.page.locator('[data-qa="wizard-step-1"] [data-qa="wizard-next"]');
    readonly step2Next = this.page.locator('[data-qa="wizard-step-2"] [data-qa="wizard-next"]');
    readonly step2Back = this.page.locator('[data-qa="wizard-step-2"] [data-qa="wizard-back"]');
    readonly step3Next = this.page.locator('[data-qa="wizard-step-3"] [data-qa="wizard-next"]');
    readonly step3Back = this.page.locator('[data-qa="wizard-step-3"] [data-qa="wizard-back"]');
    readonly step4Back = this.page.locator('[data-qa="wizard-step-4"] [data-qa="wizard-back"]');

    constructor(page: Page) {
        super(page);
        this.url = "/patient/booking";
    }

    async open() {
        await Promise.all([
            this.page.waitForResponse((res) => res.url().includes("/api/v1/doctors") && res.status() === 200),
            this.navigate(this.url),
        ]);
    }

    async openAtStep(step: number, params: { specialty?: string; doctorId?: string; slotId?: string } = {}) {
        const qs = new URLSearchParams({ step: String(step) });
        if (params.specialty) qs.set("specialty", params.specialty);
        if (params.doctorId) qs.set("doctorId", params.doctorId);
        if (params.slotId) qs.set("slotId", params.slotId);
        await this.navigate(`${this.url}?${qs}`);
    }

    /** Navigate through all 4 wizard steps and return the selected slot ID. */
    async walkWizard(specialty: string, doctorName: string): Promise<string> {
        await this.open();

        await this.bookingSpeciality.selectOption(specialty);
        // Register listeners before click — navigation fires the response before Promise.all resolves
        await Promise.all([
            this.page.waitForURL(/step=2/),
            this.page.waitForResponse((r) => r.url().includes("/api/v1/doctors") && r.status() === 200),
            this.step1Next.click(),
        ]);

        // Wait for doctor options to be populated from the API response
        await this.page.waitForFunction(() => {
            const sel = document.querySelector('[data-qa="booking-doctor"]') as HTMLSelectElement | null;
            return sel !== null && sel.options.length > 1;
        });
        await this.bookingDoctor.selectOption(doctorName);
        await Promise.all([
            this.page.waitForURL(/step=3/),
            this.page.waitForResponse((r) => r.url().includes("/slots") && r.status() === 200),
            this.step2Next.click(),
        ]);

        await this.bookingSlotPicker.waitFor({ state: "visible" });
        const firstTime = await this.bookingTimeSlot.locator("option").nth(1).getAttribute("value");
        await this.bookingTimeSlot.selectOption(firstTime!);
        await Promise.all([
            this.page.waitForURL(/step=4/),
            this.step3Next.click(),
        ]);

        await this.submitBookingButton.waitFor({ state: "visible" });
        return firstTime!;
    }
}

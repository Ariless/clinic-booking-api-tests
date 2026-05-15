import { Page } from "@playwright/test";
import { BasePage } from "./BasePage";

export class LoginPage extends BasePage {
    readonly emailInput = this.page.getByTestId("login-email");
    readonly passwordInput = this.page.getByTestId("login-password");
    readonly loginButton = this.page.getByTestId("login-submit");
    readonly errorMessage = this.page.getByTestId("login-error");

    constructor(page: Page) {
        super(page);
        this.url = "/login";
    }

    async submitForm(email: string, password: string) {
        await this.navigate(this.url);
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.loginButton.click();
    }

    async login(email: string, password: string) {
        await this.navigate(this.url);
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await Promise.all([
            this.page.waitForResponse(
                (res) => res.url().includes("/api/v1/auth/login") && res.request().method() === "POST"
            ),
            this.loginButton.click(),
        ]);
        await this.page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
    }
}
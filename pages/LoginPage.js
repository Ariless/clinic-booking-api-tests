const BasePage = require("./BasePage");

class LoginPage extends BasePage {
    constructor(page) {
        super(page);
        this.url = "/login";
        this.emailInput = page.getByTestId("login-email");
        this.passwordInput = page.getByTestId("login-password");
        this.loginButton = page.getByTestId("login-submit");
    }

    async login(email, password) {
        await this.navigate(this.url);
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await Promise.all([
            this.page.waitForResponse(
                (res) =>
                    res.url().includes("/api/v1/auth/login") &&
                    res.request().method() === "POST"
            ),
            this.loginButton.click(),
        ]);
        await this.page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
    }
}

module.exports = { LoginPage };

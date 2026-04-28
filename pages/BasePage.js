class BasePage {
    constructor(page) {
        this.page = page;
    }

    async navigate(path) {
        await this.page.goto(path);
        await this.dismissCookies();
    }

    async dismissCookies() {
        // Clinic demo — no cookie consent wall; kept for parity with the older shop framework (`BasePage`).
    }

    async getTitle() {
        return this.page.title();
    }

    async open() {
        await this.navigate(this.url);
    }
}

module.exports = BasePage;

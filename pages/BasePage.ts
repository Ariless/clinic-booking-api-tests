import { Page } from "@playwright/test";

export class BasePage {
    protected readonly page: Page;
    protected url: string = "";

    constructor(page: Page) {
        this.page = page;
    }

    async navigate(path: string) {
        await this.page.goto(path);
        await this.dismissCookies();
    }

    async dismissCookies() {
        // Clinic demo — no cookie consent wall; kept for parity with the older shop framework.
    }

    async getTitle() {
        return this.page.title();
    }

    async open() {
        await this.navigate(this.url);
    }
}
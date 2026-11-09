import { Page } from "@playwright/test";

export class BasePage {
    protected readonly page: Page;
    protected url: string = "";

    constructor(page: Page) {
        this.page = page;
    }

    async navigate(path: string) {
        await this.page.goto(path);
    }

    async getTitle() {
        return this.page.title();
    }

    async open() {
        await this.navigate(this.url);
    }
}
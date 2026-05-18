import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { AppointmentsPage } from "../../pages/AppointmentsPage";

function mockAppt(id: number) {
    return { id, slotId: id + 100, patientId: 1, status: "pending" };
}

function paginatedBody(items: ReturnType<typeof mockAppt>[], page: number, limit: number, total: number) {
    return JSON.stringify({
        data: items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    });
}

test("patient appointments — pagination hidden when all visits fit on one page @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([mockAppt(1)], 1, 20, 1),
            }),
        );

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        await expect(appointmentsPage.pagination).not.toBeVisible();
    },
);

test("patient appointments — pagination controls visible when multiple pages exist @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([mockAppt(1)], 1, 20, 25),
            }),
        );

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        await expect(appointmentsPage.pagination).toBeVisible();
        await expect(appointmentsPage.pageInfo).toHaveText("Page 1 of 2");
    },
);

test("patient appointments — previous button disabled on first page, next enabled @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([mockAppt(1)], 1, 20, 45),
            }),
        );

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        await expect(appointmentsPage.prevPageButton).toBeDisabled();
        await expect(appointmentsPage.nextPageButton).toBeEnabled();
    },
);

test("patient appointments — next page button requests page 2 and updates page info @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        await page.route("**/api/v1/appointments/my**", (route) => {
            const url = new URL(route.request().url());
            const pg = parseInt(url.searchParams.get("page") ?? "1", 10);
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([mockAppt(pg)], pg, 20, 25),
            });
        });

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        await expect(appointmentsPage.pageInfo).toHaveText("Page 1 of 2");

        const [nextRequest] = await Promise.all([
            page.waitForRequest((r) => r.url().includes("page=2")),
            appointmentsPage.nextPageButton.click(),
        ]);

        expect(nextRequest.url()).toContain("page=2");
        await expect(appointmentsPage.pageInfo).toHaveText("Page 2 of 2");
        await expect(appointmentsPage.nextPageButton).toBeDisabled();
        await expect(appointmentsPage.prevPageButton).toBeEnabled();
    },
);

test("patient appointments — page size change resets to page 1 and uses new limit @ui",
    async ({ page, user }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(user.email, user.password);

        let callCount = 0;
        await page.route("**/api/v1/appointments/my**", (route) => {
            callCount++;
            const url = new URL(route.request().url());
            const pg = parseInt(url.searchParams.get("page") ?? "1", 10);
            const lim = parseInt(url.searchParams.get("limit") ?? "20", 10);
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([mockAppt(1)], pg, lim, 30),
            });
        });

        const appointmentsPage = new AppointmentsPage(page);
        await appointmentsPage.open();

        // navigate to page 2
        await appointmentsPage.nextPageButton.click();
        await expect(appointmentsPage.pageInfo).toHaveText("Page 2 of 2");

        // change page size → should reset to page 1 with new limit
        const [sizeRequest] = await Promise.all([
            page.waitForRequest((r) => r.url().includes("limit=5") && r.url().includes("page=1")),
            appointmentsPage.pageSizeSelect.selectOption("5"),
        ]);

        expect(sizeRequest.url()).toContain("limit=5");
        expect(sizeRequest.url()).toContain("page=1");
        await expect(appointmentsPage.pageInfo).toHaveText("Page 1 of 6");
    },
);

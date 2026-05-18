import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { DoctorAppointmentsPage } from "../../pages/DoctorAppointmentsPage";

function mockAppt(id: number) {
    return { id, slotId: id + 100, patientId: 1, status: "pending", slotStartTime: null };
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

test("doctor appointments — pagination hidden when all requests fit on one page @ui",
    async ({ page, slot }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);

        await page.route("**/api/v1/appointments/doctor**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([mockAppt(1)], 1, 20, 1),
            }),
        );

        const doctorPage = new DoctorAppointmentsPage(page);
        await doctorPage.open();

        await expect(doctorPage.pagination).not.toBeVisible();
    },
);

test("doctor appointments — pagination controls visible when multiple pages exist @ui",
    async ({ page, slot }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);

        await page.route("**/api/v1/appointments/doctor**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([mockAppt(1)], 1, 20, 25),
            }),
        );

        const doctorPage = new DoctorAppointmentsPage(page);
        await doctorPage.open();

        await expect(doctorPage.pagination).toBeVisible();
        await expect(doctorPage.pageInfo).toHaveText("Page 1 of 2");
    },
);

test("doctor appointments — previous button disabled on first page, next enabled @ui",
    async ({ page, slot }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);

        await page.route("**/api/v1/appointments/doctor**", (route) =>
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([mockAppt(1)], 1, 20, 45),
            }),
        );

        const doctorPage = new DoctorAppointmentsPage(page);
        await doctorPage.open();

        await expect(doctorPage.prevPageButton).toBeDisabled();
        await expect(doctorPage.nextPageButton).toBeEnabled();
    },
);

test("doctor appointments — next page button requests page 2 and updates page info @ui",
    async ({ page, slot }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);

        await page.route("**/api/v1/appointments/doctor**", (route) => {
            const url = new URL(route.request().url());
            const pg = parseInt(url.searchParams.get("page") ?? "1", 10);
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([mockAppt(pg)], pg, 20, 25),
            });
        });

        const doctorPage = new DoctorAppointmentsPage(page);
        await doctorPage.open();

        await expect(doctorPage.pageInfo).toHaveText("Page 1 of 2");

        const [nextRequest] = await Promise.all([
            page.waitForRequest((r) => r.url().includes("page=2")),
            doctorPage.nextPageButton.click(),
        ]);

        expect(nextRequest.url()).toContain("page=2");
        await expect(doctorPage.pageInfo).toHaveText("Page 2 of 2");
        await expect(doctorPage.nextPageButton).toBeDisabled();
        await expect(doctorPage.prevPageButton).toBeEnabled();
    },
);

test("doctor appointments — page size change resets to page 1 and uses new limit @ui",
    async ({ page, slot }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);

        await page.route("**/api/v1/appointments/doctor**", (route) => {
            const url = new URL(route.request().url());
            const pg = parseInt(url.searchParams.get("page") ?? "1", 10);
            const lim = parseInt(url.searchParams.get("limit") ?? "20", 10);
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: paginatedBody([mockAppt(1)], pg, lim, 30),
            });
        });

        const doctorPage = new DoctorAppointmentsPage(page);
        await doctorPage.open();

        await doctorPage.nextPageButton.click();
        await expect(doctorPage.pageInfo).toHaveText("Page 2 of 2");

        const [sizeRequest] = await Promise.all([
            page.waitForRequest((r) => r.url().includes("limit=5") && r.url().includes("page=1")),
            doctorPage.pageSizeSelect.selectOption("5"),
        ]);

        expect(sizeRequest.url()).toContain("limit=5");
        expect(sizeRequest.url()).toContain("page=1");
        await expect(doctorPage.pageInfo).toHaveText("Page 1 of 6");
    },
);

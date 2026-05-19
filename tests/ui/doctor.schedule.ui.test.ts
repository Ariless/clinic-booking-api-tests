import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { DoctorsClient } from "../../api/DoctorsClient";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

test.describe("doctor schedule — working hours @ui", () => {
    test.beforeEach(async ({ request, slot }) => {
        // clear schedule before each test so state is predictable
        const doctors = new DoctorsClient(request);
        await doctors.setSchedule([], {
            headers: { Authorization: `Bearer ${slot.doctorToken}` },
        });
    });

    test.afterEach(async ({ request, slot }) => {
        // restore to empty schedule after each test
        const doctors = new DoctorsClient(request);
        await doctors.setSchedule([], {
            headers: { Authorization: `Bearer ${slot.doctorToken}` },
        });
    });

    test("doctor schedule — working hours form shows all 7 days @ui", async ({ page, slot }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);
        await page.goto("/doctor/schedule");

        for (let d = 0; d < 7; d++) {
            await expect(page.getByTestId(`doctor-wh-day-${d}-enabled`)).toBeVisible();
            await expect(page.getByTestId(`doctor-wh-day-${d}-start`)).toBeVisible();
            await expect(page.getByTestId(`doctor-wh-day-${d}-end`)).toBeVisible();
        }
    });

    test("doctor schedule — checking day enables time inputs @ui", async ({ page, slot }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);
        await page.goto("/doctor/schedule");

        const cb = page.getByTestId("doctor-wh-day-0-enabled");
        const startInput = page.getByTestId("doctor-wh-day-0-start");
        const endInput = page.getByTestId("doctor-wh-day-0-end");

        await expect(startInput).toBeDisabled();
        await expect(endInput).toBeDisabled();

        await cb.check();

        await expect(startInput).toBeEnabled();
        await expect(endInput).toBeEnabled();
    });

    test("doctor schedule — save schedule shows success message @ui", async ({ page, slot }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);
        await page.goto("/doctor/schedule");

        await page.getByTestId("doctor-wh-day-1-enabled").check(); // Tuesday
        await page.getByTestId("doctor-wh-day-1-start").fill("09:00");
        await page.getByTestId("doctor-wh-day-1-end").fill("17:00");

        await page.getByTestId("doctor-wh-submit").click();

        await expect(page.getByTestId("doctor-wh-success")).toBeVisible();
        await expect(page.getByTestId("doctor-wh-success")).toContainText("saved");
    });

    test("doctor schedule — saved schedule loads into form on page open @ui", async ({ page, request, slot }) => {
        const doctors = new DoctorsClient(request);
        await doctors.setSchedule(
            [{ dayOfWeek: 3, startTime: "10:00", endTime: "15:00" }], // Thursday
            { headers: { Authorization: `Bearer ${slot.doctorToken}` } },
        );

        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);
        await page.goto("/doctor/schedule");

        // Thursday checkbox checked, time inputs populated
        await expect(page.getByTestId("doctor-wh-day-3-enabled")).toBeChecked();
        await expect(page.getByTestId("doctor-wh-day-3-start")).toHaveValue("10:00");
        await expect(page.getByTestId("doctor-wh-day-3-end")).toHaveValue("15:00");

        // Other days unchecked
        await expect(page.getByTestId("doctor-wh-day-0-enabled")).not.toBeChecked();
    });

    test("doctor schedule — slot outside working hours shows error in create form @ui", async ({ page, request, slot }) => {
        const doctors = new DoctorsClient(request);
        // schedule: all days 14:00–17:00 UTC only
        await doctors.setSchedule(
            [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: "14:00", endTime: "17:00" })),
            { headers: { Authorization: `Bearer ${slot.doctorToken}` } },
        );

        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);
        await page.goto("/doctor/schedule");

        // Try to create a slot at 10:00–11:00 UTC — outside 14:00–17:00
        const tomorrow = new Date();
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
        const dateStr = tomorrow.toISOString().slice(0, 10);

        await page.getByTestId("doctor-schedule-slot-date").fill(dateStr);
        await page.getByTestId("doctor-schedule-slot-start").fill("10:00");
        await page.getByTestId("doctor-schedule-slot-end").fill("11:00");

        await page.getByTestId("doctor-schedule-create-submit").click();

        await expect(page.getByTestId("doctor-schedule-create-message")).toBeVisible();
        await expect(page.getByTestId("doctor-schedule-create-message")).toContainText("outside");
    });
});

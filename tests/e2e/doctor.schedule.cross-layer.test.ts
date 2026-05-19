import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { DoctorsClient } from "../../api/DoctorsClient";
import { dbClient } from "../../utils/dbClient";

test.describe("doctor schedule — cross-layer @e2e", () => {
    test.afterEach(async ({ request, slot }) => {
        const doctors = new DoctorsClient(request);
        await doctors.setSchedule([], { headers: { Authorization: `Bearer ${slot.doctorToken}` } });
    });

    test("doctor schedule — set working hours via UI → schedule confirmed via API and DB @e2e", async ({ page, request, slot }) => {
        const loginPage = new LoginPage(page);
        await loginPage.login(slot.doctor.email, slot.doctor.password);
        await page.goto("/doctor/schedule");

        // Set Wednesday (dayOfWeek=2) 10:00–14:00 via UI
        await page.getByTestId("doctor-wh-day-2-enabled").check();
        await page.getByTestId("doctor-wh-day-2-start").fill("10:00");
        await page.getByTestId("doctor-wh-day-2-end").fill("14:00");

        await Promise.all([
            page.waitForResponse((r) => r.url().includes("/doctors/me/schedule") && r.request().method() === "PUT"),
            page.getByTestId("doctor-wh-submit").click(),
        ]);

        await expect(page.getByTestId("doctor-wh-success")).toBeVisible();

        // Verify via API
        const doctors = new DoctorsClient(request);
        const { status, body } = await doctors.getSchedule(slot.doctor.doctorRecordId);
        expect(status).toBe(200);
        const entry = body.schedule.find((s: { dayOfWeek: number }) => s.dayOfWeek === 2);
        expect(entry).toBeDefined();
        expect(entry.startTime).toBe("10:00");
        expect(entry.endTime).toBe("14:00");

        // Verify via DB
        const rows = dbClient.getScheduleByDoctorId(slot.doctor.doctorRecordId);
        const dbEntry = rows.find((r) => r.dayOfWeek === 2);
        expect(dbEntry).toBeDefined();
        expect(dbEntry!.startTime).toBe("10:00");
        expect(dbEntry!.endTime).toBe("14:00");
    });
});

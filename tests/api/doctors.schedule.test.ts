import { test, expect } from "../../fixtures";
import { DoctorsClient } from "../../api/DoctorsClient";
import { AuthClient } from "../../api/AuthClient";
import { seedDoctors } from "../../data/seedAccounts";

type ScheduleEntry = { dayOfWeek: number; startTime: string; endTime: string };

// Returns next occurrence of given UTC day-of-week (0=Mon) at specified UTC hour, +1 week offset to avoid collisions
function slotAt(dayOfWeek: number, startHour: number, endHour: number): { startTime: string; endTime: string } {
    const now = new Date();
    const nowDay = (now.getUTCDay() + 6) % 7;
    let daysUntil = (dayOfWeek - nowDay + 7) % 7;
    if (daysUntil === 0) daysUntil = 7;
    const base = new Date(now);
    base.setUTCDate(base.getUTCDate() + daysUntil + 7); // +7 avoids conflicts with slotFixture
    base.setUTCHours(startHour, 0, 0, 0);
    const end = new Date(base);
    end.setUTCHours(endHour, 0, 0, 0);
    return { startTime: base.toISOString(), endTime: end.toISOString() };
}

// All-week schedule covering the given UTC hours
function weekSchedule(startTime: string, endTime: string): ScheduleEntry[] {
    return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime, endTime }));
}

test.describe("doctor schedule", () => {
    let doctorToken: string;
    let doctors: DoctorsClient;
    const doctor = seedDoctors[0];

    test.beforeEach(async ({ request }) => {
        const auth = new AuthClient(request);
        const { body } = await auth.verifyLogin(doctor.email, doctor.password);
        doctorToken = body.token;
        doctors = new DoctorsClient(request);
        await doctors.setSchedule([], { headers: { Authorization: `Bearer ${doctorToken}` } });
    });

    test.afterAll(async ({ request }) => {
        const auth = new AuthClient(request);
        const { body } = await auth.verifyLogin(doctor.email, doctor.password);
        const token = body.token;
        await new DoctorsClient(request).setSchedule([], { headers: { Authorization: `Bearer ${token}` } });
    });

    test("PUT /doctors/me/schedule — 200 sets weekly schedule @smoke @api", async () => {
        const entries = weekSchedule("09:00", "17:00");
        const { status, body } = await doctors.setSchedule(entries, {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        expect(status).toBe(200);
        expect(body.schedule).toHaveLength(7);
        expect(body.schedule[0]).toMatchObject({ dayOfWeek: 0, startTime: "09:00", endTime: "17:00" });
    });

    test("GET /doctors/:id/schedule — 200 returns persisted schedule @api", async () => {
        const entries: ScheduleEntry[] = [{ dayOfWeek: 1, startTime: "10:00", endTime: "14:00" }];
        await doctors.setSchedule(entries, { headers: { Authorization: `Bearer ${doctorToken}` } });

        const { status, body } = await doctors.getSchedule(doctor.doctorRecordId);
        expect(status).toBe(200);
        expect(body.schedule).toHaveLength(1);
        expect(body.schedule[0]).toMatchObject({ dayOfWeek: 1, startTime: "10:00", endTime: "14:00" });
    });

    test("POST /doctors/me/slots — 201 slot within working hours @api", async ({ request }) => {
        await doctors.setSchedule(weekSchedule("09:00", "18:00"), {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
        const { startTime, endTime } = slotAt(1, 10, 11); // Tuesday 10:00–11:00 UTC
        const { status, body } = await doctors.createSlot(
            doctor.doctorRecordId, startTime, endTime, true,
            doctorAuth,
        );
        expect(status).toBe(201);
        await doctors.deleteSlot((body as { id: number }).id, doctorAuth);
    });

    test("POST /doctors/me/slots — 422 OUTSIDE_WORKING_HOURS slot outside schedule hours @api", async () => {
        await doctors.setSchedule(weekSchedule("09:00", "12:00"), {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        const { startTime, endTime } = slotAt(1, 13, 14); // Tuesday 13:00–14:00 UTC — after 12:00
        const { status, body } = await doctors.createSlot(
            doctor.doctorRecordId, startTime, endTime, true,
            { headers: { Authorization: `Bearer ${doctorToken}` } },
        );
        expect(status).toBe(422);
        expect(body.errorCode).toBe("OUTSIDE_WORKING_HOURS");
    });

    test("POST /doctors/me/slots — 422 OUTSIDE_WORKING_HOURS slot on day not in schedule @api", async () => {
        // only Monday in schedule
        await doctors.setSchedule([{ dayOfWeek: 0, startTime: "09:00", endTime: "17:00" }], {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        const { startTime, endTime } = slotAt(2, 10, 11); // Wednesday — not in schedule
        const { status, body } = await doctors.createSlot(
            doctor.doctorRecordId, startTime, endTime, true,
            { headers: { Authorization: `Bearer ${doctorToken}` } },
        );
        expect(status).toBe(422);
        expect(body.errorCode).toBe("OUTSIDE_WORKING_HOURS");
    });

    test("POST /doctors/me/slots — 201 slot at exact boundary start (09:00–10:00) @api", async () => {
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
        await doctors.setSchedule(weekSchedule("09:00", "17:00"), doctorAuth);
        const { startTime, endTime } = slotAt(3, 9, 10); // Wednesday 09:00–10:00 — boundary start
        const { status, body } = await doctors.createSlot(
            doctor.doctorRecordId, startTime, endTime, true,
            doctorAuth,
        );
        expect(status).toBe(201);
        await doctors.deleteSlot((body as { id: number }).id, doctorAuth);
    });

    test("POST /doctors/me/slots — 201 slot at exact boundary end (16:00–17:00) @api", async () => {
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
        await doctors.setSchedule(weekSchedule("09:00", "17:00"), doctorAuth);
        const { startTime, endTime } = slotAt(3, 16, 17); // Wednesday 16:00–17:00 — boundary end
        const { status, body } = await doctors.createSlot(
            doctor.doctorRecordId, startTime, endTime, true,
            doctorAuth,
        );
        expect(status).toBe(201);
        await doctors.deleteSlot((body as { id: number }).id, doctorAuth);
    });

    test("POST /doctors/me/slots — 422 OUTSIDE_WORKING_HOURS slot ends after schedule (16:00–18:00) @api", async () => {
        await doctors.setSchedule(weekSchedule("09:00", "17:00"), {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        const { startTime, endTime } = slotAt(3, 16, 18); // starts in window but ends outside
        const { status, body } = await doctors.createSlot(
            doctor.doctorRecordId, startTime, endTime, true,
            { headers: { Authorization: `Bearer ${doctorToken}` } },
        );
        expect(status).toBe(422);
        expect(body.errorCode).toBe("OUTSIDE_WORKING_HOURS");
    });

    test("POST /doctors/me/slots — 201 no schedule set → always allowed @api", async () => {
        // schedule cleared in beforeEach
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
        const { startTime, endTime } = slotAt(4, 10, 11);
        const { status, body } = await doctors.createSlot(
            doctor.doctorRecordId, startTime, endTime, true,
            doctorAuth,
        );
        expect(status).toBe(201);
        await doctors.deleteSlot((body as { id: number }).id, doctorAuth);
    });

    test("POST /doctors/me/slots — 422 OUTSIDE_WORKING_HOURS timezone offset resolves to UTC outside hours @api", async () => {
        // schedule: all days 10:00–17:00 UTC
        await doctors.setSchedule(weekSchedule("10:00", "17:00"), {
            headers: { Authorization: `Bearer ${doctorToken}` },
        });
        // slot at "10:00 UTC+5" = 05:00 UTC — outside 10:00–17:00 UTC window
        const base = new Date();
        const nowDay = (base.getUTCDay() + 6) % 7;
        let daysUntil = (1 - nowDay + 7) % 7;
        if (daysUntil === 0) daysUntil = 14;
        base.setUTCDate(base.getUTCDate() + daysUntil + 7);
        base.setUTCHours(5, 0, 0, 0); // 05:00 UTC = 10:00 UTC+5
        const end = new Date(base);
        end.setUTCHours(6, 0, 0, 0);
        // send with explicit +05:00 offset to confirm server validates UTC, not local
        const startTime = base.toISOString().replace("Z", "+05:00");
        const endTime = end.toISOString().replace("Z", "+05:00");

        const { status, body } = await doctors.createSlot(
            doctor.doctorRecordId, startTime, endTime, true,
            { headers: { Authorization: `Bearer ${doctorToken}` } },
        );
        expect(status).toBe(422);
        expect(body.errorCode).toBe("OUTSIDE_WORKING_HOURS");
    });
});

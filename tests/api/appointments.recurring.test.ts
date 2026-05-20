import { APIRequestContext } from "@playwright/test";
import { test, expect } from "../../fixtures/slotFixture";
import { AppointmentsClient } from "../../api/AppointmentsClient";
import { AuthClient } from "../../api/AuthClient";
import { DoctorsClient } from "../../api/DoctorsClient";
import { seedDoctors } from "../../data/seedAccounts";

let recurringSeq = 0;

function nextWeeklySlots(count: number) {
    recurringSeq += 1;
    const baseMs = Date.now() + (30 + recurringSeq) * 86400000;
    const base = new Date(baseMs);
    base.setUTCHours(9, 0, 0, 0);
    return Array.from({ length: count }, (_, i) => ({
        start: new Date(base.getTime() + i * 7 * 86400000).toISOString(),
        end: new Date(base.getTime() + i * 7 * 86400000 + 3600000).toISOString(),
    }));
}

async function createWeeklySlots(
    request: APIRequestContext,
    doctorRecordId: number,
    doctorToken: string,
    count: number,
): Promise<{ slotIds: number[]; cleanup: () => Promise<void> }> {
    const windows = nextWeeklySlots(count);
    const doctors = new DoctorsClient(request);
    const auth = { headers: { Authorization: `Bearer ${doctorToken}` } };
    const slotIds: number[] = [];

    for (const w of windows) {
        const { status, body } = await doctors.createSlot(doctorRecordId, w.start, w.end, true, auth);
        if (status !== 201) throw new Error(`weekly slot creation failed: ${JSON.stringify(body)}`);
        slotIds.push(body.id as number);
    }

    return {
        slotIds,
        cleanup: async () => {
            const appts = new AppointmentsClient(request);
            for (const slotId of slotIds) {
                const { body: doctorAppts } = await appts.listDoctor(auth);
                const active = (Array.isArray(doctorAppts) ? doctorAppts : []).filter(
                    (a: Record<string, unknown>) =>
                        a.slotId === slotId && ["pending", "confirmed"].includes(a.status as string),
                );
                for (const appt of active) {
                    await appts.cancelAsDoctor(appt.id as number, auth);
                }
                await doctors.deleteSlot(slotId, auth);
            }
        },
    };
}

test("POST /api/v1/appointments/recurring — 201 books 2 weekly slots, returns seriesId @api @smoke",
    async ({ request, user, slot }) => {
        const { doctor, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const weekly = await createWeeklySlots(request, doctor.doctorRecordId, doctorToken, 2);
        try {
            const { status, body } = await appointments.bookRecurring(
                weekly.slotIds[0], "weekly", 2, patientAuth,
            );

            expect(status).toBe(201);
            expect(typeof body.seriesId).toBe("string");
            expect(body.bookedCount).toBe(2);
            expect(body.booked).toHaveLength(2);
            expect(body.unavailable).toHaveLength(0);
            for (const appt of body.booked) {
                expect(appt.seriesId).toBe(body.seriesId);
            }

            await appointments.cancelSeries(body.seriesId as string, patientAuth);
        } finally {
            await weekly.cleanup();
        }
    },
);

test("POST /api/v1/appointments/recurring — 201 partial booking when one slot is unavailable @api",
    async ({ request, user, slot }) => {
        const { doctor, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const weekly = await createWeeklySlots(request, doctor.doctorRecordId, doctorToken, 2);
        try {
            // Book the second slot manually so it becomes unavailable
            const { body: taken } = await appointments.createAppointment(weekly.slotIds[1], patientAuth);
            const takenId = (taken as Record<string, unknown>).id as number;

            const { status, body } = await appointments.bookRecurring(
                weekly.slotIds[0], "weekly", 2, patientAuth,
            );

            expect(status).toBe(201);
            expect(body.bookedCount).toBe(1);
            expect(body.booked).toHaveLength(1);
            expect(body.unavailable).toHaveLength(1);
            expect(body.unavailable[0].slotId).toBe(weekly.slotIds[1]);

            await appointments.cancelAppointment(takenId, patientAuth);
            if (body.seriesId) {
                await appointments.cancelSeries(body.seriesId as string, patientAuth);
            }
        } finally {
            await weekly.cleanup();
        }
    },
);

test("POST /api/v1/appointments/recurring — 404 SLOT_NOT_FOUND for non-existent startSlotId @api",
    async ({ request, user }) => {
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status, body } = await appointments.bookRecurring(999999, "weekly", 2, patientAuth);

        expect(status).toBe(404);
        expect(body.errorCode).toBe("SLOT_NOT_FOUND");
    },
);

test("POST /api/v1/appointments/recurring — 400 INVALID_PATTERN for unsupported slotPattern @api",
    async ({ request, user, slot }) => {
        const { slot: slotBody } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status, body } = await appointments.bookRecurring(
            slotBody.id, "daily", 2, patientAuth,
        );

        expect(status).toBe(400);
        expect(body.errorCode).toBe("VALIDATION_ERROR");
    },
);

test("POST /api/v1/appointments/recurring — 400 when count is below minimum (count=1) @api",
    async ({ request, user, slot }) => {
        const { slot: slotBody } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status } = await appointments.bookRecurring(slotBody.id, "weekly", 1, patientAuth);

        expect(status).toBe(400);
    },
);

test("POST /api/v1/appointments/recurring — 400 when count exceeds maximum (count=13) @api",
    async ({ request, user, slot }) => {
        const { slot: slotBody } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status } = await appointments.bookRecurring(slotBody.id, "weekly", 13, patientAuth);

        expect(status).toBe(400);
    },
);

test("POST /api/v1/appointments/recurring — 401 without authentication @api",
    async ({ request }) => {
        const appointments = new AppointmentsClient(request);

        const { status } = await appointments.bookRecurring(1, "weekly", 2);

        expect(status).toBe(401);
    },
);

test("PATCH /api/v1/appointments/series/:seriesId/cancel — 200 cancels series and frees all slots @api @smoke",
    async ({ request, user, slot }) => {
        const { doctor, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const weekly = await createWeeklySlots(request, doctor.doctorRecordId, doctorToken, 2);
        try {
            const { body: booked } = await appointments.bookRecurring(
                weekly.slotIds[0], "weekly", 2, patientAuth,
            );
            const seriesId = booked.seriesId as string;

            const { status, body } = await appointments.cancelSeries(seriesId, patientAuth);

            expect(status).toBe(200);
            expect(body.seriesId).toBe(seriesId);
            expect(body.cancelledCount).toBe(booked.bookedCount);
            expect(body.cancelled).toHaveLength(booked.bookedCount);
            for (const appt of body.cancelled) {
                expect(appt.status).toBe("cancelled");
            }
        } finally {
            await weekly.cleanup();
        }
    },
);

test("PATCH /api/v1/appointments/series/:seriesId/cancel — 404 SERIES_NOT_FOUND for unknown seriesId @api",
    async ({ request, user }) => {
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const { status, body } = await appointments.cancelSeries(
            "00000000-0000-0000-0000-000000000000", patientAuth,
        );

        expect(status).toBe(404);
        expect(body.errorCode).toBe("SERIES_NOT_FOUND");
    },
);

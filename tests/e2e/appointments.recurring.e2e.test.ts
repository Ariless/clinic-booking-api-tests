import { APIRequestContext } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { AppointmentsClient } from "../../api/AppointmentsClient";
import { DoctorsClient } from "../../api/DoctorsClient";
import { dbClient } from "../../utils/dbClient";

let recurringSeq = 0;

function nextWeeklySlots(count: number) {
    recurringSeq += 1;
    const baseMs = Date.now() + (60 + recurringSeq) * 86400000;
    const base = new Date(baseMs);
    base.setUTCHours(10, 0, 0, 0);
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

test("recurring series booked via API — all appointments visible with series tag in patient UI @e2e @smoke",
    async ({ request, page, user, slot, loginPage, appointmentsPage }) => {
        const { doctor, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const weekly = await createWeeklySlots(request, doctor.doctorRecordId, doctorToken, 2);
        try {
            // 1. BOOK recurring series via API
            const { status, body: booked } = await appointments.bookRecurring(
                weekly.slotIds[0], "weekly", 2, patientAuth,
            );
            expect(status).toBe(201);
            const seriesId = booked.seriesId as string;
            const apptIds = (booked.booked as Array<{ id: number }>).map((a) => a.id);

            // 2. LOGIN via UI as patient
            await loginPage.login(user.email, user.password);

            // 3. OPEN appointments page
            await appointmentsPage.open();

            // 4. VERIFY both appointments show series tag in UI
            const tag = `Series ${seriesId.slice(0, 8)}`;
            await expect(appointmentsPage.appointmentsList.getByText(tag)).toHaveCount(2);

            // 5. VERIFY DB — both appointments have the correct seriesId
            for (const id of apptIds) {
                const dbAppt = dbClient.getAppointmentById(id);
                expect(dbAppt, `DB: appointment ${id} must exist`).toBeDefined();
                expect(dbAppt!["seriesId"], `DB: appointment ${id} seriesId`).toBe(seriesId);
            }

            await appointments.cancelSeries(seriesId, patientAuth);
        } finally {
            await weekly.cleanup();
        }
    },
);

test("patient cancels series via UI — all appointments cancelled in API and DB @e2e @smoke",
    async ({ request, page, user, slot, loginPage, appointmentsPage }) => {
        const { doctor, doctorToken } = slot;
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const appointments = new AppointmentsClient(request);

        const weekly = await createWeeklySlots(request, doctor.doctorRecordId, doctorToken, 2);
        try {
            // 1. BOOK recurring series via API
            const { status, body: booked } = await appointments.bookRecurring(
                weekly.slotIds[0], "weekly", 2, patientAuth,
            );
            expect(status).toBe(201);
            const seriesId = booked.seriesId as string;
            const apptIds = (booked.booked as Array<{ id: number }>).map((a) => a.id);

            // 2. LOGIN via UI as patient
            await loginPage.login(user.email, user.password);

            // 3. OPEN appointments page
            await appointmentsPage.open();

            // 4. CANCEL series via UI — accept confirm dialog and click the button
            page.once("dialog", (dialog) => dialog.accept());
            await page.locator('[data-qa="patient-appt-cancel-series"]').first().click();

            // 5. VERIFY success toast
            await expect(appointmentsPage.toastSuccess).toBeVisible();
            await expect(appointmentsPage.toastSuccess).toHaveText("Series cancelled.");

            // 6. VERIFY cross-layer — all appointments have status "cancelled" in API
            const { status: listStatus, body: listBody } = await appointments.listMy(patientAuth);
            expect(listStatus).toBe(200);
            for (const id of apptIds) {
                const appt = (listBody as Array<{ id: number; status: string }>).find((a) => a.id === id);
                expect(appt?.status, `API: appointment ${id} must be cancelled`).toBe("cancelled");
            }

            // 7. VERIFY DB — both appointments physically cancelled
            for (const id of apptIds) {
                const dbAppt = dbClient.getAppointmentById(id);
                expect(dbAppt, `DB: appointment ${id} must exist`).toBeDefined();
                expect(dbAppt!.status, `DB: appointment ${id} must be cancelled`).toBe("cancelled");
            }
        } finally {
            await weekly.cleanup();
        }
    },
);

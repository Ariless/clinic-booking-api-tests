import { test as base, expect } from "./userFixture";
import { AuthClient } from "../api/AuthClient";
import { DoctorsClient } from "../api/DoctorsClient";
import { AppointmentsClient } from "../api/AppointmentsClient";
import { seedDoctors, nextSeedSlotWindow, SeedDoctor } from "../data/seedAccounts";
import type { UserPayload } from "./userFixture";

export type { UserPayload };

export type SlotBody = {
    id: number;
    [key: string]: unknown;
};

export type SlotFixturePayload = {
    slot: SlotBody;
    doctorToken: string;
    doctor: SeedDoctor;
    seedSlotStart: string;
    seedSlotEnd: string;
};

export const test = base.extend<{ slot: SlotFixturePayload }>({
    slot: async ({ request }, use) => {
        const auth = new AuthClient(request);
        const doctor = seedDoctors[0];

        const { body: loginBody } = await auth.verifyLogin(doctor.email, doctor.password);
        const doctorToken: string = loginBody.token;

        const { seedSlotStart, seedSlotEnd, seedSlotIsAvailable } = nextSeedSlotWindow();
        const doctors = new DoctorsClient(request);

        const { status, body: slotBody } = await doctors.createSlot(
            doctor.doctorRecordId,
            seedSlotStart,
            seedSlotEnd,
            seedSlotIsAvailable,
            { headers: { Authorization: `Bearer ${doctorToken}` } },
        );

        if (status !== 201) throw new Error(`slot fixture failed: ${JSON.stringify(slotBody)}`);

        await use({ slot: slotBody as SlotBody, doctorToken, doctor, seedSlotStart, seedSlotEnd });

        const appts = new AppointmentsClient(request);
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
        // Loop because cancelAsDoctor triggers promoteFromWaitlist, which may create a new
        // pending appointment on the same slot if a patient is still on the waitlist.
        for (let pass = 0; pass < 5; pass++) {
            const { body: doctorAppts } = await appts.listDoctor(doctorAuth);
            const activeOnSlot = (Array.isArray(doctorAppts) ? doctorAppts : []).filter(
                (a: Record<string, unknown>) => a.slotId === slotBody.id && ["pending", "confirmed"].includes(a.status as string),
            );
            if (activeOnSlot.length === 0) break;
            for (const appt of activeOnSlot) {
                await appts.cancelAsDoctor(appt.id as number, doctorAuth);
            }
        }
        const { status: deleteStatus, body: deleteBody } = await doctors.deleteSlot(slotBody.id as number, doctorAuth);
        if (deleteStatus !== 204) {
            console.error(`slotFixture teardown: deleteSlot(${slotBody.id}) failed — ${deleteStatus} ${JSON.stringify(deleteBody)}`);
        }
    },
});

export { expect };

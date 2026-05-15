import { DoctorsClient } from "../api/DoctorsClient";
import { nextSeedSlotWindow } from "../data/seedAccounts";
import { authHeader } from "./utils/authHeader";
import type { APIRequestContext } from "@playwright/test";
import type { SeedDoctor } from "../data/seedAccounts";

export async function createSlot(request: APIRequestContext, doctorToken: string, doctor: SeedDoctor) {
    const doctors = new DoctorsClient(request);
    const { seedSlotStart, seedSlotEnd, seedSlotIsAvailable } = nextSeedSlotWindow();

    const { status, body } = await doctors.createSlot(
        doctor.doctorRecordId,
        seedSlotStart,
        seedSlotEnd,
        seedSlotIsAvailable,
        authHeader(doctorToken),
    );
    if (status !== 201) throw new Error("Slot creation failed");

    return { slot: body, seedSlotStart, seedSlotEnd };
}

export async function getDoctorSlot(request: APIRequestContext, doctorId: number, slotId: number | string) {
    const doctors = new DoctorsClient(request);
    const { status, body } = await doctors.listPublicSlots(doctorId);
    const slot = (Array.isArray(body) ? body : []).find(
        (s: Record<string, unknown>) => String(s.id) === String(slotId),
    );
    return { status, slot };
}

export interface SeedDoctor {
    email: string;
    password: string;
    name: string;
    doctorRecordId: number;
    specialty: string;
}

export const seedDoctors: SeedDoctor[] = [
    { email: "doctor@example.com", password: "password", name: "John Doe", doctorRecordId: 1, specialty: "Cardiologist" },
    { email: "doctor2@example.com", password: "password", name: "Jane Smith", doctorRecordId: 2, specialty: "Dermatologist" },
    { email: "doctor3@example.com", password: "password", name: "Jim Beam", doctorRecordId: 3, specialty: "Neurologist" },
];

export const seedPatient = { email: "patient@example.com", password: "password" };

let slotSeq = 0;

/** New window each call — avoids SLOT_OVERLAP when several tests hit the same doctor in one Playwright run.
 *  Always lands inside working hours (10:00–17:00 UTC) at least 24 h in the future.
 *  4 slots per day (10:00, 12:00, 14:00, 16:00), then wraps to the next day. */
export function nextSeedSlotWindow() {
    slotSeq += 1;

    // First 10:00 UTC that is >= 24 h from now
    const minStart = new Date(Date.now() + 86400000);
    const base = new Date(Date.UTC(minStart.getUTCFullYear(), minStart.getUTCMonth(), minStart.getUTCDate(), 10, 0, 0));
    if (base <= minStart) base.setUTCDate(base.getUTCDate() + 1);

    // 4 slots per day: 10:00, 12:00, 14:00, 16:00 (+1 h end = max 17:00)
    const dayOffset = Math.floor((slotSeq - 1) / 4);
    const hourOffset = ((slotSeq - 1) % 4) * 2;
    const slotStartMs = base.getTime() + dayOffset * 86400000 + hourOffset * 3600000;

    return {
        seedSlotStart: new Date(slotStartMs).toISOString(),
        seedSlotEnd: new Date(slotStartMs + 3600000).toISOString(),
        seedSlotIsAvailable: true,
    };
}

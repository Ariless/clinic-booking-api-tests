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

/** New window each call — avoids SLOT_OVERLAP when several tests hit the same doctor in one Playwright run. */
export function nextSeedSlotWindow() {
    slotSeq += 1;
    const slotStartMs = Date.now() + 86400000 + slotSeq * 2 * 60 * 60 * 1000;
    return {
        seedSlotStart: new Date(slotStartMs).toISOString(),
        seedSlotEnd: new Date(slotStartMs + 60 * 60 * 1000).toISOString(),
        seedSlotIsAvailable: true,
    };
}

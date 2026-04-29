// Demo accounts after `npm run db:seed` in the SUT repo (password for all: `password`
// unless overridden via `TEST_USER_PASSWORD` for generated patients only).
// doctorRecordId matches default empty DB order from `scripts/seed.js`.
// NOTE: only doctor@example.com has a user account in the seed; doctor2/doctor3 user accounts
// must be created manually or via an extended seed if needed for cross-doctor RBAC tests.
const seedDoctors = [
    { email: "doctor@example.com", password: "password", name: "John Doe", doctorRecordId: 1, specialty: "Cardiologist" },
    { email: "doctor2@example.com", password: "password", name: "Jane Smith", doctorRecordId: 2, specialty: "Dermatologist" },
    { email: "doctor3@example.com", password: "password", name: "Jim Beam", doctorRecordId: 3, specialty: "Neurologist" },
];
const seedPatient = { email: "patient@example.com", password: "password" };

let slotSeq = 0;

/** New window each call — avoids SLOT_OVERLAP when several tests hit the same doctor in one Playwright run. */
function nextSeedSlotWindow() {
    slotSeq += 1;
    const slotStartMs =
        Date.now() + 86400000 + Math.floor(Math.random() * 365 * 86400000) + slotSeq * 2 * 60 * 60 * 1000;
    return {
        seedSlotStart: new Date(slotStartMs).toISOString(),
        seedSlotEnd: new Date(slotStartMs + 60 * 60 * 1000).toISOString(),
        seedSlotIsAvailable: true,
    };
}

module.exports = { seedDoctors, seedPatient, nextSeedSlotWindow };

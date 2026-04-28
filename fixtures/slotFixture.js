const { test: base, expect } = require("./userFixture");
const { AuthClient } = require("../api/AuthClient");
const { DoctorsClient } = require("../api/DoctorsClient");
const { AppointmentsClient } = require("../api/AppointmentsClient");
const { seedDoctors, nextSeedSlotWindow } = require("../data/seedAccounts");

const test = base.extend({
    slot: async ({ request }, use) => {
        const auth = new AuthClient(request);
        const doctor = seedDoctors[0];

        const { body: loginBody } = await auth.verifyLogin(doctor.email, doctor.password);
        const doctorToken = loginBody.token;

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

        await use({ slot: slotBody, doctorToken, doctor, seedSlotStart, seedSlotEnd });

        const appts = new AppointmentsClient(request);
        const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
        const { body: doctorAppts } = await appts.listDoctor(doctorAuth);
        const activeOnSlot = (Array.isArray(doctorAppts) ? doctorAppts : []).filter(
            a => a.slotId === slotBody.id && ["pending", "confirmed"].includes(a.status),
        );
        for (const appt of activeOnSlot) {
            await appts.cancelAsDoctor(appt.id, doctorAuth);
        }
        await doctors.deleteSlot(slotBody.id, doctorAuth);
    },
});

module.exports = { test, expect };

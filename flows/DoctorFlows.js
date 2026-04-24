const { DoctorsClient } = require("../api/DoctorsClient");
const { nextSeedSlotWindow } = require("../data/seedAccounts");
const { authHeader } = require("./utils/authHeader");

async function createSlot(request, doctorToken, doctor) {
    const doctors = new DoctorsClient(request);
    const { seedSlotStart, seedSlotEnd, seedSlotIsAvailable } = nextSeedSlotWindow();

    const { status, body } = await doctors.createSlot(
        doctor.doctorRecordId,
        seedSlotStart,
        seedSlotEnd,
        seedSlotIsAvailable,
        authHeader(doctorToken)
    );
    if (status !== 201) throw new Error("Slot creation failed");

    return { slot: body, seedSlotStart, seedSlotEnd };
}

async function getDoctorSlot(request, doctorId, slotId) {
    const doctors = new DoctorsClient(request);

    const { status, body } = await doctors.listPublicSlots(doctorId);
    const slot = body.find(s => String(s.id) === String(slotId));

    return { status, slot };
}

module.exports = {
    createSlot,
    getDoctorSlot,
};
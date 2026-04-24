const { expect } = require("@playwright/test");

function assertSlotAvailable(slot, doctor, createdSlot) {
    expect(slot.isAvailable).toBeTruthy();
    expect(slot.doctorId).toBe(doctor.doctorRecordId);
    expect(slot.startTime).toBe(createdSlot.startTime);
    expect(slot.endTime).toBe(createdSlot.endTime);
}

module.exports = {
    assertSlotAvailable
}
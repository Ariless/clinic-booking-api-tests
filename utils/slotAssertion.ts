import { expect } from '@playwright/test';

interface SlotResponse {
  isAvailable: boolean;
  doctorId: number;
  startTime: string;
  endTime: string;
}

interface DoctorRef {
  doctorRecordId: number;
}

interface SlotWindow {
  startTime: string;
  endTime: string;
}

function assertSlotAvailable(slot: SlotResponse, doctor: DoctorRef, createdSlot: SlotWindow): void {
  expect(slot.isAvailable).toBeTruthy();
  expect(slot.doctorId).toBe(doctor.doctorRecordId);
  expect(slot.startTime).toBe(createdSlot.startTime);
  expect(slot.endTime).toBe(createdSlot.endTime);
}

export { assertSlotAvailable };
export type { SlotResponse, DoctorRef, SlotWindow };

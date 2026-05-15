import { BaseClient } from "./BaseClient";
import { endpoints } from "../data/testData";

interface RequestOpts {
    headers?: Record<string, string>;
}

export class DoctorsClient extends BaseClient {
    async list() {
        const response = await this.request.get(endpoints.doctors);
        return this.parseResponse(response);
    }

    async createSlot(doctorRecordId: number, startTime: string, endTime: string, isAvailable = true, opts: RequestOpts = {}) {
        const body = { startTime, endTime, isAvailable };
        const headers = { "Content-Type": "application/json", ...(opts.headers ?? {}) };
        const response = await this.request.post(endpoints.doctorSlotsCreate(doctorRecordId), {
            data: JSON.stringify(body),
            headers,
        });
        return this.parseResponse(response);
    }

    async listPublicSlots(doctorRecordId: number) {
        const response = await this.request.get(endpoints.doctorSlots(doctorRecordId));
        return this.parseResponse(response);
    }

    async deleteSlot(slotId: number, opts: RequestOpts = {}) {
        const response = await this.request.delete(endpoints.doctorsMeSlot(slotId), {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }
}

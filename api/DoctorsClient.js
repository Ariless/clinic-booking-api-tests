const { BaseClient } = require("./BaseClient");
const { endpoints } = require("../data/testData");

class DoctorsClient extends BaseClient {
    async list() {
        const response = await this.request.get(endpoints.doctors);
        return this.parseResponse(response);
    }

    async createSlot(doctorRecordId, startTime, endTime, isAvailable = true, opts = {}) {
        const body = { startTime, endTime, isAvailable };
        const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
        const response = await this.request.post(endpoints.doctorSlotsCreate(doctorRecordId), {
            data: JSON.stringify(body),
            headers,
        });
        return this.parseResponse(response);
    }

    async getPublicSlot(slotId) {
        const response = await this.request.get(endpoints.publicSlot(slotId));
        return this.parseResponse(response);
    }

    async listPublicSlots(doctorRecordId) {
        const response = await this.request.get(endpoints.doctorSlots(doctorRecordId));
        return this.parseResponse(response);
    }
}

module.exports = { DoctorsClient };

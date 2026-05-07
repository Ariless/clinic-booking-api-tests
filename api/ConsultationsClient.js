const { endpoints } = require("../data/testData");
const { BaseClient } = require("./BaseClient");

class ConsultationsClient extends BaseClient {
    async createConsultation(doctorId, paymentMethod, opts = {}) {
        const response = await this.request.post(endpoints.consultations, {
            data: JSON.stringify({ doctorId, paymentMethod }),
            headers: {
                "Content-Type": "application/json",
                ...(opts.headers || {}),
                ...(opts.idempotencyKey ? { "x-idempotency-key": opts.idempotencyKey } : {}),
            },
        });
        return this.parseResponse(response);
    }

    async listMy(opts = {}) {
        const response = await this.request.get(endpoints.consultationsMe, {
            headers: { ...(opts.headers || {}) },
        });
        return this.parseResponse(response);
    }
}

module.exports = { ConsultationsClient };
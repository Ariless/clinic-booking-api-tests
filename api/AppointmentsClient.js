const { endpoints } = require("../data/testData");
const { BaseClient } = require("./BaseClient");

class AppointmentsClient extends BaseClient {
    async createAppointment(slotId, opts = {}) {
        const response = await this.request.post(endpoints.appointments, {
            data: JSON.stringify({ slotId }),
            headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
        });
        return this.parseResponse(response);
    }

    async getAppointment(appointmentId, opts = {}) {
        const response = await this.request.get(endpoints.appointment(appointmentId), {
            headers: { ...(opts.headers || {}) },
        });
        return this.parseResponse(response);
    }

    async listMy(opts = {}) {
        const response = await this.request.get(endpoints.appointmentsMy, {
            headers: { ...(opts.headers || {}) },
        });
        return this.parseResponse(response);
    }

    async confirmAppointment(appointmentId, opts = {}) {
        const response = await this.request.patch(endpoints.appointmentConfirm(appointmentId), {
            headers: { ...(opts.headers || {}) },
        });
        return this.parseResponse(response);
    }

    async rejectAppointment(appointmentId, opts = {}) {
        const response = await this.request.patch(endpoints.appointmentReject(appointmentId), {
            headers: { ...(opts.headers || {}) },
        });
        return this.parseResponse(response);
    }
}

module.exports = { AppointmentsClient };

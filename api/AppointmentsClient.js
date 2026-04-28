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

    async cancelAppointment(appointmentId, opts = {}) {
        const response = await this.request.patch(endpoints.appointmentCancel(appointmentId), {
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

    async listDoctor(opts = {}) {
        const response = await this.request.get(endpoints.appointmentsDoctor, {
            headers: { ...(opts.headers || {}) },
        });
        return this.parseResponse(response);
    }

    async cancelAsDoctor(appointmentId, opts = {}) {
        const response = await this.request.patch(endpoints.appointmentCancelAsDoctor(appointmentId), {
            headers: { ...(opts.headers || {}) },
        });
        return this.parseResponse(response);
    }

    async joinWaitlist(doctorId, opts = {}) {
        const response = await this.request.post(endpoints.appointmentsWaitlistJoin, {
            data: JSON.stringify({ doctorId }),
            headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
        });
        return this.parseResponse(response);
    }

    async getMyWaitlist(opts = {}) {
        const response = await this.request.get(endpoints.appointmentsWaitlistMe, {
            headers: { ...(opts.headers || {}) },
        });
        return this.parseResponse(response);
    }

async leaveWaitlist(waitlistId, opts = {}) {
    const response = await this.request.delete(endpoints.appointmentsWaitlistDelete(waitlistId), {
        headers: { ...(opts.headers || {}) },
    });
    return this.parseResponse(response);
}




}

module.exports = { AppointmentsClient };
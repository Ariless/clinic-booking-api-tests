import { endpoints } from "../data/testData";
import { BaseClient } from "./BaseClient";

interface RequestOpts {
    headers?: Record<string, string>;
}

export class AppointmentsClient extends BaseClient {
    async createAppointment(slotId: number, opts: RequestOpts = {}) {
        const response = await this.request.post(endpoints.appointments, {
            data: JSON.stringify({ slotId }),
            headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async createAppointmentFull(slotId: number, opts: RequestOpts = {}) {
        const response = await this.request.post(endpoints.appointments, {
            data: JSON.stringify({ slotId }),
            headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
        });
        return this.parseResponseFull(response);
    }

    async getAppointment(appointmentId: number, opts: RequestOpts = {}) {
        const response = await this.request.get(endpoints.appointment(appointmentId), {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async listMy(opts: RequestOpts = {}) {
        const response = await this.request.get(endpoints.appointmentsMy, {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async confirmAppointment(appointmentId: number, opts: RequestOpts = {}) {
        const response = await this.request.patch(endpoints.appointmentConfirm(appointmentId), {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async cancelAppointment(appointmentId: number, opts: RequestOpts = {}) {
        const response = await this.request.patch(endpoints.appointmentCancel(appointmentId), {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async rejectAppointment(appointmentId: number, opts: RequestOpts = {}) {
        return this.parseResponse(
            await this.request.patch(endpoints.appointmentReject(appointmentId), {
                headers: { ...(opts.headers ?? {}) },
            }),
        );
    }

    async listDoctor(opts: RequestOpts = {}) {
        const response = await this.request.get(endpoints.appointmentsDoctor, {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async cancelAsDoctor(appointmentId: number, opts: RequestOpts = {}) {
        return this.parseResponse(
            await this.request.patch(endpoints.appointmentCancelAsDoctor(appointmentId), {
                headers: { ...(opts.headers ?? {}) },
            }),
        );
    }

    async joinWaitlist(doctorId: number, opts: RequestOpts = {}) {
        const response = await this.request.post(endpoints.appointmentsWaitlistJoin, {
            data: JSON.stringify({ doctorId }),
            headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async getMyWaitlist(opts: RequestOpts = {}) {
        const response = await this.request.get(endpoints.appointmentsWaitlistMe, {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async leaveWaitlist(waitlistId: number, opts: RequestOpts = {}) {
        const response = await this.request.delete(endpoints.appointmentsWaitlistDelete(waitlistId), {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async getWaitlistOffers(opts: RequestOpts = {}) {
        const response = await this.request.get(endpoints.appointmentsWaitlistOffers, {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async acceptOffer(offerId: number, opts: RequestOpts = {}) {
        const response = await this.request.post(endpoints.appointmentsWaitlistOfferAccept(offerId), {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async declineOffer(offerId: number, opts: RequestOpts = {}) {
        const response = await this.request.post(endpoints.appointmentsWaitlistOfferDecline(offerId), {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }
}

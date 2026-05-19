import { endpoints } from "../data/testData";
import { BaseClient } from "./BaseClient";

interface RequestOpts {
    headers?: Record<string, string>;
}

export class AppointmentsClient extends BaseClient {
    async createAppointment(slotId: number, opts: RequestOpts & { type?: string } = {}) {
        const { type, ...reqOpts } = opts;
        const body: Record<string, unknown> = { slotId };
        if (type !== undefined) body.type = type;
        const response = await this.request.post(endpoints.appointments, {
            data: JSON.stringify(body),
            headers: { "Content-Type": "application/json", ...(reqOpts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }

    async createAppointmentFull(slotId: number, opts: RequestOpts & { type?: string } = {}) {
        const { type, ...reqOpts } = opts;
        const body: Record<string, unknown> = { slotId };
        if (type !== undefined) body.type = type;
        const response = await this.request.post(endpoints.appointments, {
            data: JSON.stringify(body),
            headers: { "Content-Type": "application/json", ...(reqOpts.headers ?? {}) },
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
        const { status, body } = await this.parseResponse(response);
        const data = Array.isArray(body) ? body : (body?.data ?? body);
        return { status, body: data };
    }

    async listMyFiltered(params: Record<string, string>, opts: RequestOpts = {}) {
        const qs = new URLSearchParams(params);
        const url = endpoints.appointmentsMy + (qs.toString() ? `?${qs}` : '');
        const response = await this.request.get(url, { headers: { ...(opts.headers ?? {}) } });
        return this.parseResponse(response);
    }

    async listMyPaginated(page?: number, limit?: number, opts: RequestOpts = {}) {
        const params = new URLSearchParams();
        if (page !== undefined) params.set("page", String(page));
        if (limit !== undefined) params.set("limit", String(limit));
        const url = endpoints.appointmentsMy + (params.toString() ? `?${params}` : "");
        const response = await this.request.get(url, { headers: { ...(opts.headers ?? {}) } });
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
        const { status, body } = await this.parseResponse(response);
        const data = Array.isArray(body) ? body : (body?.data ?? body);
        return { status, body: data };
    }

    async listDoctorPaginated(page?: number, limit?: number, opts: RequestOpts = {}) {
        const params = new URLSearchParams();
        if (page !== undefined) params.set("page", String(page));
        if (limit !== undefined) params.set("limit", String(limit));
        const url = endpoints.appointmentsDoctor + (params.toString() ? `?${params}` : "");
        const response = await this.request.get(url, { headers: { ...(opts.headers ?? {}) } });
        return this.parseResponse(response);
    }

    async cancelAsDoctor(appointmentId: number, opts: RequestOpts = {}) {
        return this.parseResponse(
            await this.request.patch(endpoints.appointmentCancelAsDoctor(appointmentId), {
                headers: { ...(opts.headers ?? {}) },
            }),
        );
    }

    async completeAppointment(appointmentId: number, opts: RequestOpts = {}) {
        return this.parseResponse(
            await this.request.patch(endpoints.appointmentComplete(appointmentId), {
                headers: { ...(opts.headers ?? {}) },
            }),
        );
    }

    async bookRecurring(startSlotId: number, slotPattern: string, count: number, opts: RequestOpts = {}) {
        return this.parseResponse(
            await this.request.post(endpoints.appointmentsRecurring, {
                data: JSON.stringify({ startSlotId, slotPattern, count }),
                headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
            }),
        );
    }

    async cancelSeries(seriesId: string, opts: RequestOpts = {}) {
        return this.parseResponse(
            await this.request.patch(endpoints.appointmentSeriesCancel(seriesId), {
                headers: { ...(opts.headers ?? {}) },
            }),
        );
    }

    async rescheduleAppointment(appointmentId: number, newSlotId: number, opts: RequestOpts = {}) {
        return this.parseResponse(
            await this.request.patch(endpoints.appointmentReschedule(appointmentId), {
                data: JSON.stringify({ newSlotId }),
                headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
            }),
        );
    }

    async addNote(appointmentId: number, content: string, opts: RequestOpts = {}) {
        return this.parseResponse(
            await this.request.post(endpoints.appointmentNotes(appointmentId), {
                data: JSON.stringify({ content }),
                headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
            }),
        );
    }

    async rateAppointment(appointmentId: number, score: number, comment?: string, opts: RequestOpts = {}) {
        return this.parseResponse(
            await this.request.post(endpoints.appointmentRate(appointmentId), {
                data: JSON.stringify({ score, ...(comment !== undefined ? { comment } : {}) }),
                headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
            }),
        );
    }

    async getNotes(appointmentId: number, opts: RequestOpts = {}) {
        return this.parseResponse(
            await this.request.get(endpoints.appointmentNotes(appointmentId), {
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

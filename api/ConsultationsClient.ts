import { BaseClient } from './BaseClient';
import { endpoints } from '../data/testData';

interface RequestOpts {
    headers?: Record<string, string>;
    idempotencyKey?: string;
}

export class ConsultationsClient extends BaseClient {
    async createConsultation(doctorId: number, paymentMethod: string, opts: RequestOpts = {}) {
        const response = await this.request.post(endpoints.consultations, {
            data: JSON.stringify({ doctorId, paymentMethod }),
            headers: {
                'Content-Type': 'application/json',
                ...(opts.headers ?? {}),
                ...(opts.idempotencyKey ? { 'x-idempotency-key': opts.idempotencyKey } : {}),
            },
        });
        return this.parseResponse(response);
    }

    async listMy(opts: RequestOpts = {}) {
        const response = await this.request.get(endpoints.consultationsMe, {
            headers: { ...(opts.headers ?? {}) },
        });
        return this.parseResponse(response);
    }
}

import { BaseClient } from "./BaseClient";
import { AppointmentEndpoints } from "../enums/appointments";

/**
 * Development-only endpoints under /api/v1/debug. The SUT returns 404 for all of them
 * unless it runs with NODE_ENV=development and ENABLE_DEBUG_ROUTES=true.
 */
export class DebugClient extends BaseClient {
    /** Backdates an offer's deadline so TTL expiry can be reached without waiting it out. */
    async expireOffer(offerId: number) {
        const response = await this.postJson(AppointmentEndpoints.debugExpireOffer, { offerId });
        return this.parseResponse(response);
    }

    /** Runs one offer-expiry sweep synchronously — the same call the background timer makes. */
    async runOfferExpiry() {
        const response = await this.postJson(AppointmentEndpoints.debugRunOfferExpiry, {});
        return this.parseResponse(response);
    }

    /** Desyncs (or restores) `slots.isAvailable` against its bookings — proves the invariant oracle bites. */
    async breakInvariant(slotId: number, action: 'break' | 'repair') {
        const response = await this.postJson(AppointmentEndpoints.debugBreakInvariant, { slotId, action });
        return this.parseResponse(response);
    }
}

import { endpoints } from "../data/testData";
import { BaseClient } from "./BaseClient";

export class AiRecommendClient extends BaseClient {
    async recommend(symptoms: string, token: string) {
        const response = await this.postJson(
            endpoints.aiRecommendDoctor,
            { symptoms },
            { Authorization: `Bearer ${token}` }
        );
        return this.parseResponse(response);
    }

    /**
     * Sends no Authorization header at all.
     *
     * Exists for the ASI03 tests: until 2026-08-27 this route answered such a request with a 200 and
     * a recommendation, having reached a paid external model on behalf of nobody. A separate method
     * rather than an optional token, so the absence is stated at the call site.
     */
    async recommendAnonymously(symptoms: string) {
        const response = await this.postJson(endpoints.aiRecommendDoctor, { symptoms });
        return this.parseResponse(response);
    }

    /** Sends the given string as the bearer token verbatim — for malformed and tampered tokens. */
    async recommendWithRawToken(symptoms: string, token: string) {
        const response = await this.postJson(
            endpoints.aiRecommendDoctor,
            { symptoms },
            { Authorization: `Bearer ${token}` }
        );
        return this.parseResponse(response);
    }
}

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
}

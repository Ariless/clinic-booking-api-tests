import { endpoints } from "../data/testData";
import { BaseClient } from "./BaseClient";

export class AuthClient extends BaseClient {
    async verifyLogin(email: string, password: string) {
        const response = await this.postJson(endpoints.login, { email, password });
        return this.parseResponse(response);
    }
}

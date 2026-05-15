import { BaseClient } from "./BaseClient";
import { endpoints } from "../data/testData";

interface RegisterPatientPayload {
    email: string;
    password?: string;
    name?: string;
}

interface RegisterDoctorPayload {
    email: string;
    password?: string;
    name?: string;
    doctorRecordId?: number | string;
}

export class UserClient extends BaseClient {
    async registerPatient({ email, password = "password", name = "Test Patient" }: RegisterPatientPayload) {
        const response = await this.postJson(endpoints.authRegister, {
            email, password, name, role: "patient",
        });
        return this.parseResponse(response);
    }

    async registerDoctor({ email, password = "password", name = "Test Doctor", doctorRecordId }: RegisterDoctorPayload) {
        const response = await this.postJson(endpoints.authRegister, {
            email, password, name, role: "doctor", doctorRecordId,
        });
        return this.parseResponse(response);
    }

    async deleteMyAccount(accessToken: string) {
        const response = await this.deleteWithBearer(endpoints.authMe, accessToken);
        const status = response.status();
        if (status === 204) return { status };
        const body = await response.json().catch(() => ({}));
        return { status, body };
    }
}
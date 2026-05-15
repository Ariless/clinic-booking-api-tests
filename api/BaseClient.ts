import { APIRequestContext } from "@playwright/test";

export class BaseClient {
    constructor(protected request: APIRequestContext) {}

    protected async parseResponse(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
        const text = await response.text();
        const body = text ? JSON.parse(text) : null;
        return { status: response.status(), body };
    }

    protected async parseResponseFull(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
        const text = await response.text();
        const body = text ? JSON.parse(text) : null;
        return { status: response.status(), body, response };
    }

    protected async postJson(path: string, body: unknown, extraHeaders: Record<string, string> = {}) {
        return this.request.post(path, {
            data: JSON.stringify(body),
            headers: { "Content-Type": "application/json", ...extraHeaders },
        });
    }

    protected async deleteWithBearer(path: string, accessToken: string) {
        return this.request.delete(path, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
    }
}
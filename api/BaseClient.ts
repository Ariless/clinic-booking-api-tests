import { APIRequestContext } from "@playwright/test";

// A proxy or a crashed server can answer with an HTML page or plain text. Keeping that text as the
// body lets the test's status assertion report the real failure (a 502, say) instead of a
// SyntaxError from JSON.parse that hides the status altogether.
function parseBody(text: string) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export class BaseClient {
    constructor(protected request: APIRequestContext) {}

    protected async parseResponse(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
        const body = parseBody(await response.text());
        // headers are returned alongside the body so a test can correlate an async side effect
        // (a Kafka event, a webhook) with the exact request that caused it, via X-Request-Id
        return { status: response.status(), body, headers: response.headers() };
    }

    protected async parseResponseFull(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
        const body = parseBody(await response.text());
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
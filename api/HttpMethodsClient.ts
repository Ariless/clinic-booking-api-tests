import { BaseClient } from "./BaseClient";

/**
 * Sends a method a path does not serve, which no resource client can express: every other
 * client here exists to call an endpoint correctly, and the method is baked into the method
 * name. Verifying the 405 contract needs the opposite — a deliberate mismatch — so the
 * capability lives in its own client rather than as raw `request.fetch` in a test file.
 */
export class HttpMethodsClient extends BaseClient {
    /**
     * Sends `method` to `path` verbatim.
     *
     * Does not reuse `parseResponse`: a deliberate method mismatch can come back as
     * something other than JSON — Express answers OPTIONS with a bare `GET, HEAD` body —
     * and a client built for wrong methods must not throw on the reply it went looking for.
     * `body` is the parsed JSON when there is one, otherwise null; `text` is always raw.
     */
    async send(method: string, path: string) {
        const response = await this.request.fetch(path, { method });
        const text = await response.text();

        let body: unknown = null;
        try {
            body = text ? JSON.parse(text) : null;
        } catch {
            body = null;
        }

        return { status: response.status(), body, text, headers: response.headers() };
    }

    /** Fetches the raw OpenAPI document the SUT serves. */
    async openApiSpec() {
        const response = await this.request.get("/api/openapi.yaml");
        return { status: response.status(), text: await response.text() };
    }
}

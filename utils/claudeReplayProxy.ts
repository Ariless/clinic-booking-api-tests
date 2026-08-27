import http from 'http';
import type { AddressInfo } from 'net';
import path from 'path';
import { appendToCassette, cassetteKey, readCassette, type CassetteRequest } from './claudeCassette';

/**
 * A stand-in for `api.anthropic.com` that either records what the real API answers or replays what
 * it answered before. Anything holding an Anthropic client — the SUT, the ai-service, or a test
 * calling the SDK directly — is pointed at it by base URL, so no call site knows it exists.
 *
 * See `claudeCassette.ts` for why this is an HTTP proxy rather than a stub in the code.
 */

export type ProxyMode = 'record' | 'replay';

export const DEFAULT_CASSETTE_DIR = path.resolve(__dirname, '../fixtures/cassettes');

const UPSTREAM = 'https://api.anthropic.com';

export type ReplayProxy = {
    /** Base URL to hand an Anthropic client, e.g. `http://127.0.0.1:53123`. */
    url: string;
    /** Requests seen this run, for a summary line and for asserting a replay run stayed offline. */
    stats: { matched: number; recorded: number; missed: number };
    close: () => Promise<void>;
};

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => (raw += chunk));
        req.on('end', () => resolve(raw));
        req.on('error', reject);
    });
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload);
    res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
    res.end(body);
}

/**
 * Fixed by default rather than ephemeral: the SUT is a separate process started *before* Playwright
 * (in CI, a container brought up by an earlier step), so it has to be told the address up front.
 * The connection is only made when a test triggers a model call, by which time global setup has the
 * proxy listening.
 */
export const DEFAULT_PROXY_PORT = 3010;

export async function startReplayProxy(options: {
    mode: ProxyMode;
    cassetteDir?: string;
    apiKey?: string;
    /** 0 picks an ephemeral port — useful in a unit test, never for the SUT. */
    port?: number;
}): Promise<ReplayProxy> {
    const cassetteDir = options.cassetteDir ?? DEFAULT_CASSETTE_DIR;
    const stats = { matched: 0, recorded: 0, missed: 0 };

    // Per-key cursor: the n-th identical request in a run gets the n-th recorded response. Reset on
    // start, so a run always replays the sequence from the beginning.
    const cursor = new Map<string, number>();

    const server = http.createServer((req, res) => {
        void (async () => {
            if (!req.url?.startsWith('/v1/messages')) {
                return sendJson(res, 404, { error: { type: 'not_found', message: `proxy handles /v1/messages only, got ${req.url}` } });
            }

            const raw = await readBody(req);
            let body: CassetteRequest;
            try {
                body = JSON.parse(raw) as CassetteRequest;
            } catch {
                return sendJson(res, 400, { error: { type: 'invalid_request_error', message: 'proxy could not parse the request body' } });
            }

            const key = cassetteKey(body);

            if (options.mode === 'record') {
                const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
                if (!apiKey) {
                    return sendJson(res, 401, { error: { type: 'authentication_error', message: 'recording needs ANTHROPIC_API_KEY' } });
                }

                const upstream = await fetch(`${UPSTREAM}/v1/messages`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': (req.headers['anthropic-version'] as string) ?? '2023-06-01',
                    },
                    body: raw,
                });

                const payload: unknown = await upstream.json();
                // Only successful interactions are worth keeping. Recording a 429 or a credit error
                // would bake a transient outage into the suite as if it were the model's answer.
                if (upstream.ok) {
                    appendToCassette(cassetteDir, body, payload);
                    stats.recorded++;
                } else {
                    stats.missed++;
                    console.error(`[claude-proxy] upstream ${upstream.status} for ${key} — not recorded`);
                }
                return sendJson(res, upstream.status, payload);
            }

            const entry = readCassette(cassetteDir, key);
            if (!entry) {
                stats.missed++;
                // 404 rather than a 5xx on purpose: the SDK retries 5xx, so a missing recording
                // would be reported three times over as a flaky network instead of once as what it
                // is. The message has to carry the diagnosis, because by the time a test sees this
                // it has become a 503 from the SUT.
                console.error(`[claude-proxy] no cassette for ${key}. Request: ${JSON.stringify(body).slice(0, 300)}`);
                return sendJson(res, 404, {
                    error: {
                        type: 'not_found_error',
                        message: `No cassette for request ${key}. The prompt, model or schema changed — re-record with 'npm run rag:record'.`,
                    },
                });
            }

            const index = cursor.get(key) ?? 0;
            if (index >= entry.responses.length) {
                stats.missed++;
                console.error(`[claude-proxy] cassette ${key} has ${entry.responses.length} responses, run asked for #${index + 1}`);
                return sendJson(res, 404, {
                    error: {
                        type: 'not_found_error',
                        message: `Cassette ${key} holds ${entry.responses.length} responses and this run wanted #${index + 1}. A test now calls more times than was recorded — re-record.`,
                    },
                });
            }

            cursor.set(key, index + 1);
            stats.matched++;
            return sendJson(res, 200, entry.responses[index]);
        })().catch((err: unknown) => {
            console.error('[claude-proxy] handler failed', err);
            if (!res.headersSent) sendJson(res, 500, { error: { type: 'api_error', message: String(err) } });
        });
    });

    // 0.0.0.0, not 127.0.0.1: in CI the SUT runs in a container and reaches the host through
    // host.docker.internal, which does not resolve to the loopback interface of this process.
    const requestedPort = options.port ?? DEFAULT_PROXY_PORT;
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(requestedPort, '0.0.0.0', resolve);
    });
    const { port } = server.address() as AddressInfo;

    return {
        url: `http://127.0.0.1:${port}`,
        stats,
        close: () =>
            new Promise<void>((resolve, reject) =>
                server.close((err) => (err ? reject(err) : resolve()))
            ),
    };
}

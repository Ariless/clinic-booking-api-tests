import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Cassettes: recorded Anthropic responses, replayed over real HTTP so the `@rag` suite can run in
 * ordinary CI without a key, a balance, or a network.
 *
 * Why HTTP and not a stub inside the code. `AI_MOCK_RESPONSE=true` already gives determinism, but it
 * answers from retrieval and never calls the model — so it exercises none of what the `@rag` tests
 * are about: the response actually being parsed, the structured-output schema being honoured, the
 * error paths, the reasoning text that the judge and the completeness test read. A cassette replays
 * the real wire response, so everything downstream of the socket is the production path.
 *
 * What replay does not cover: model drift. A recording is frozen by definition, so a change in
 * Claude's behaviour is invisible here — that is `model-drift.yml`'s job, weekly and against the
 * live API. Replay guards our code; the scheduled job guards the assumption about the model.
 */

export type CassetteRequest = {
    model?: string;
    max_tokens?: number;
    messages?: unknown;
    output_config?: unknown;
    [key: string]: unknown;
};

export type CassetteEntry = {
    /** The request that produced these responses, kept readable so a cassette can be reviewed in a diff. */
    request: CassetteRequest;
    /** Recorded on this date, against this model. Both matter when a recording looks stale. */
    recordedAt: string;
    /**
     * Responses in the order they were received. A list, not a single value, because two `@rag`
     * tests send the *same* request repeatedly and depend on the answers differing: the LLM judge
     * takes a majority of three runs, and the bias test counts 3-of-4. Collapsing those to one
     * recorded answer would turn both into a coin flip that always lands the same way.
     */
    responses: unknown[];
};

/**
 * Recursively sorts object keys so serialisation order cannot change the hash.
 *
 * Written out rather than handed to `JSON.stringify`'s second parameter, which is what the first
 * version of `cassetteKey` did: given an array, that parameter is an *allow-list of property names*
 * applied at every depth, not a sort order. Passing the top-level keys therefore deleted everything
 * below them — the body being hashed came out as
 * `{"max_tokens":256,"messages":[{}],"model":"…","output_config":{}}`, and every prompt in the suite
 * shared one key. See TST-09 in `docs/KNOWN_ISSUES.md`.
 */
function canonicalise(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalise);
    if (value !== null && typeof value === 'object') {
        const source = value as Record<string, unknown>;
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(source).sort()) sorted[key] = canonicalise(source[key]);
        return sorted;
    }
    return value;
}

/**
 * Identity of a request, for matching a replay against a recording.
 *
 * The whole body participates: changing the prompt, the model, or the schema misses the cassette. A
 * silent match on a changed prompt is worse than a loud miss — it would report that code passes
 * against an answer to a question it no longer asks.
 */
export function cassetteKey(body: CassetteRequest): string {
    return crypto.createHash('sha256').update(JSON.stringify(canonicalise(body))).digest('hex').slice(0, 16);
}

/** One file per request, so re-recording one interaction produces a one-file diff. */
function cassettePath(dir: string, key: string): string {
    return path.join(dir, `${key}.json`);
}

export function readCassette(dir: string, key: string): CassetteEntry | null {
    const file = cassettePath(dir, key);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8')) as CassetteEntry;
}

/**
 * Appends a response to the cassette for this request, creating it if needed. Appending rather than
 * overwriting is what preserves the sequence the repeated-call tests need.
 */
export function appendToCassette(dir: string, body: CassetteRequest, response: unknown): void {
    fs.mkdirSync(dir, { recursive: true });
    const key = cassetteKey(body);
    const existing = readCassette(dir, key);

    const entry: CassetteEntry = existing ?? {
        request: body,
        recordedAt: new Date().toISOString().slice(0, 10),
        responses: [],
    };
    entry.responses.push(response);

    fs.writeFileSync(cassettePath(dir, key), `${JSON.stringify(entry, null, 2)}\n`);
}

export function listCassettes(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
}

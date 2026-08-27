/**
 * Removes patient-identifying data from text before it leaves the test run.
 *
 * The one place it currently has to: `aiBugReporter.ts` sends a failed test's error message and
 * stack to Anthropic, writes them to `bug-reports/`, and attaches them to the Allure report. A
 * Playwright assertion message contains the values it compared, so a failure inside an AI test
 * carries the symptoms, and a failure inside an auth test carries an address and a bearer token.
 * Nothing in the SUT is real, but the pipeline is: it is the same code that would run against a
 * staging database seeded from production, and the report outlives the run.
 *
 * Written 2026-08-26. The reporter is wired into one demo spec today, which is the reason to do it
 * now rather than after it is attached to every spec — the obvious next step for it.
 *
 * Deliberately not a classifier. It knows the field names this API actually carries and the two
 * shapes that identify a person on sight (an address, a bearer token). Anything it does not know
 * stays, so the report remains useful; the alternative — a model deciding what is sensitive — puts
 * the data through the very hop this is meant to guard.
 */

/** Fields this API carries that name or describe a person. See `api/UserClient.ts`, `api/AiRecommendClient.ts`. */
const SENSITIVE_FIELDS = [
    'symptoms',
    'email',
    'password',
    'name',
    'reasoning',
    'accessToken',
    'refreshToken',
    'token',
] as const;

const CENSOR = '[redacted]';

/**
 * `"symptoms": "chest pain"` and `symptoms: 'chest pain'` — quoted or bare key, either quote style.
 *
 * The lookbehind is load-bearing. Matching is case-insensitive, so without it the `name` rule eats
 * `fileName: "..."` and the report loses the one line that says where the failure was.
 */
function fieldPattern(field: string): RegExp {
    return new RegExp(`(?<![A-Za-z0-9_])(["']?${field}["']?\\s*[:=]\\s*)(["'])(?:\\\\.|(?!\\2).)*\\2`, 'gi');
}

/** RFC-shaped enough for a test report; deliberately broad rather than exact. */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Three base64url segments — a JWT, with or without the `Bearer ` in front of it. */
const JWT = /(Bearer\s+)?[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

/**
 * @param text any free text — an assertion message, a stack, a response body pasted into one.
 * @returns the same text with known personal values replaced by `[redacted]`.
 */
export function redactPhi(text: string): string {
    if (!text) return text;

    let out = text;
    for (const field of SENSITIVE_FIELDS) {
        out = out.replace(fieldPattern(field), (_match, prefix: string) => `${prefix}"${CENSOR}"`);
    }
    // Order matters: JWTs before emails, because neither pattern should get a half-censored string
    // from the other. Both run after the field rules so a value already replaced is left alone.
    out = out.replace(JWT, (match) => (match.trimStart().startsWith('Bearer') ? `Bearer ${CENSOR}` : CENSOR));
    out = out.replace(EMAIL, CENSOR);
    return out;
}

export { SENSITIVE_FIELDS, CENSOR };

// A path that exists but does not serve the requested method must answer 405 with an
// `Allow` header — RFC 9110 §15.5.6. Until 2026-08-26 this API answered 404 everywhere,
// which made "no such path" and "wrong method for this path" indistinguishable from
// outside: a client debugging a typo'd verb was sent looking for a missing route.
//
// Schemathesis originally reported this as "TRACE → 404 not 405" and it sat in
// SYSTEM_WEAKNESS_REPORT §5.2 as low severity. The narrow reading was wrong — it was
// never about TRACE. No path in the API returned 405 under any method.
import { test, expect } from '../../fixtures';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

/** Paths that exist, with a method they do not serve and the methods they do. */
const WRONG_METHOD_CASES = [
    { path: '/api/v1/doctors', method: 'POST', allows: ['GET'] },
    { path: '/api/v1/doctors', method: 'PUT', allows: ['GET'] },
    { path: '/api/v1/doctors', method: 'TRACE', allows: ['GET'] },
    { path: '/api/v1/auth/login', method: 'GET', allows: ['POST'] },
    { path: '/api/v1/auth/register', method: 'DELETE', allows: ['POST'] },
    { path: '/health', method: 'PUT', allows: ['GET'] },
] as const;

for (const { path, method, allows } of WRONG_METHOD_CASES) {
    test(`${method} ${path} — 405 with Allow, not 404 @api @contract`, async ({ request }) => {
        const response = await request.fetch(`${BASE}${path}`, { method });

        expect(response.status()).toBe(405);

        // The header is the actionable half: a 405 without Allow tells the client it
        // guessed wrong but not what to guess next.
        const allow = response.headers()['allow'] ?? '';
        const offered = allow.split(',').map((m) => m.trim()).filter(Boolean);
        for (const expected of allows) expect(offered).toContain(expected);
        expect(offered).toContain('OPTIONS');

        const body = await response.json();
        expect(body.errorCode).toBe('METHOD_NOT_ALLOWED');
        expect(body.requestId).toBeTruthy();
    });
}

test('unknown paths stay 404 under any method @api @contract', async ({ request }) => {
    // The half of the rule that is easy to break while fixing the other half: answering
    // 405 for a path that does not exist would leak which routes are absent and is wrong
    // by the same RFC. TRACE is included because it is where the original report started.
    for (const method of ['GET', 'POST', 'TRACE', 'DELETE']) {
        const response = await request.fetch(`${BASE}/api/v1/nonexistent`, { method });

        expect(response.status(), `${method} on an unknown path`).toBe(404);
        expect(response.headers()['allow']).toBeUndefined();
    }
});

test('a served method is untouched by the 405 layer @api @contract', async ({ request }) => {
    // Guards the regression that matters most: the check runs before the 404 handler and
    // walks the router on every unmatched request, so a mistake there would surface as
    // real routes breaking rather than as a wrong status code.
    const response = await request.get(`${BASE}/api/v1/doctors`);

    expect(response.status()).toBe(200);
    expect(response.headers()['allow']).toBeUndefined();
});

test('OPTIONS is answered by Express, not by the 405 layer @api @contract', async ({ request }) => {
    const response = await request.fetch(`${BASE}/api/v1/doctors`, { method: 'OPTIONS' });

    expect(response.status()).toBe(200);
    expect(response.headers()['allow']).toContain('GET');
});

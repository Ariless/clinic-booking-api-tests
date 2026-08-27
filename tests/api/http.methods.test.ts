// A path that exists but does not serve the requested method must answer 405 with an
// `Allow` header — RFC 9110 §15.5.6. Until 2026-08-26 this API answered 404 everywhere,
// which made "no such path" and "wrong method for this path" indistinguishable from
// outside: a client debugging a typo'd verb was sent looking for a missing route.
//
// Schemathesis originally reported this as "TRACE → 404 not 405" and it sat in
// SYSTEM_WEAKNESS_REPORT §5.2 as low severity. The narrow reading was wrong — it was
// never about TRACE. No path in the API returned 405 under any method.
import { test, expect } from '../../fixtures';
import { HttpMethodsClient } from '../../api/HttpMethodsClient';
import { assertSchema } from '../../utils/schemaValidator';
import { validateError } from '../../data/schemas/errorSchema';
import { endpoints } from '../../data/testData';

/** Paths that exist, with a method they do not serve and the methods they do. */
const WRONG_METHOD_CASES = [
    { path: endpoints.doctors, method: 'POST', allows: ['GET'] },
    { path: endpoints.doctors, method: 'PUT', allows: ['GET'] },
    { path: endpoints.doctors, method: 'TRACE', allows: ['GET'] },
    { path: endpoints.login, method: 'GET', allows: ['POST'] },
    { path: endpoints.authRegister, method: 'DELETE', allows: ['POST'] },
    { path: endpoints.health, method: 'PUT', allows: ['GET'] },
] as const;

for (const { path, method, allows } of WRONG_METHOD_CASES) {
    test(`${method} ${path} — 405 with Allow, not 404 @api @contract`, async ({ request }) => {
        const http = new HttpMethodsClient(request);

        const { status, body, headers } = await http.send(method, path);

        expect(status).toBe(405);
        assertSchema(body, validateError);
        expect((body as { errorCode: string }).errorCode).toBe('METHOD_NOT_ALLOWED');

        // The header is the actionable half: a 405 without Allow tells the client it
        // guessed wrong but not what to guess next.
        const offered = (headers['allow'] ?? '').split(',').map((m) => m.trim()).filter(Boolean);
        for (const expected of allows) expect(offered).toContain(expected);
        expect(offered).toContain('OPTIONS');
    });
}

test('unknown paths stay 404 under any method @api @contract', async ({ request }) => {
    // The half of the rule that is easy to break while fixing the other half: answering
    // 405 for a path that does not exist would leak which routes are absent and is wrong
    // by the same RFC. TRACE is included because it is where the original report started.
    const http = new HttpMethodsClient(request);

    for (const method of ['GET', 'POST', 'TRACE', 'DELETE']) {
        // Not from endpoints/: the point is a path the API does not have.
        const { status, body, headers } = await http.send(method, '/api/v1/nonexistent');

        expect(status, `${method} on an unknown path`).toBe(404);
        assertSchema(body, validateError);
        expect((body as { errorCode: string }).errorCode).toBe('NOT_FOUND');
        expect(headers['allow']).toBeUndefined();
    }
});

test('a served method is untouched by the 405 layer @api @contract', async ({ request }) => {
    // Guards the regression that matters most: the check runs before the 404 handler and
    // walks the router on every unmatched request, so a mistake there would surface as
    // real routes breaking rather than as a wrong status code.
    const http = new HttpMethodsClient(request);

    const { status, headers } = await http.send('GET', endpoints.doctors);

    expect(status).toBe(200);
    expect(headers['allow']).toBeUndefined();
});

test('OPTIONS is answered by Express, not by the 405 layer @api @contract', async ({ request }) => {
    const http = new HttpMethodsClient(request);

    const { status, headers } = await http.send('OPTIONS', endpoints.doctors);

    expect(status).toBe(200);
    expect(headers['allow']).toContain('GET');
});

test('every operation in the spec documents 405 @api @contract', async ({ request }) => {
    // The response exists in the implementation; a contract that omits it lets a client
    // treat 405 as an undocumented surprise — and lets the two drift apart again. Counted
    // textually, the way contract.drift.test.ts reads the spec: one operationId per
    // operation, one $ref per documented 405, plus the component definition itself.
    const http = new HttpMethodsClient(request);

    const { status, text: spec } = await http.openApiSpec();
    expect(status).toBe(200);

    const operations = (spec.match(/^\s+operationId:/gm) ?? []).length;
    const documented = (spec.match(/#\/components\/responses\/MethodNotAllowed/g) ?? []).length;

    expect(operations).toBeGreaterThan(0);
    expect(documented, 'every operation should reference the MethodNotAllowed response').toBe(operations);
    expect(spec).toContain('MethodNotAllowed:');
    expect(spec).toContain('Allow:');
});

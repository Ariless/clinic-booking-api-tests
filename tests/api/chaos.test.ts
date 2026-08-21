import { test, expect } from '@playwright/test';
import { endpoints } from '../../data/testData';

const CHAOS_ENABLED = process.env.CHAOS_ENABLED === 'true';
const CHAOS_FAIL_PROBABILITY = parseFloat(process.env.CHAOS_FAIL_PROBABILITY ?? '0.2');
const CHAOS_LATENCY_MS = parseInt(process.env.CHAOS_LATENCY_MS ?? '0', 10);
const CHAOS_SEED = process.env.CHAOS_SEED ?? null;

test("GET /api/v1/doctors — 200 chaos off by default, API works normally @smoke", async ({ request }) => {
    test.skip(CHAOS_ENABLED, "Server is in chaos mode — this smoke test requires chaos OFF");
    const response = await request.get(endpoints.doctors);
    expect(response.status()).toBe(200);
});

test.describe("chaos mode — fault injection", () => {
    test.skip(!CHAOS_ENABLED, "Restart server with CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=1, then: CHAOS_ENABLED=true npx playwright test chaos.test.ts");

    test("GET /api/v1/doctors — 503 CHAOS_ERROR on every request when FAIL_PROBABILITY=1 @chaos", async ({ request }) => {
        const response = await request.get(endpoints.doctors);
        expect(response.status()).toBe(503);
        const body = await response.json();
        expect(body.errorCode).toBe("CHAOS_ERROR");
        expect(body.message).toBeTruthy();
        expect(body.requestId).toBeTruthy();
    });

    test("GET /health — 200 unaffected by chaos, mounted outside /api/v1 @chaos", async ({ request }) => {
        const response = await request.get(endpoints.health);
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.status).toBe("ok");
    });
});

test("GET /api/v1/doctors — 200 on every request when FAIL_PROBABILITY=0 @chaos", async ({ request }) => {
    test.skip(
        !CHAOS_ENABLED || CHAOS_FAIL_PROBABILITY !== 0,
        "Restart server with CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0, then: CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0 npx playwright test chaos.test.ts"
    );
    const [r1, r2, r3, r4, r5] = await Promise.all([
        request.get(endpoints.doctors),
        request.get(endpoints.doctors),
        request.get(endpoints.doctors),
        request.get(endpoints.doctors),
        request.get(endpoints.doctors),
    ]);
    expect(r1.status()).toBe(200);
    expect(r2.status()).toBe(200);
    expect(r3.status()).toBe(200);
    expect(r4.status()).toBe(200);
    expect(r5.status()).toBe(200);
});

test("GET /api/v1/doctors — mix of 200 and 503 with fixed seed and FAIL_PROBABILITY=0.5 @chaos", async ({ request }) => {
    test.skip(
        !CHAOS_ENABLED || CHAOS_SEED === null,
        "Restart server with CHAOS_ENABLED=true CHAOS_SEED=abc CHAOS_FAIL_PROBABILITY=0.5, then: CHAOS_ENABLED=true CHAOS_SEED=abc CHAOS_FAIL_PROBABILITY=0.5 npx playwright test chaos.test.ts"
    );
    const statuses: number[] = [];
    for (let i = 0; i < 20; i++) {
        const response = await request.get(endpoints.doctors);
        statuses.push(response.status());
    }
    expect(statuses).toContain(200);
    expect(statuses).toContain(503);
});

test("GET /api/v1/doctors — 200 with added delay when CHAOS_LATENCY_MS>0 @chaos", async ({ request }) => {
    test.skip(
        !CHAOS_ENABLED || CHAOS_LATENCY_MS <= 0,
        "Restart server with CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0 CHAOS_LATENCY_MS=300, then: CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0 CHAOS_LATENCY_MS=300 npx playwright test chaos.test.ts"
    );
    const start = Date.now();
    const response = await request.get(endpoints.doctors);
    const elapsed = Date.now() - start;
    expect(response.status()).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(10);
    expect(elapsed).toBeLessThan(CHAOS_LATENCY_MS + 500);
});

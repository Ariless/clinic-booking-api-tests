const { test, expect } = require("@playwright/test");
const { endpoints } = require("../../data/testData");

// Read from TEST terminal env — must match how the server was started.
// To run chaos tests: restart server with CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=1
// then run: CHAOS_ENABLED=true npx playwright test chaos.test.js
const CHAOS_ENABLED = process.env.CHAOS_ENABLED === "true";
const CHAOS_FAIL_PROBABILITY = parseFloat(process.env.CHAOS_FAIL_PROBABILITY ?? "0.2");
const CHAOS_LATENCY_MS = parseInt(process.env.CHAOS_LATENCY_MS ?? "0", 10);
const CHAOS_SEED = process.env.CHAOS_SEED ?? null;

test("GET /api/v1/doctors — 200 chaos off by default, API works normally @smoke", async ({ request }) => {
    test.skip(CHAOS_ENABLED, "Server is in chaos mode — this smoke test requires chaos OFF");
    const response = await request.get(endpoints.doctors);
    expect(response.status()).toBe(200);
});

test.describe("chaos mode — fault injection", () => {
    test.skip(!CHAOS_ENABLED, "Restart server with CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=1, then: CHAOS_ENABLED=true npx playwright test chaos.test.js");

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

// ─── Case 3: probability off-switch ─────────────────────────────────────────
// CHAOS_ENABLED=true but CHAOS_FAIL_PROBABILITY=0 → middleware runs but never fails.
// Proves the probability knob is the real switch, not CHAOS_ENABLED alone.
//
// To run:
//   CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0 npm run dev   (restart server)
//   CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0 npx playwright test chaos.test.js
test("GET /api/v1/doctors — 200 on every request when FAIL_PROBABILITY=0 @chaos", async ({ request }) => {
    test.skip(
        !CHAOS_ENABLED || CHAOS_FAIL_PROBABILITY !== 0,
        "Restart server with CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0, then: CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0 npx playwright test chaos.test.js"
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

// ─── Case 5: deterministic seed ──────────────────────────────────────────────
// CHAOS_SEED makes the RNG deterministic: same seed → same pass/fail sequence
// every time the server restarts. This is useful for reproducing a specific
// failure pattern in CI without changing FAIL_PROBABILITY.
//
// What this test proves: with a fixed seed and FAIL_PROBABILITY=0.5, the results
// are reproducible (not random noise) — the suite sees both 200 and 503.
// Exact sequence reproducibility requires two server restarts — documented, not automated.
//
// To run:
//   CHAOS_ENABLED=true CHAOS_SEED=abc CHAOS_FAIL_PROBABILITY=0.5 npm run dev
//   CHAOS_ENABLED=true CHAOS_SEED=abc CHAOS_FAIL_PROBABILITY=0.5 npx playwright test chaos.test.js
test("GET /api/v1/doctors — mix of 200 and 503 with fixed seed and FAIL_PROBABILITY=0.5 @chaos", async ({ request }) => {
    test.skip(
        !CHAOS_ENABLED || CHAOS_SEED === null,
        "Restart server with CHAOS_ENABLED=true CHAOS_SEED=abc CHAOS_FAIL_PROBABILITY=0.5, then: CHAOS_ENABLED=true CHAOS_SEED=abc CHAOS_FAIL_PROBABILITY=0.5 npx playwright test chaos.test.js"
    );
    // TODO: send N sequential requests (e.g. 20) to /api/v1/doctors
    const statuses = [];
    for (let i = 0; i < 20; i++) {
        const response = await request.get(endpoints.doctors);
        statuses.push(response.status());
    }
    expect(statuses).toContain(200);
    expect(statuses).toContain(503);
});

// ─── Case 6: latency injection ────────────────────────────────────────────────
// CHAOS_FAIL_PROBABILITY=0 so requests never fail — only latency is injected.
// Each request is delayed by a random amount between 0 and CHAOS_LATENCY_MS.
// Middleware uses: setTimeout(next, Math.floor(rng() * CHAOS_LATENCY_MS))
//
// To run:
//   CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0 CHAOS_LATENCY_MS=300 npm run dev
//   CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0 CHAOS_LATENCY_MS=300 npx playwright test chaos.test.js
test("GET /api/v1/doctors — 200 with added delay when CHAOS_LATENCY_MS>0 @chaos", async ({ request }) => {
    test.skip(
        !CHAOS_ENABLED || CHAOS_LATENCY_MS <= 0,
        "Restart server with CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0 CHAOS_LATENCY_MS=300, then: CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=0 CHAOS_LATENCY_MS=300 npx playwright test chaos.test.js"
    );
    const start = Date.now();
    const response = await request.get(endpoints.doctors);
    const elapsed = Date.now() - start;
    expect(response.status()).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(10);
    expect(elapsed).toBeLessThan(CHAOS_LATENCY_MS + 500);
});
const { test, expect } = require("@playwright/test");
const { endpoints } = require("../../data/testData");

// Read from TEST terminal env — must match how the server was started.
// To run chaos tests: restart server with CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=1
// then run: CHAOS_ENABLED=true npx playwright test chaos.test.js
const CHAOS_ENABLED = process.env.CHAOS_ENABLED === "true";

test("GET /api/v1/doctors — 200 chaos off by default, API works normally @smoke", async ({ request }) => {
    test.skip(CHAOS_ENABLED, "Server is in chaos mode — this smoke test requires chaos OFF");
    cстостоonst response = await request.get(endpoints.doctors);
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
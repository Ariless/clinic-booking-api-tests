import { test, expect } from '@playwright/test';
import { endpoints } from '../../data/testData';

test("GET /health — 200 ok, database check passes @smoke", async ({ request }) => {
    const response = await request.get(endpoints.health);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.checks.database).toBeTruthy();
});

test("GET /api/v1/error-test — 418 with structured error body @smoke", async ({ request }) => {
    const response = await request.get(endpoints.v1ErrorTest);
    expect(response.status()).toBe(418);
    const body = await response.json();
    expect(body.errorCode).toBeTruthy();
    expect(body.message).toBeTruthy();
    expect(body.requestId).toBeTruthy();
});

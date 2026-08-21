import path from 'path';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { test, expect } from '@playwright/test';

const { like, integer, eachLike } = MatchersV3;

const provider = new PactV3({
    consumer: "clinic-booking-api-tests",
    provider: "clinic-booking-api",
    logLevel: "warn",
    dir: path.resolve(__dirname, "../../../pacts"),
});

const HEADERS = {
    "Content-Type": "application/json",
    Authorization: "Bearer consumer-test-token",
};

test.describe("POST /api/v1/ai/recommend-doctor — Pact consumer @pact", () => {
    test("200: recommendation response shape @pact", async () => {
        await provider
            .uponReceiving("a POST with valid symptoms")
            .withRequest({
                method: "POST",
                path: "/api/v1/ai/recommend-doctor",
                headers: HEADERS,
                body: { symptoms: "heart palpitations" },
            })
            .willRespondWith({
                status: 200,
                body: {
                    recommendedSpecialty: like("Cardiologist"),
                    doctors: eachLike({
                        id: integer(1),
                        name: like("John Doe"),
                        specialty: like("Cardiologist"),
                    }),
                    reasoning: like("Based on the symptoms, a Cardiologist is recommended."),
                },
            })
            .executeTest(async (mockServer) => {
                const res = await fetch(`${mockServer.url}/api/v1/ai/recommend-doctor`, {
                    method: "POST",
                    headers: HEADERS,
                    body: JSON.stringify({ symptoms: "heart palpitations" }),
                });
                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body.recommendedSpecialty).toBeTruthy();
                expect(Array.isArray(body.doctors)).toBe(true);
                expect(typeof body.reasoning).toBe("string");
            });
    });

    test("400: VALIDATION_ERROR on empty symptoms @pact", async () => {
        await provider
            .uponReceiving("a POST with empty symptoms")
            .withRequest({
                method: "POST",
                path: "/api/v1/ai/recommend-doctor",
                headers: HEADERS,
                body: { symptoms: "" },
            })
            .willRespondWith({
                status: 400,
                body: {
                    errorCode: "VALIDATION_ERROR",
                    message: like("symptoms must be a non-empty string"),
                    requestId: like("req-abc123"),
                },
            })
            .executeTest(async (mockServer) => {
                const res = await fetch(`${mockServer.url}/api/v1/ai/recommend-doctor`, {
                    method: "POST",
                    headers: HEADERS,
                    body: JSON.stringify({ symptoms: "" }),
                });
                expect(res.status).toBe(400);
                const body = await res.json();
                expect(body.errorCode).toBe("VALIDATION_ERROR");
            });
    });

    test("422: UNKNOWN_SPECIALTY when symptoms cannot be mapped @pact", async () => {
        await provider
            .uponReceiving("a POST with unrecognised symptoms")
            .withRequest({
                method: "POST",
                path: "/api/v1/ai/recommend-doctor",
                headers: HEADERS,
                body: { symptoms: "xyzzy gibberish" },
            })
            .willRespondWith({
                status: 422,
                body: {
                    errorCode: "UNKNOWN_SPECIALTY",
                    message: like("Could not map symptoms to a known specialty"),
                    requestId: like("req-abc123"),
                },
            })
            .executeTest(async (mockServer) => {
                const res = await fetch(`${mockServer.url}/api/v1/ai/recommend-doctor`, {
                    method: "POST",
                    headers: HEADERS,
                    body: JSON.stringify({ symptoms: "xyzzy gibberish" }),
                });
                expect(res.status).toBe(422);
                const body = await res.json();
                expect(body.errorCode).toBe("UNKNOWN_SPECIALTY");
            });
    });
});

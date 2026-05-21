import path from 'path';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { test, expect } from '@playwright/test';

const { like } = MatchersV3;

// consumer = "clinic-booking-api" (SUT proxies to ai-service)
// provider = "ai-service"
// The test suite acts as a proxy: it sends the same requests the SUT would send.
const provider = new PactV3({
    consumer: "clinic-booking-api",
    provider: "ai-service",
    logLevel: "warn",
    dir: path.resolve(__dirname, "../../../pacts"),
});

test.describe("POST /recommend — ai-service Pact consumer @pact", () => {
    test("200: valid symptoms → ok:true + specialty + reasoning @pact", async () => {
        await provider
            .uponReceiving("a POST /recommend with valid symptoms")
            .withRequest({
                method: "POST",
                path: "/recommend",
                headers: { "Content-Type": "application/json" },
                body: { symptoms: like("heart palpitations") },
            })
            .willRespondWith({
                status: 200,
                body: {
                    ok: true,
                    specialty: like("Cardiologist"),
                    reasoning: like("Based on the reported symptoms, a Cardiologist is the most relevant specialist."),
                },
            })
            .executeTest(async (mockServer) => {
                const res = await fetch(`${mockServer.url}/recommend`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ symptoms: "heart palpitations" }),
                });
                expect(res.status).toBe(200);
                const body = await res.json() as { ok: boolean; specialty: string; reasoning: string };
                expect(body.ok).toBe(true);
                expect(typeof body.specialty).toBe("string");
                expect(typeof body.reasoning).toBe("string");
            });
    });

    test("422: unrecognised symptoms → ok:false + reason @pact", async () => {
        await provider
            .uponReceiving("a POST /recommend with unrecognised symptoms")
            .withRequest({
                method: "POST",
                path: "/recommend",
                headers: { "Content-Type": "application/json" },
                body: { symptoms: like("xyzzy gibberish") },
            })
            .willRespondWith({
                status: 422,
                body: {
                    ok: false,
                    reason: like("unknown_specialty"),
                },
            })
            .executeTest(async (mockServer) => {
                const res = await fetch(`${mockServer.url}/recommend`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ symptoms: "xyzzy gibberish" }),
                });
                expect(res.status).toBe(422);
                const body = await res.json() as { ok: boolean; reason: string };
                expect(body.ok).toBe(false);
                expect(typeof body.reason).toBe("string");
            });
    });

    test("400: empty symptoms → ok:false + validation reason @pact", async () => {
        await provider
            .uponReceiving("a POST /recommend with empty symptoms")
            .withRequest({
                method: "POST",
                path: "/recommend",
                headers: { "Content-Type": "application/json" },
                body: { symptoms: "" },
            })
            .willRespondWith({
                status: 400,
                body: {
                    ok: false,
                    reason: like("validation_error"),
                    message: like("symptoms must be a non-empty string"),
                },
            })
            .executeTest(async (mockServer) => {
                const res = await fetch(`${mockServer.url}/recommend`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ symptoms: "" }),
                });
                expect(res.status).toBe(400);
                const body = await res.json() as { ok: boolean; reason: string };
                expect(body.ok).toBe(false);
            });
    });
});

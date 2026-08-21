import path from 'path';
import fs from 'fs';
import { Verifier } from '@pact-foundation/pact';
import { test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const isMockMode = process.env.AI_MOCK_RESPONSE === 'true';
const hasRealKey = !!process.env.ANTHROPIC_API_KEY && !isMockMode;
const PACT_FILE = path.resolve(
    __dirname,
    "../../../pacts/clinic-booking-api-tests-clinic-booking-api.json"
);

test.describe("POST /api/v1/ai/recommend-doctor — Pact provider @pact", () => {
    test.beforeAll(() => {
        if (!isMockMode && !hasRealKey) test.skip();
        if (!fs.existsSync(PACT_FILE)) test.skip();
    });

    test("provider satisfies all consumer pact interactions @pact", async ({ request }) => {
        const email = `pact_provider_${Date.now()}@example.com`;

        const regRes = await request.post(`${BASE_URL}/api/v1/auth/register`, {
            data: { email, password: "password", name: "Pact Provider Test User", role: "patient" },
        });
        const { token } = await regRes.json();

        try {
            await new Verifier({
                provider: "clinic-booking-api",
                providerBaseUrl: BASE_URL,
                pactUrls: [PACT_FILE],
                logLevel: "warn",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                requestFilter: (req: any, _res: any, next: any) => {
                    req.headers["authorization"] = `Bearer ${token}`;
                    next();
                },
            }).verifyProvider();
        } finally {
            await request.delete(`${BASE_URL}/api/v1/auth/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
        }
    });
});

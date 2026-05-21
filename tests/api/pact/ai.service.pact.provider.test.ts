import path from 'path';
import fs from 'fs';
import { Verifier } from '@pact-foundation/pact';
import { test } from '@playwright/test';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3001';
const PACT_FILE = path.resolve(
    __dirname,
    "../../../pacts/clinic-booking-api-ai-service.json"
);

async function isAiServiceReachable(): Promise<boolean> {
    try {
        const res = await fetch(`${AI_SERVICE_URL}/health`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}

// Verifies that the real ai-service satisfies the contract defined by the
// clinic-booking-api consumer pact. Run with AI_MOCK_RESPONSE=true on the
// ai-service to avoid real Claude API calls.
// Skip automatically when ai-service is not running (e.g. in default CI).
test.describe("POST /recommend — ai-service Pact provider @pact", () => {
    test.beforeAll(async () => {
        if (!fs.existsSync(PACT_FILE)) test.skip();
        if (!(await isAiServiceReachable())) test.skip();
    });

    test("ai-service satisfies clinic-booking-api consumer pact @pact", async () => {
        await new Verifier({
            provider: "ai-service",
            providerBaseUrl: AI_SERVICE_URL,
            pactUrls: [PACT_FILE],
            logLevel: "warn",
        }).verifyProvider();
    });
});

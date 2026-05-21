import path from 'path';
import fs from 'fs';
import { Verifier } from '@pact-foundation/pact';
import { test } from '@playwright/test';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3001';
const PACT_FILE = path.resolve(
    __dirname,
    "../../../pacts/clinic-booking-api-ai-service.json"
);

// Verifies that the real ai-service satisfies the contract defined by the
// clinic-booking-api consumer pact. Run with AI_MOCK_RESPONSE=true on the
// ai-service to avoid real Claude API calls.
test.describe("POST /recommend — ai-service Pact provider @pact", () => {
    test.beforeAll(() => {
        if (!fs.existsSync(PACT_FILE)) test.skip();
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

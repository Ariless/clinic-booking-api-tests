// Demonstrates the AI bug reporter: run with DEMO_BUG_REPORTER=true to trigger a
// controlled failure and see the generated Allure attachment + bug-reports/ file.
//
// Usage:
//   DEMO_BUG_REPORTER=true npx playwright test bug-reporter.demo

import { test, expect } from '../../fixtures';
import { attachBugReport } from '../../utils/aiBugReporter';

test.describe("AI bug reporter demo @unit", () => {
    test.beforeEach(() => {
        if (!process.env.DEMO_BUG_REPORTER) test.skip();
    });

    test.afterEach(async ({}, testInfo) => {
        await attachBugReport(testInfo);
    });

    test("POST /appointments — booking returns wrong status @unit", async () => {
        const apiResponse = { status: "pending", appointmentId: 42 };
        expect(apiResponse.status).toBe("confirmed");
    });

    test("GET /api/v1/doctors — response missing required field 'specialisation' @unit", async () => {
        const doctor = { id: 1, name: "John Doe" };
        expect(doctor).toHaveProperty("specialisation");
    });
});

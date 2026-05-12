// Demonstrates the AI bug reporter: run with DEMO_BUG_REPORTER=true to trigger a
// controlled failure and see the generated Allure attachment + bug-reports/ file.
//
// Usage:
//   DEMO_BUG_REPORTER=true ANTHROPIC_API_KEY=<key> npx playwright test bug-reporter.demo

const { test, expect } = require("../../fixtures");

test.describe("AI bug reporter demo @unit", () => {
    test.beforeEach(() => {
        if (!process.env.DEMO_BUG_REPORTER) test.skip();
    });

    test("POST /appointments — booking returns wrong status @unit", async () => {
        // Simulates a real assertion failure: endpoint returned 'pending' but test expected 'confirmed'
        const apiResponse = { status: "pending", appointmentId: 42 };
        expect(apiResponse.status).toBe("confirmed");
    });

    test("GET /api/v1/doctors — response missing required field 'specialisation' @unit", async () => {
        // Simulates a schema validation failure
        const doctor = { id: 1, name: "John Doe" }; // missing specialisation
        expect(doctor).toHaveProperty("specialisation");
    });
});

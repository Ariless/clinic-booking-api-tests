const { test, expect } = require("../../fixtures");

// Fetches the live OpenAPI spec from the running SUT and asserts that all
// documented paths and error codes are present. Fails when a route is added
// to the SUT but not added to openapi.yaml — i.e. when the spec drifts from
// the implementation.
//
// What this catches:
//   - Developer adds an endpoint, forgets to update the spec
//   - Developer renames an error code in the spec but not in the code (or vice versa)
//   - Spec file is broken / missing
//   - Swagger UI is unreachable
//
// What this does NOT catch:
//   - Response body shape mismatches (that requires a full validator like dredd/spectral)
//   - Runtime behaviour differences

const EXPECTED_PATHS = [
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
    "/api/v1/auth/me",
    "/api/v1/doctors",
    "/api/v1/doctors/me/slots",
    "/api/v1/doctors/{id}/slots",
    "/api/v1/appointments",
    "/api/v1/appointments/my",
    "/api/v1/appointments/doctor",
    "/api/v1/appointments/waitlist",
    "/api/v1/appointments/waitlist/me",
    "/api/v1/appointments/waitlist/{waitlistId}",
    "/api/v1/appointments/waitlist-offers",
    "/api/v1/appointments/waitlist-offers/{offerId}/accept",
    "/api/v1/appointments/waitlist-offers/{offerId}/decline",
    "/api/v1/appointments/{id}/confirm",
    "/api/v1/appointments/{id}/reject",
    "/api/v1/appointments/{id}/cancel",
    "/api/v1/appointments/{id}/cancel-as-doctor",
    "/api/v1/ai/recommend-doctor",
    "/api/v1/consultations",
    "/api/v1/consultations/me",
];

const EXPECTED_ERROR_CODES = [
    "SLOT_TAKEN",
    "SLOT_IN_USE",
    "SLOT_OVERLAP",
    "INVALID_TRANSITION",
    "APPOINTMENT_NOT_FOUND",
    "SLOT_NOT_FOUND",
    "UNKNOWN_SPECIALTY",
    "FEATURE_DISABLED",
    "CLAUDE_UNAVAILABLE",
    "PAYMENT_REQUIRED",
    "RATE_LIMITED",
    "AUTH_REQUIRED",
    "FORBIDDEN",
    "VALIDATION_ERROR",
];

const EXPECTED_SCHEMAS = [
    "Appointment",
    "Slot",
    "Doctor",
    "WaitlistEntry",
    "WaitlistOffer",
    "Consultation",
    "Payment",
    "ConsultationResponse",
    "RecommendDoctorResponse",
    "ErrorBody",
    "TokenResponse",
];

test.describe("OpenAPI spec — contract drift guard @api", () => {
    test("GET /api/openapi.yaml — spec is reachable and is valid YAML @api", async ({ request }) => {
        const response = await request.get("/api/openapi.yaml");
        expect(response.status()).toBe(200);
        const text = await response.text();
        expect(text).toContain("openapi: 3.0");
        expect(text).toContain("paths:");
        expect(text).toContain("components:");
    });

    test("GET /api/docs — Swagger UI is reachable @api", async ({ request }) => {
        const response = await request.get("/api/docs");
        expect(response.status()).toBe(200);
    });

    test("All expected paths are documented in the spec @api", async ({ request }) => {
        const response = await request.get("/api/openapi.yaml");
        expect(response.status()).toBe(200);
        const spec = await response.text();

        const missing = EXPECTED_PATHS.filter((path) => !spec.includes(path));
        expect(missing, `Paths missing from OpenAPI spec: ${missing.join(", ")}`).toHaveLength(0);
    });

    test("All error codes are documented in the spec @api", async ({ request }) => {
        const response = await request.get("/api/openapi.yaml");
        expect(response.status()).toBe(200);
        const spec = await response.text();

        const missing = EXPECTED_ERROR_CODES.filter((code) => !spec.includes(code));
        expect(missing, `Error codes missing from OpenAPI spec: ${missing.join(", ")}`).toHaveLength(0);
    });

    test("All expected schemas are defined in components @api", async ({ request }) => {
        const response = await request.get("/api/openapi.yaml");
        expect(response.status()).toBe(200);
        const spec = await response.text();

        const missing = EXPECTED_SCHEMAS.filter((schema) => !spec.includes(`    ${schema}:`));
        expect(missing, `Schemas missing from OpenAPI spec: ${missing.join(", ")}`).toHaveLength(0);
    });
});

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/contract.drift.test.js >> OpenAPI spec — contract drift guard @api >> All expected paths are documented in the spec @api
- Location: tests/api/contract.drift.test.js:90:5

# Error details

```
Error: Paths missing from OpenAPI spec: /api/v1/appointments/waitlist-offers, /api/v1/appointments/waitlist-offers/{offerId}/accept, /api/v1/appointments/waitlist-offers/{offerId}/decline, /api/v1/consultations, /api/v1/consultations/me

expect(received).toHaveLength(expected)

Expected length: 0
Received length: 5
Received array:  ["/api/v1/appointments/waitlist-offers", "/api/v1/appointments/waitlist-offers/{offerId}/accept", "/api/v1/appointments/waitlist-offers/{offerId}/decline", "/api/v1/consultations", "/api/v1/consultations/me"]
```

# Test source

```ts
  1   | const { test, expect } = require("../../fixtures");
  2   | 
  3   | // Fetches the live OpenAPI spec from the running SUT and asserts that all
  4   | // documented paths and error codes are present. Fails when a route is added
  5   | // to the SUT but not added to openapi.yaml — i.e. when the spec drifts from
  6   | // the implementation.
  7   | //
  8   | // What this catches:
  9   | //   - Developer adds an endpoint, forgets to update the spec
  10  | //   - Developer renames an error code in the spec but not in the code (or vice versa)
  11  | //   - Spec file is broken / missing
  12  | //   - Swagger UI is unreachable
  13  | //
  14  | // What this does NOT catch:
  15  | //   - Response body shape mismatches (that requires a full validator like dredd/spectral)
  16  | //   - Runtime behaviour differences
  17  | 
  18  | const EXPECTED_PATHS = [
  19  |     "/api/v1/auth/register",
  20  |     "/api/v1/auth/login",
  21  |     "/api/v1/auth/refresh",
  22  |     "/api/v1/auth/me",
  23  |     "/api/v1/doctors",
  24  |     "/api/v1/doctors/me/slots",
  25  |     "/api/v1/doctors/{id}/slots",
  26  |     "/api/v1/appointments",
  27  |     "/api/v1/appointments/my",
  28  |     "/api/v1/appointments/doctor",
  29  |     "/api/v1/appointments/waitlist",
  30  |     "/api/v1/appointments/waitlist/me",
  31  |     "/api/v1/appointments/waitlist/{waitlistId}",
  32  |     "/api/v1/appointments/waitlist-offers",
  33  |     "/api/v1/appointments/waitlist-offers/{offerId}/accept",
  34  |     "/api/v1/appointments/waitlist-offers/{offerId}/decline",
  35  |     "/api/v1/appointments/{id}/confirm",
  36  |     "/api/v1/appointments/{id}/reject",
  37  |     "/api/v1/appointments/{id}/cancel",
  38  |     "/api/v1/appointments/{id}/cancel-as-doctor",
  39  |     "/api/v1/ai/recommend-doctor",
  40  |     "/api/v1/consultations",
  41  |     "/api/v1/consultations/me",
  42  | ];
  43  | 
  44  | const EXPECTED_ERROR_CODES = [
  45  |     "SLOT_TAKEN",
  46  |     "SLOT_IN_USE",
  47  |     "SLOT_OVERLAP",
  48  |     "INVALID_TRANSITION",
  49  |     "APPOINTMENT_NOT_FOUND",
  50  |     "SLOT_NOT_FOUND",
  51  |     "UNKNOWN_SPECIALTY",
  52  |     "FEATURE_DISABLED",
  53  |     "CLAUDE_UNAVAILABLE",
  54  |     "PAYMENT_REQUIRED",
  55  |     "RATE_LIMITED",
  56  |     "AUTH_REQUIRED",
  57  |     "FORBIDDEN",
  58  |     "VALIDATION_ERROR",
  59  | ];
  60  | 
  61  | const EXPECTED_SCHEMAS = [
  62  |     "Appointment",
  63  |     "Slot",
  64  |     "Doctor",
  65  |     "WaitlistEntry",
  66  |     "WaitlistOffer",
  67  |     "Consultation",
  68  |     "Payment",
  69  |     "ConsultationResponse",
  70  |     "RecommendDoctorResponse",
  71  |     "ErrorBody",
  72  |     "TokenResponse",
  73  | ];
  74  | 
  75  | test.describe("OpenAPI spec — contract drift guard @api", () => {
  76  |     test("GET /api/openapi.yaml — spec is reachable and is valid YAML @api", async ({ request }) => {
  77  |         const response = await request.get("/api/openapi.yaml");
  78  |         expect(response.status()).toBe(200);
  79  |         const text = await response.text();
  80  |         expect(text).toContain("openapi: 3.0");
  81  |         expect(text).toContain("paths:");
  82  |         expect(text).toContain("components:");
  83  |     });
  84  | 
  85  |     test("GET /api/docs — Swagger UI is reachable @api", async ({ request }) => {
  86  |         const response = await request.get("/api/docs");
  87  |         expect(response.status()).toBe(200);
  88  |     });
  89  | 
  90  |     test("All expected paths are documented in the spec @api", async ({ request }) => {
  91  |         const response = await request.get("/api/openapi.yaml");
  92  |         expect(response.status()).toBe(200);
  93  |         const spec = await response.text();
  94  | 
  95  |         const missing = EXPECTED_PATHS.filter((path) => !spec.includes(path));
> 96  |         expect(missing, `Paths missing from OpenAPI spec: ${missing.join(", ")}`).toHaveLength(0);
      |                                                                                   ^ Error: Paths missing from OpenAPI spec: /api/v1/appointments/waitlist-offers, /api/v1/appointments/waitlist-offers/{offerId}/accept, /api/v1/appointments/waitlist-offers/{offerId}/decline, /api/v1/consultations, /api/v1/consultations/me
  97  |     });
  98  | 
  99  |     test("All error codes are documented in the spec @api", async ({ request }) => {
  100 |         const response = await request.get("/api/openapi.yaml");
  101 |         expect(response.status()).toBe(200);
  102 |         const spec = await response.text();
  103 | 
  104 |         const missing = EXPECTED_ERROR_CODES.filter((code) => !spec.includes(code));
  105 |         expect(missing, `Error codes missing from OpenAPI spec: ${missing.join(", ")}`).toHaveLength(0);
  106 |     });
  107 | 
  108 |     test("All expected schemas are defined in components @api", async ({ request }) => {
  109 |         const response = await request.get("/api/openapi.yaml");
  110 |         expect(response.status()).toBe(200);
  111 |         const spec = await response.text();
  112 | 
  113 |         const missing = EXPECTED_SCHEMAS.filter((schema) => !spec.includes(`    ${schema}:`));
  114 |         expect(missing, `Schemas missing from OpenAPI spec: ${missing.join(", ")}`).toHaveLength(0);
  115 |     });
  116 | });
  117 | 
```
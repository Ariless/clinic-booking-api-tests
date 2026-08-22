# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/contract.drift.test.ts >> OpenAPI spec — contract drift guard @api >> Slot.isAvailable — the type the spec declares is the type the API sends @api
- Location: tests/api/contract.drift.test.ts:114:9

# Error details

```
Error: the response side of the slot contract must stay boolean

expect(received).toBe(expected) // Object.is equality

Expected: "boolean"
Received: "integer"
```

# Test source

```ts
  22  |     "/api/v1/appointments/waitlist",
  23  |     "/api/v1/appointments/waitlist/me",
  24  |     "/api/v1/appointments/waitlist/{waitlistId}",
  25  |     "/api/v1/appointments/waitlist-offers",
  26  |     "/api/v1/appointments/waitlist-offers/{offerId}/accept",
  27  |     "/api/v1/appointments/waitlist-offers/{offerId}/decline",
  28  |     "/api/v1/appointments/{id}/confirm",
  29  |     "/api/v1/appointments/{id}/reject",
  30  |     "/api/v1/appointments/{id}/cancel",
  31  |     "/api/v1/appointments/{id}/cancel-as-doctor",
  32  |     "/api/v1/ai/recommend-doctor",
  33  |     "/api/v1/consultations",
  34  |     "/api/v1/consultations/me",
  35  | ];
  36  | 
  37  | const EXPECTED_ERROR_CODES = [
  38  |     "SLOT_TAKEN",
  39  |     "SLOT_IN_USE",
  40  |     "SLOT_OVERLAP",
  41  |     "INVALID_TRANSITION",
  42  |     "APPOINTMENT_NOT_FOUND",
  43  |     "SLOT_NOT_FOUND",
  44  |     "UNKNOWN_SPECIALTY",
  45  |     "FEATURE_DISABLED",
  46  |     "CLAUDE_UNAVAILABLE",
  47  |     "PAYMENT_REQUIRED",
  48  |     "RATE_LIMITED",
  49  |     "AUTH_REQUIRED",
  50  |     "FORBIDDEN",
  51  |     "VALIDATION_ERROR",
  52  | ];
  53  | 
  54  | const EXPECTED_SCHEMAS = [
  55  |     "Appointment",
  56  |     "Slot",
  57  |     "Doctor",
  58  |     "WaitlistEntry",
  59  |     "WaitlistOffer",
  60  |     "Consultation",
  61  |     "Payment",
  62  |     "ConsultationResponse",
  63  |     "RecommendDoctorResponse",
  64  |     "ErrorBody",
  65  |     "TokenResponse",
  66  | ];
  67  | 
  68  | test.describe("OpenAPI spec — contract drift guard @api", () => {
  69  |     test("GET /api/openapi.yaml — spec is reachable and is valid YAML @api", async ({ request }) => {
  70  |         const response = await request.get("/api/openapi.yaml");
  71  |         expect(response.status()).toBe(200);
  72  |         const text = await response.text();
  73  |         expect(text).toContain("openapi: 3.0");
  74  |         expect(text).toContain("paths:");
  75  |         expect(text).toContain("components:");
  76  |     });
  77  | 
  78  |     test("GET /api/docs — Swagger UI is reachable @api", async ({ request }) => {
  79  |         const response = await request.get("/api/docs");
  80  |         expect(response.status()).toBe(200);
  81  |     });
  82  | 
  83  |     test("All expected paths are documented in the spec @api", async ({ request }) => {
  84  |         const response = await request.get("/api/openapi.yaml");
  85  |         expect(response.status()).toBe(200);
  86  |         const spec = await response.text();
  87  | 
  88  |         const missing = EXPECTED_PATHS.filter((path) => !spec.includes(path));
  89  |         expect(missing, `Paths missing from OpenAPI spec: ${missing.join(", ")}`).toHaveLength(0);
  90  |     });
  91  | 
  92  |     test("All error codes are documented in the spec @api", async ({ request }) => {
  93  |         const response = await request.get("/api/openapi.yaml");
  94  |         expect(response.status()).toBe(200);
  95  |         const spec = await response.text();
  96  | 
  97  |         const missing = EXPECTED_ERROR_CODES.filter((code) => !spec.includes(code));
  98  |         expect(missing, `Error codes missing from OpenAPI spec: ${missing.join(", ")}`).toHaveLength(0);
  99  |     });
  100 | 
  101 |     test("All expected schemas are defined in components @api", async ({ request }) => {
  102 |         const response = await request.get("/api/openapi.yaml");
  103 |         expect(response.status()).toBe(200);
  104 |         const spec = await response.text();
  105 | 
  106 |         const missing = EXPECTED_SCHEMAS.filter((schema) => !spec.includes(`    ${schema}:`));
  107 |         expect(missing, `Schemas missing from OpenAPI spec: ${missing.join(", ")}`).toHaveLength(0);
  108 |     });
  109 | 
  110 |     // B-15 (2026-08-22): the response side declared `integer` with the description "SQLite stores
  111 |     // 0/1" while every consumer treated the field as boolean, and no scenario test could see the
  112 |     // difference because `1` is truthy. This checks both halves at once — what the spec promises
  113 |     // and what the API actually sends — so the type cannot drift back on either side.
  114 |     test("Slot.isAvailable — the type the spec declares is the type the API sends @api", async ({ request, slot }) => {
  115 |         const response = await request.get("/api/openapi.yaml");
  116 |         expect(response.status()).toBe(200);
  117 |         const spec = await response.text();
  118 | 
  119 |         const slotSchema = spec.slice(spec.indexOf("\n    Slot:"));
  120 |         const declared = /isAvailable:\s*\n\s*type:\s*(\w+)/.exec(slotSchema)?.[1];
  121 |         expect(declared, "Slot.isAvailable has no declared type in the spec").toBeTruthy();
> 122 |         expect(declared, "the response side of the slot contract must stay boolean").toBe("boolean");
      |                                                                                      ^ Error: the response side of the slot contract must stay boolean
  123 | 
  124 |         const doctors = new DoctorsClient(request);
  125 |         const { status, body } = await doctors.listPublicSlots(slot.doctor.doctorRecordId);
  126 |         expect(status).toBe(200);
  127 | 
  128 |         const listed = (body as Record<string, unknown>[]).find((row) => row.id === slot.slot.id);
  129 |         expect(listed, `slot ${slot.slot.id} not listed for doctor ${slot.doctor.doctorRecordId}`).toBeTruthy();
  130 |         expect(typeof listed!.isAvailable, "API sent isAvailable as something other than a boolean").toBe("boolean");
  131 |     });
  132 | });
  133 | 
  134 | test.describe("Response shape — live drift guard @api", () => {
  135 |     test("POST /api/v1/auth/login — response matches TokenResponse shape", async ({ request }) => {
  136 |         const auth = new AuthClient(request);
  137 |         const { status, body } = await auth.verifyLogin(seedPatient.email, seedPatient.password);
  138 |         expect(status).toBe(200);
  139 |         assertSchema(body, validateTokenResponse, 'TokenResponse');
  140 |     });
  141 | 
  142 |     test("GET /api/v1/doctors — response matches Doctor shape", async ({ request }) => {
  143 |         const doctors = new DoctorsClient(request);
  144 |         const { status, body } = await doctors.list();
  145 |         expect(status).toBe(200);
  146 |         assertSchema(body, validateDoctorsList, 'DoctorsList');
  147 |     });
  148 | 
  149 |     test("POST /api/v1/appointments — response matches Appointment shape", async ({ user, slot, request }) => {
  150 |         const appts = new AppointmentsClient(request);
  151 |         const { status, body } = await appts.createAppointment(
  152 |             slot.slot.id,
  153 |             { headers: { Authorization: `Bearer ${user.token}` } },
  154 |         );
  155 |         expect(status).toBe(201);
  156 |         assertSchema(body, validateAppointment, 'Appointment');
  157 |     });
  158 | 
  159 |     test("GET /api/v1/appointments/my — response matches AppointmentList shape", async ({ user, request }) => {
  160 |         const appts = new AppointmentsClient(request);
  161 |         const { status, body } = await appts.listMy({ headers: { Authorization: `Bearer ${user.token}` } });
  162 |         expect(status).toBe(200);
  163 |         assertSchema(body, validateAppointmentList, 'AppointmentList');
  164 |     });
  165 | });
  166 | 
```
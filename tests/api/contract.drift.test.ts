import { test, expect } from '../../fixtures';
import { AuthClient } from '../../api/AuthClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { seedPatient } from '../../data/seedAccounts';
import { assertSchema } from '../../utils/schemaValidator';
import { validateTokenResponse } from '../../data/schemas/authSchemas';
import { validateDoctorsList } from '../../data/schemas/doctorsSchemas';
import { validateAppointment, validateAppointmentList } from '../../data/schemas/appointmentSchemas';

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
    "/api/v1/ai/circuit-state",
    "/api/v1/consultations",
    "/api/v1/consultations/me",
];

const EXPECTED_ERROR_CODES = [
    "METHOD_NOT_ALLOWED",
    "SLOT_TAKEN",
    "SLOT_IN_USE",
    "SLOT_OVERLAP",
    "INVALID_TRANSITION",
    "APPOINTMENT_NOT_FOUND",
    "SLOT_NOT_FOUND",
    "UNKNOWN_SPECIALTY",
    "FEATURE_DISABLED",
    "CLAUDE_UNAVAILABLE",
    // Both added to the guard 2026-08-27. AI_SERVICE_UNAVAILABLE had been answerable since
    // 2026-08-21 and CIRCUIT_OPEN since the breaker was written; neither was in the spec, so this
    // list could not have caught their absence — it only guards what it already knows about.
    "AI_SERVICE_UNAVAILABLE",
    "CIRCUIT_OPEN",
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
    "CircuitState",
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

    // B-15 (2026-08-22): the response side declared `integer` with the description "SQLite stores
    // 0/1" while every consumer treated the field as boolean, and no scenario test could see the
    // difference because `1` is truthy. This checks both halves at once — what the spec promises
    // and what the API actually sends — so the type cannot drift back on either side.
    test("Slot.isAvailable — the type the spec declares is the type the API sends @api", async ({ request, slot }) => {
        const response = await request.get("/api/openapi.yaml");
        expect(response.status()).toBe(200);
        const spec = await response.text();

        const slotSchema = spec.slice(spec.indexOf("\n    Slot:"));
        const declared = /isAvailable:\s*\n\s*type:\s*(\w+)/.exec(slotSchema)?.[1];
        expect(declared, "Slot.isAvailable has no declared type in the spec").toBeTruthy();
        expect(declared, "the response side of the slot contract must stay boolean").toBe("boolean");

        const doctors = new DoctorsClient(request);
        const { status, body } = await doctors.listPublicSlots(slot.doctor.doctorRecordId);
        expect(status).toBe(200);

        const listed = (body as Record<string, unknown>[]).find((row) => row.id === slot.slot.id);
        expect(listed, `slot ${slot.slot.id} not listed for doctor ${slot.doctor.doctorRecordId}`).toBeTruthy();
        expect(typeof listed!.isAvailable, "API sent isAvailable as something other than a boolean").toBe("boolean");
    });
});

test.describe("Response shape — live drift guard @api", () => {
    test("POST /api/v1/auth/login — response matches TokenResponse shape", async ({ request }) => {
        const auth = new AuthClient(request);
        const { status, body } = await auth.verifyLogin(seedPatient.email, seedPatient.password);
        expect(status).toBe(200);
        assertSchema(body, validateTokenResponse, 'TokenResponse');
    });

    test("GET /api/v1/doctors — response matches Doctor shape", async ({ request }) => {
        const doctors = new DoctorsClient(request);
        const { status, body } = await doctors.list();
        expect(status).toBe(200);
        assertSchema(body, validateDoctorsList, 'DoctorsList');
    });

    test("POST /api/v1/appointments — response matches Appointment shape", async ({ user, slot, request }) => {
        const appts = new AppointmentsClient(request);
        const { status, body } = await appts.createAppointment(
            slot.slot.id,
            { headers: { Authorization: `Bearer ${user.token}` } },
        );
        expect(status).toBe(201);
        assertSchema(body, validateAppointment, 'Appointment');
    });

    test("GET /api/v1/appointments/my — response matches AppointmentList shape", async ({ user, request }) => {
        const appts = new AppointmentsClient(request);
        const { status, body } = await appts.listMy({ headers: { Authorization: `Bearer ${user.token}` } });
        expect(status).toBe(200);
        assertSchema(body, validateAppointmentList, 'AppointmentList');
    });
});

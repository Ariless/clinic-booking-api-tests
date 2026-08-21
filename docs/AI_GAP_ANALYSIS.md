# AI Gap Analysis — clinic-booking-api-tests

> **Generated:** 2026-08-21
> **Model:** claude-haiku-4-5-20251001
> **Source:** openapi.yaml (38 operations) + the tests/ suite
> **How to regenerate:** `npm run ai:gap-analysis` (key comes from `.env`)

---

# QA Coverage Gap Analysis: Clinic Booking API

## 1. Coverage Summary

| Metric | Count |
|--------|-------|
| **Total endpoints** | 37 |
| **Documented error codes** | 68 |
| **Endpoints with ≥1 test** | 31 |
| **Endpoints with zero tests** | 6 |
| **Test files** | 68 |
| **Total test cases** | 350+ |

---

## 2. Endpoints with No Test Coverage

| Method | Path | Documented Status Codes | Risk |
|--------|------|------------------------|------|
| GET | `/api/v1` | 200 | Low |
| GET | `/metrics` | 200 | Low |
| GET | `/api/v1/doctors/{id}` | 200, 404 | Medium |
| POST | `/api/v1/doctors/{id}/slots` | 201, 400, 401, 403, 404, 409 | High |
| DELETE | `/api/v1/doctors/me/slots/{slotId}` | 204, 400, 401, 403, 404, 409 | High |
| GET | `/api/v1/appointments/{id}` | 200, 400, 404 | Medium |

---

## 3. Error Codes Not Exercised

| Endpoint | Status | Error Condition | Priority |
|----------|--------|-----------------|----------|
| `GET /api/v1/doctors/{id}` | 404 | Doctor not found | Medium |
| `POST /api/v1/doctors/{id}/slots` | 401 | Missing or invalid JWT | High |
| `POST /api/v1/doctors/{id}/slots` | 403 | Not owner doctor | High |
| `POST /api/v1/doctors/{id}/slots` | 404 | Doctor not found | Medium |
| `POST /api/v1/doctors/{id}/slots` | 409 | SLOT_OVERLAP | High |
| `DELETE /api/v1/doctors/me/slots/{slotId}` | 401 | Missing or invalid JWT | High |
| `DELETE /api/v1/doctors/me/slots/{slotId}` | 403 | Not owner doctor | High |
| `DELETE /api/v1/doctors/me/slots/{slotId}` | 404 | SLOT_NOT_FOUND | Medium |
| `DELETE /api/v1/doctors/me/slots/{slotId}` | 409 | SLOT_IN_USE (has pending appointments) | High |
| `GET /api/v1/appointments/{id}` | 400 | Invalid id | Medium |
| `GET /api/v1/appointments/{id}` | 404 | Appointment not found | Medium |
| `POST /api/v1/auth/refresh` | 400 | Validation error | Medium |
| `POST /api/v1/auth/refresh` | 401 | Invalid or expired refresh token | High |
| `POST /api/v1/auth/register` | 400 | VALIDATION_ERROR (empty email/password too short) | High |
| `POST /api/v1/auth/register` | 404 | DOCTOR_NOT_FOUND (registration with missing doctorRecordId) | High |
| `POST /api/v1/consultations` | 400 | Validation error | Medium |
| `GET /api/v1/appointments/waitlist-offers` | 401 | Not authenticated | High |
| `GET /api/v1/doctors/me/slots` | 401 | Missing or invalid JWT | High |
| `GET /api/v1/doctors/me/slots` | 403 | Not a doctor or profile not linked | High |

---

## 4. Additional Test Scenarios Worth Adding

| Area | Scenario | Rationale |
|------|----------|-----------|
| **Slot management** | POST `/doctors/{id}/slots` with invalid auth, same-doctor overlap detection | Authorization boundary; prevents double-booking logic bugs |
| **Slot management** | DELETE `/doctors/me/slots/{slotId}` when slot has confirmed appointment (409 SLOT_IN_USE) | Enforces data consistency—confirmed visits cannot be orphaned |
| **Slot management** | DELETE `/doctors/me/slots/{slotId}` by non-owner doctor (403) | RBAC cross-doctor isolation; currently untested |
| **Doctor lookup** | GET `/doctors/{id}` with invalid id, non-existent id | Basic CRUD robustness; error shape validation |
| **Appointment read** | GET `/appointments/{id}` as unauthenticated caller; by different patient | Authorization and read isolation; similar to security.test.ts but missing this endpoint |
| **Token refresh** | POST `/auth/refresh` with malformed refresh token, expired token, wrong JWT structure | Auth boundary; session lifecycle critical path |
| **Refresh token** | POST `/auth/refresh` then use old access token (should 401) | Token rotation atomicity; prevents accidental dual-validity |
| **Slot overlap** | POST `/doctors/me/slots` with second slot overlapping first (same doctor, same time window) | Transactional integrity; 409 SLOT_OVERLAP validation |
| **Concurrent slot delete** | Two DELETE `/doctors/me/slots/{slotId}` for same slot simultaneously | Concurrency; one should 404, one should 204 |
| **Offer edge cases** | POST `/waitlist-offers/{offerId}/accept` after offer already declined (410 or 404) | State machine completeness; declined offers must be terminal |
| **Consultation booking** | POST `/consultations` with idempotency key but mismatched request body | Idempotency semantics; should reject or enforce same body |
| **Content validation** | POST `/auth/register` with extremely long name (119 chars should pass, 120 should fail) | Boundary testing; limit enforcement |
| **Spec metadata** | GET `/api/v1` and verify response includes service name, version, environment | Contract compliance; SUT self-description |
| **Metrics endpoint** | GET `/metrics` and verify JSON structure (counters, ratios) | Observability baseline; smoke test for metrics schema |
| **Health cascade** | GET `/health` response when database is reachable but optional AI check fails (`status: degraded` + 200) | Graceful degradation smoke test; documented in 503 case but 200 case untested |

---

## 5. What Is Well Covered

- **Appointment state machine and transitions:** All major status flows (pending → confirmed → completed, cancellation, rejection, reschedule) are thoroughly tested across `api/appointments.*.test.ts` files, including RBAC boundaries and waitlist promotion on slot freedom.

- **Authentication lifecycle:** Registration, login, token refresh, and account deletion are comprehensively covered with error cases (EMAIL_TAKEN, EMAIL_RETIRED, invalid credentials, missing tokens) in `api/auth.*.test.ts`.

- **AI recommendation endpoint:** Robust coverage spanning happy path (200), validation errors (400), unknown specialty (422), rate limiting (429), and feature degradation (503), plus specialized LLM eval and bias testing in `api/ai.recommend.test.ts`.

- **Waitlist and offer mechanics:** Join, list, accept, decline, expiry, and promotion flows are well exercised, including idempotency on offer acceptance and concurrent promotion in `api/appointments.waitlist*.test.ts`.

- **Cross-layer and E2E validation:** Appointment booking, confirmation, cancellation, and notifications are verified end-to-end through UI, API, and database layers, ensuring consistency across integration points (`e2e/*.test.ts`).

- **Booking conflict and concurrency:** Race conditions on appointment cancellation, slot booking, and waitlist promotion are explicitly tested, confirming atomic state transitions and prevent double-booking (`api/concurrency/*.test.ts`).

- **Pagination and filtering:** Appointment list endpoints support validated pagination (page, limit) and filtering (status, doctorId, date range) with boundary tests for invalid params in `api/appointments.pagination.test.ts` and `api/appointments.filter.test.ts`.

---

## Recommended Priority Actions

1. **High urgency:** Add tests for `/doctors/{id}/slots` POST (slot overlap, auth boundary) and DELETE (slot in use, RBAC) to prevent double-booking and orphaned confirmations.
2. **High urgency:** Cover `/auth/refresh` with expired/malformed token cases to ensure session lifecycle robustness.
3. **Medium urgency:** Test `GET /doctors/{id}` and `GET /appointments/{id}` for basic CRUD robustness and error shape consistency.
4. **Medium urgency:** Validate concurrent slot deletion and offer state transitions (already-declined acceptance attempt).

---

*This document is generated by AI and reviewed by a human before use. The model identifies structural gaps from names and spec only — it does not run tests or read test bodies.*

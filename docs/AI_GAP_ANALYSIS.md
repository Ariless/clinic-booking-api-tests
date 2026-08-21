# AI Gap Analysis — clinic-booking-api-tests

> **Generated:** 2026-05-09
> **Model:** claude-sonnet-4-6 (manual run; regenerate with `ANTHROPIC_API_KEY=<key> npm run ai:gap-analysis` when credits available)
> **Source:** `sut/openapi/openapi.yaml` (35 operations) + 43 test files
> **How to regenerate:** `ANTHROPIC_API_KEY=<key> npm run ai:gap-analysis`

---

## 1. Coverage summary

| Metric | Count |
|--------|-------|
| Endpoints in spec | 35 |
| Documented status codes (total) | ~110 |
| Endpoints with at least one dedicated test | 22 |
| Endpoints with zero dedicated tests | 13 |
| Status codes with at least one test | ~55 |
| Status codes never exercised | ~55 |

---

## 2. Endpoints with no test coverage

These endpoints have no test file that directly calls them. Some are used implicitly in test setup/teardown but are never asserted against.

| Method | Path | Documented status codes | Risk |
|--------|------|-------------------------|------|
| GET | `/api/v1` | 200 | Low |
| GET | `/metrics` | 200 | Low |
| POST | `/api/v1/auth/refresh` | 200, 400, 401 | **High** |
| GET | `/api/v1/doctors/me/slots` | 200, 401, 403 | Medium |
| POST | `/api/v1/doctors/me/slots` | 201, 400, 401, 403, 404, 409 | **High** |
| DELETE | `/api/v1/doctors/me/slots/{slotId}` | 204, 400, 401, 403, 404, 409 | **High** |
| GET | `/api/v1/doctors/{id}` | 200, 404 | Medium |
| GET | `/api/v1/doctors/{id}/slots` | 200, 400, 404 | Medium |
| POST | `/api/v1/doctors/{id}/slots` | 201, 400, 401, 403, 404, 409 | **High** |
| PATCH | `/api/v1/appointments/{id}/reschedule` | 200, 400, 401, 403, 404, 409, 422 | **High** |

> **Note on reschedule:** this endpoint is in the BACKLOG as "tests after TS migration" — the SUT implementation exists and is documented in the spec, but the test plan is deferred. 7 documented error codes, zero coverage.

> **Note on slot management (POST/DELETE `/doctors/me/slots`, POST `/doctors/{id}/slots`):** these endpoints are called in test setup via `SlotClient` and `DoctorClient` helpers but are never the subject of a test — success and error paths are untested. A bug in slot creation would silently break the entire suite without a single test catching it at the source.

---

## 3. Error codes not exercised

Status codes that appear in the spec but are not covered by any test. Grouped by endpoint.

| Endpoint | Status code | Error condition | Priority |
|----------|-------------|-----------------|----------|
| POST `/api/v1/auth/register` | 409 `EMAIL_RETIRED` | Email belongs to soft-deleted account | **High** — distinct business rule from EMAIL_TAKEN |
| POST `/api/v1/auth/login` | 400 | Validation error (malformed body) | Medium |
| POST `/api/v1/auth/login` | 401 | Wrong credentials | **High** — core security path |
| DELETE `/api/v1/auth/me` | 401 | Missing/invalid token | Medium |
| DELETE `/api/v1/auth/me` | 403 | Doctor role not allowed via this endpoint | **High** — RBAC gap |
| GET `/api/v1/auth/me` | 200 | Returns user + doctor profile | Medium |
| POST `/api/v1/consultations` | 400 | Validation error (missing doctorId/paymentMethod) | Medium |
| GET `/api/v1/consultations/me` | 401 | Not authenticated | Medium |
| GET `/api/v1/consultations/me` | 403 | Doctor role not allowed | **High** — RBAC gap |
| GET `/api/v1/appointments/waitlist-offers` | 401 | Not authenticated | Medium |
| POST `/api/v1/appointments/waitlist-offers/{id}/accept` | 400 | Invalid offer id | Low |
| POST `/api/v1/appointments/waitlist-offers/{id}/accept` | 401 | Not authenticated | Medium |
| POST `/api/v1/appointments/waitlist-offers/{id}/decline` | 400 | Invalid offer id | Low |
| POST `/api/v1/appointments/waitlist-offers/{id}/decline` | 401 | Not authenticated | Medium |
| POST `/api/v1/appointments` | 400 | Validation error (missing slotId) | Medium |
| POST `/api/v1/appointments` | 401 | Not authenticated | **High** — unauthenticated booking |
| POST `/api/v1/appointments` | 403 | Doctor tries to book (patient-only route) | **High** — RBAC gap |
| POST `/api/v1/appointments` | 404 | Slot not found | Medium |
| POST `/api/v1/appointments/waitlist` | 400 | Slot still available (`SLOT_STILL_AVAILABLE`) | **High** — enforces invariant |
| POST `/api/v1/appointments/waitlist` | 401 | Not authenticated | Medium |
| POST `/api/v1/appointments/waitlist` | 403 | Doctor role not allowed | **High** — RBAC gap |
| POST `/api/v1/appointments/waitlist` | 404 | Slot not found | Medium |
| GET `/api/v1/appointments/waitlist/me` | 401 | Not authenticated | Medium |
| GET `/api/v1/appointments/waitlist/me` | 403 | Doctor role not allowed | Medium |
| DELETE `/api/v1/appointments/waitlist/{id}` | 400 | Invalid id | Low |
| DELETE `/api/v1/appointments/waitlist/{id}` | 401 | Not authenticated | Medium |
| DELETE `/api/v1/appointments/waitlist/{id}` | 404 | Entry not found | Medium |
| PATCH `/api/v1/appointments/{id}/cancel` | 400 | Invalid id | Low |
| PATCH `/api/v1/appointments/{id}/cancel` | 401 | Not authenticated | Medium |
| PATCH `/api/v1/appointments/{id}/cancel` | 404 | Appointment not found | Medium |
| PATCH `/api/v1/appointments/{id}/confirm` | 400 | Invalid id | Low |
| PATCH `/api/v1/appointments/{id}/confirm` | 401 | Not authenticated | Medium |
| PATCH `/api/v1/appointments/{id}/confirm` | 404 | Appointment not found | Medium |
| PATCH `/api/v1/appointments/{id}/reject` | 400 | Invalid id | Low |
| PATCH `/api/v1/appointments/{id}/reject` | 401 | Not authenticated | Medium |
| PATCH `/api/v1/appointments/{id}/reject` | 404 | Appointment not found | Medium |
| PATCH `/api/v1/appointments/{id}/reject` | 422 | Invalid transition (not pending) | **High** — state machine |
| PATCH `/api/v1/appointments/{id}/cancel-as-doctor` | 400 | Invalid id | Low |
| PATCH `/api/v1/appointments/{id}/cancel-as-doctor` | 401 | Not authenticated | Medium |
| PATCH `/api/v1/appointments/{id}/cancel-as-doctor` | 403 | Not slot owner | **High** — RBAC gap |
| PATCH `/api/v1/appointments/{id}/cancel-as-doctor` | 404 | Appointment not found | Medium |
| PATCH `/api/v1/appointments/{id}/cancel-as-doctor` | 422 | Invalid transition | **High** — state machine |
| GET `/api/v1/appointments/{id}` | 200 | Get by id (happy path) | **High** — IDOR test only covers 401/403; 200 path untested |
| GET `/api/v1/appointments/{id}` | 400 | Invalid id | Low |
| GET `/api/v1/appointments/{id}` | 404 | Not found | Medium |
| GET `/health` | 503 | Database down | Medium |

---

## 4. Additional scenarios worth adding

| Area | Scenario | Rationale |
|------|----------|-----------|
| Auth — refresh | `POST /api/v1/auth/refresh` — 200 returns new tokens, old refresh invalidated | Refresh token rotation is a security feature; untested rotation means we can't catch silent regressions |
| Auth — refresh | `POST /api/v1/auth/refresh` — 401 expired or tampered refresh token | Security boundary |
| Auth — login | `POST /api/v1/auth/login` — 401 wrong password for existing user | Core auth path; only covered for /register today |
| Auth — register | `POST /api/v1/auth/register` — 409 `EMAIL_RETIRED` (register after DELETE /auth/me) | Distinct code from EMAIL_TAKEN; unique to soft-delete design |
| RBAC — doctor role | DELETE `/api/v1/auth/me` — 403 when doctor tries to self-delete | Spec says "role not allowed via this endpoint" — gap in doctor RBAC |
| RBAC — doctor role | GET `/api/v1/consultations/me` — 403 when doctor calls patient-only route | Same pattern as GET /appointments/my (which IS tested) |
| RBAC — patient role | POST `/api/v1/appointments` — 403 when doctor tries to book | Symmetric to patient-tries-to-confirm, which IS tested |
| Waitlist invariant | POST `/api/v1/appointments/waitlist` — 400 `SLOT_STILL_AVAILABLE` | Critical business rule: you can only waitlist a taken slot; never tested |
| Slot management | POST `/api/v1/doctors/me/slots` — 409 `SLOT_OVERLAP` | Doctors can overlap-create slots; this guards against it; no test |
| Slot management | DELETE `/api/v1/doctors/me/slots/{slotId}` — 409 `SLOT_IN_USE` | Slot with active appointment cannot be deleted; no test |
| State machine | PATCH `/id/reject` — 422 when rejecting a non-pending appointment | Reject is only tested for `pending → rejected`; other source states untested |
| State machine | PATCH `/id/cancel-as-doctor` — 422 invalid transition | cancel-as-doctor is only tested via webhook; state machine paths untested |
| Reschedule | All 7 documented error codes | Entire endpoint unimplemented in tests (see BACKLOG) |
| GET /appointments/{id} | 200 happy path — patient reads own appointment | The IDOR test covers 401/403; the success path is never asserted |
| Idempotency boundary | POST `/api/v1/consultations` — second call WITHOUT idempotency key | Currently only tested with and without same key; different-key replay not tested |
| Validation boundaries | POST `/api/v1/appointments` — missing required `slotId` field | 400 VALIDATION_ERROR path untested for booking |

---

## 5. What is already well covered

- **AI recommendation endpoint** — 5 test patterns (invariants, LLM eval, prompt injection, graceful degradation, RAG completeness); the most thorough coverage in the suite.
- **Appointment state machine — happy paths** — book → confirm, book → reject, book → cancel all covered with DB assertions; concurrent cancel race also tested.
- **RBAC cross-patient isolation** — security.test.js explicitly covers patient-reads-other-patient, patient-cancels-other-patient, waitlist/offers cross-patient for all relevant endpoints (IDOR prevention).
- **Waitlist promotion** — auto-promotion after cancel and after reject both tested; double-promotion concurrency bug covered with exactly-once assertion.
- **Payment and idempotency** — 201, 402, 200 (idempotent replay), 503 (feature disabled) all covered; the idempotency test is the strongest payment assertion in the suite.

---

*This document is AI-assisted and reviewed by a human before use. The model identifies structural gaps from spec + test names only — it does not read test bodies or run tests.*

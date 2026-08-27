# Requirements Traceability Matrix — Clinic Booking API

**Purpose:** trace every business requirement to the test file(s) that verify it, and confirm coverage status.  
**Requirements last reviewed:** 2026-05-18 — the mapping below has not been re-walked since, while the suite has roughly doubled. Treat unmapped recent tests as a known gap in this document, not as missing coverage.  
**Suite at the time of that review:** 148 automated tests. **Today:** 350 unique tests / 415 runs across 80 files (`npm run test:count`, verified 2026-08-27).

Legend: ✅ Covered · ⚠️ Partial · ❌ Not covered

---

## Authentication & accounts

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| A-01 | Patient can register with email and password | `auth.register.test.ts` | ✅ |
| A-02 | Duplicate email returns 409 | `auth.register.test.ts` | ✅ |
| A-03 | Patient can log in and receive JWT | `auth.login.test.ts` | ✅ |
| A-04 | Invalid credentials return 401 | `auth.login.test.ts` | ✅ |
| A-05 | Protected routes require a valid JWT | `security.test.ts`, `appointments.rbac.patient.test.ts` | ✅ |
| A-06 | Tampered JWT is rejected | `security.test.ts` | ✅ |
| A-07 | Malformed JWT returns standard error response | ❌ No test — found by Schemathesis 2026-05-12 | ❌ |
| A-08 | Patient can close own account (`DELETE /auth/me` → 204) | `auth.delete.test.ts` | ✅ |
| A-09 | Access token rejected after account deletion (401 AUTH_INVALID) | `auth.delete.test.ts` | ✅ |
| A-10 | Refresh token rejected after account deletion (401 AUTH_INVALID) | `auth.delete.test.ts` | ✅ |
| A-11 | Deleted account cannot log in (401 AUTH_INVALID) | `auth.delete.test.ts` | ✅ |
| A-12 | Deleted account's email cannot be reused (409 EMAIL_RETIRED) | `auth.delete.test.ts` | ✅ |
| A-13 | User record preserved in DB with `deletedAt` set, not hard-deleted | `auth.delete.test.ts` | ✅ |
| A-14 | Other accounts unaffected when one account is deleted | `auth.delete.test.ts` | ✅ |

---

## Appointment lifecycle

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| L-01 | Patient can book an available slot → status `pending` | `appointments.mini.j1.test.ts`, `booking.cross-layer.test.ts` | ✅ |
| L-02 | Two patients cannot book the same slot | `appointments.booking.conflict.test.ts`, `booking-conflict.e2e.test.ts` | ✅ |
| L-03 | Doctor can confirm a pending appointment → `confirmed` | `appointments.confirm.j3.test.ts`, `doctor-confirm.e2e.test.ts` | ✅ |
| L-04 | Doctor can reject a pending appointment → `rejected` | `appointments.reject.j2.test.ts` | ✅ |
| L-05 | Patient can cancel pending or confirmed appointment | `appointments.cancel.patient.test.ts` | ✅ |
| L-06 | Doctor can cancel a confirmed appointment | `appointments.cancel.doctor.test.ts` | ✅ |
| L-07 | Cancelled slot is freed and available for rebooking | `appointments.cancel.patient.test.ts` (DB assertion) | ✅ |
| L-08 | Invalid state transitions return 422 INVALID_TRANSITION | `appointments.invalid-transition.test.ts` | ✅ |
| L-09 | Patient can reschedule pending or confirmed appointment | `appointments.reschedule.test.ts` | ✅ |
| L-10 | Reschedule is atomic: old slot freed, new slot booked, waitlist promoted | `appointments.reschedule.test.ts` (waitlist cascade test) | ✅ |
| L-11 | Reschedule to a different doctor returns 422 DOCTOR_MISMATCH | `appointments.reschedule.test.ts` | ✅ |
| L-12 | Patient can book a recurring series of weekly appointments | `appointments.recurring.test.ts`, `appointments.recurring.e2e.test.ts` | ✅ |
| L-13 | Patient can cancel an entire recurring series | `appointments.recurring.test.ts`, `appointments.recurring.e2e.test.ts` | ✅ |
| L-14 | Doctor can mark confirmed appointment as completed | `appointments.confirm.j3.test.ts` | ✅ |

---

## Appointment notes

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| AN-01 | Patient can add a note to a confirmed appointment (201 + response fields) | `appointments.notes.test.ts` | ✅ |
| AN-02 | Patient can retrieve notes list for their own appointment | `appointments.notes.test.ts` | ✅ |
| AN-03 | Unauthenticated add/read note returns 401 AUTH_REQUIRED | `appointments.notes.test.ts` | ✅ |
| AN-04 | Patient cannot add note to another patient's appointment (403 FORBIDDEN) | `appointments.notes.test.ts` | ✅ |
| AN-05 | Empty note content returns 400 VALIDATION_ERROR | `appointments.notes.test.ts` | ✅ |
| AN-06 | Note on cancelled/rejected appointment returns 422 INVALID_STATUS | `appointments.notes.test.ts` | ✅ |
| AN-07 | HTML/XSS content in note body is rejected (400 UNSAFE_CONTENT) | `appointments.notes.test.ts` | ✅ |
| AN-08 | Another authenticated patient cannot read appointment notes (IDOR) | `appointments.notes.test.ts` | ✅ |

---

## Appointment ratings

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| AR-01 | Patient can rate a completed appointment (201 + response fields) | `appointments.ratings.test.ts` | ✅ |
| AR-02 | `GET /doctors/:id/rating` returns aggregate average and count | `appointments.ratings.test.ts` | ✅ |
| AR-03 | Unauthenticated rating attempt returns 401 AUTH_REQUIRED | `appointments.ratings.test.ts` | ✅ |
| AR-04 | Patient cannot rate another patient's appointment (403 FORBIDDEN) | `appointments.ratings.test.ts` | ✅ |
| AR-05 | Score outside [1–5] range returns 400 VALIDATION_ERROR | `appointments.ratings.test.ts` | ✅ |
| AR-06 | Rating non-existent appointment returns 404 APPOINTMENT_NOT_FOUND | `appointments.ratings.test.ts` | ✅ |
| AR-07 | Rating a non-completed appointment returns 422 INVALID_STATUS | `appointments.ratings.test.ts` | ✅ |
| AR-08 | Duplicate rating returns 409 DUPLICATE_RATING | `appointments.ratings.test.ts` | ✅ |
| AR-09 | Aggregate rating does not expose individual rater identities | `appointments.ratings.test.ts` | ✅ |

---

## Appointment filtering

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| AF-01 | Patient can filter `GET /appointments/my` by status | `appointments.filter.test.ts` | ✅ |
| AF-02 | Filter by status returns only appointments with that status | `appointments.filter.test.ts` | ✅ |
| AF-03 | Patient can filter appointments by doctorId | `appointments.filter.test.ts` | ✅ |
| AF-04 | Patient can filter by `from` date (slot on or after date) | `appointments.filter.test.ts` | ✅ |
| AF-05 | Patient can filter by `to` date (slot on or before date) | `appointments.filter.test.ts` | ✅ |
| AF-06 | Multiple filters can be combined (AND semantics) | `appointments.filter.test.ts` | ✅ |
| AF-07 | No filter match returns 200 with empty data array | `appointments.filter.test.ts` | ✅ |
| AF-08 | Unknown status value returns 400 VALIDATION_ERROR | `appointments.filter.test.ts` | ✅ |
| AF-09 | Non-integer doctorId returns 400 VALIDATION_ERROR | `appointments.filter.test.ts` | ✅ |
| AF-10 | Invalid date format for `from`/`to` returns 400 VALIDATION_ERROR | `appointments.filter.test.ts` | ✅ |
| AF-11 | Filtered `total` in paginated response reflects filter, not overall count | `appointments.filter.test.ts` | ✅ |

---

## Appointment list & pagination

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| AP-01 | `GET /appointments/my` returns paginated envelope `{data, total, page, limit, totalPages}` | `appointments.pagination.test.ts` | ✅ |
| AP-02 | `GET /appointments/doctor` returns paginated envelope (doctor JWT) | `appointments.pagination.test.ts` | ✅ |
| AP-03 | `page=2&limit=1` returns correct offset — no off-by-one | `appointments.pagination.test.ts` | ✅ |
| AP-04 | Invalid pagination params (page=0, limit=0, non-integer) return 400 VALIDATION_ERROR | `appointments.pagination.test.ts` | ✅ |

---

## Doctor schedule

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| DS-01 | Doctor can set working hours per day of week via `PUT /me/schedule` | `doctors.schedule.test.ts` | ✅ |
| DS-02 | Slot booking outside doctor's working hours returns 422 OUTSIDE_WORKING_HOURS | `doctors.schedule.test.ts` | ✅ |
| DS-03 | Doctor schedule UI saves and reloads correctly | `doctor.schedule.ui.test.ts` | ✅ |
| DS-04 | Schedule set via UI is confirmed by API and persisted in DB | `doctor.schedule.cross-layer.test.ts` | ✅ |

---

## Booking wizard (UI)

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| BW-01 | Step 1 shows "Step 1 of 4" label and only step 1 section visible on load | `booking.wizard.test.ts` | ✅ |
| BW-02 | Next button on step 1 disabled until specialty is selected | `booking.wizard.test.ts` | ✅ |
| BW-03 | URL-skip to step 3 without doctorId silently redirects to step 1 | `booking.wizard.test.ts` | ✅ |
| BW-04 | Back from step 2 returns to step 1 with specialty preserved in URL | `booking.wizard.test.ts` | ✅ |
| BW-05 | Step 3 Next disabled until time slot is explicitly selected | `booking.wizard.test.ts` | ✅ |
| BW-06 | 409 SLOT_TAKEN on step 4 shows "slot just taken" message; back button remains visible | `booking.wizard.test.ts`, `booking-conflict.e2e.test.ts` | ✅ |
| BW-07 | Progress dots reflect current step (is-active) and completed steps (is-done) | `booking.wizard.test.ts` | ✅ |
| BW-08 | Full wizard happy path creates appointment; success message + submit hidden | `booking.wizard.e2e.test.ts` | ✅ |
| BW-09 | Unauthenticated user on step 4 sees sign-in gate instead of booking form | `guest-gates.test.ts` | ✅ |

---

## Waitlist

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| W-01 | Patient can join the waitlist for a fully booked doctor | `appointments.waitlist.test.ts` | ✅ |
| W-02 | Patient can leave the waitlist | `appointments.waitlist.test.ts`, `waitlist.cross-layer.test.ts` | ✅ |
| W-03 | When a slot is freed, the first waitlist patient is auto-promoted | `appointments.waitlist.promotion.test.ts` (DB assertion) | ✅ |
| W-04 | Patient with an active appointment is skipped during promotion | `appointments.waitlist.promotion.test.ts` | ✅ |
| W-05 | Promoted patient receives a waitlist offer and can accept or decline | `appointments.waitlist.offers.test.ts`, `offers.cross-layer.test.ts` | ✅ |
| W-06 | Patient cannot accept or decline another patient's offer (BOLA) | `security.test.ts` | ✅ |

---

## Access control (RBAC / IDOR / BOLA)

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| R-01 | Patient cannot read another patient's appointment | `security.test.ts` | ✅ |
| R-02 | Patient cannot cancel another patient's appointment | `security.test.ts` | ✅ |
| R-03 | Doctor cannot access another doctor's appointments | `appointments.rbac.cross-doctor.test.ts` | ✅ |
| R-04 | Doctor-only endpoints return 403 for patients | `appointments.rbac.patient.test.ts` | ✅ |
| R-05 | Patient cannot delete another patient's waitlist entry | `security.test.ts` | ✅ |

---

## Real-time notifications (WebSocket)

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| N-01 | Doctor receives WS event when patient books | `notifications.ws.test.ts` | ✅ |
| N-02 | Doctor receives WS event when patient cancels | `notifications.ws.test.ts` | ✅ |
| N-03 | Invalid WS token is rejected with close code 4001 | `notifications.ws.test.ts` | ✅ |
| N-04 | Doctor WS connection indicator visible in browser | `doctor-notifications.e2e.test.ts` | ✅ |
| N-05 | Patient receives WS event when appointment is confirmed | `patient-notifications.e2e.test.ts` | ✅ |

---

## AI symptom checker

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| AI-01 | Response always contains `specialty` and `reasoning` fields | `ai.recommend.test.ts` | ✅ |
| AI-02 | Recommended specialty is always from the known knowledge base | `ai.recommend.test.ts` | ✅ |
| AI-03 | Prompt injection does not compromise output | `ai.recommend.test.ts` | ✅ |
| AI-04 | Unavailable Claude API returns 503 gracefully | `ai.recommend.test.ts` | ✅ |
| AI-05 | Reasoning logically justifies the recommended specialty | `ai.recommend.test.ts` (LLM judge, `@rag`) | ✅ |
| AI-06 | Retrieved specialties appear in the model's reasoning | `ai.recommend.test.ts` (RAG completeness, `@rag`) | ✅ |
| AI-07 | "chest pain" routes to Cardiologist, not Orthopedist | ✅ `unit/ai.retrieval.test.ts` — B-05 fixed in SUT `fcccd6d` | ✅ |
| AI-08 | Response always includes at least one available doctor | ❌ No test — B-06 open bug | ❌ |
| AI-09 | `symptoms` max 500 characters → `400 VALIDATION_ERROR` (rejected before retrieval/Claude) | `ai.recommend.test.ts` | ✅ |
| AI-10 | The route is reached only on behalf of an identified caller (`401` with no or malformed token) | `security.agentic.test.ts` (`@security`) | ✅ |
| AI-11 | Patient symptoms never appear in the log stream on any status | `sut/src/__tests__/aiPrivacy.test.js` | ✅ |
| AI-12 | No error body echoes the input back — on either deployable | `aiPrivacy.test.js`, `aiServicePrivacy.test.js` | ✅ |
| AI-13 | Failure context sent to a third party carries no patient data | `unit/bug-reporter.redaction.test.ts` | ✅ |
| AI-14 | A specialty outside the allow-list is refused and never becomes a database query | `sut/src/__tests__/aiSupplyChain.test.js` | ✅ |
| AI-15 | The retrieval corpus cannot forge prompt structure (one entry, one prompt line) | `unit/knowledge-integrity.test.ts` (`@unit`) | ✅ |
| AI-16 | The circuit breaker opens after repeated model failures and recovers | `sut/src/__tests__/aiCircuitBreaker.test.js` | ✅ |
| AI-17 | The breaker counts *consecutive* failures, as its own comment states | ⚠️ `aiCircuitBreaker.test.js` pins the current behaviour, which is cumulative — `SYSTEM_WEAKNESS_REPORT.md` §12.6 | ⚠️ |

---

## MCP server (agent-facing surface)

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| MCP-01 | Tools outside the session's profile are not registered — absent from `tools/list`, not callable by name | `sut/src/__tests__/mcpServer.test.js` | ✅ |
| MCP-02 | The server forwards the caller's token and holds no credential of its own | `sut/src/__tests__/mcpServer.test.js` | ✅ |
| MCP-03 | Tool descriptions are screened before start-up; a poisoned description stops the server | `sut/src/__tests__/mcpServer.test.js` | ✅ |

---

## Payments & consultations

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| P-01 | Patient can book a consultation with payment | `consultations.payment.test.ts`, `consultations.cross-layer.test.ts` | ✅ |
| P-02 | Duplicate payment with same idempotency key does not create duplicate consultation | `consultations.payment.test.ts` | ✅ |
| P-03 | Failed payment returns 402 and does not create a consultation | `consultations.payment.test.ts` (DB assertion) | ✅ |

---

## Error contract

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| E-01 | Every error response contains `errorCode`, `message`, `requestId` | `infrastructure.test.ts` | ✅ |
| E-02 | Health endpoint always returns 200 | `infrastructure.test.ts`, `chaos.test.ts` | ✅ |
| E-03 | System returns 503 with correct error body under chaos injection | `chaos.test.ts` | ✅ |

---

## Performance & reliability

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| PF-01 | p95 latency for all requests < 200ms under 50 concurrent users | `k6/booking-flow.js` (CI gate: `performance.yml`) | ✅ |
| PF-02 | p95 booking latency < 500ms under 50 concurrent users | `k6/booking-flow.js` | ✅ |
| PF-03 | Error rate < 1% under load (409 SLOT_TAKEN excluded) | `k6/booking-flow.js` | ✅ |
| PF-04 | Concurrent cancellations do not double-free a slot | `appointments.concurrency.test.ts` | ✅ |
| PF-05 | Concurrent waitlist promotion fires exactly once | `appointments.concurrency.test.ts` | ✅ |

---

## Accessibility

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| AC-01 | Login, register, booking pages pass axe-core WCAG 2.1 AA audit | `accessibility.test.ts` | ✅ |
| AC-02 | Color contrast meets WCAG AA | ⚠️ Known debt — `.muted` at 3.9:1, excluded from run | ⚠️ |

---

## Coverage summary

| Area | Total requirements | Covered | Partial | Not covered |
|------|--------------------|---------|---------|-------------|
| Authentication | 14 | 13 | 0 | 1 |
| Appointment lifecycle | 14 | 14 | 0 | 0 |
| Appointment notes | 8 | 8 | 0 | 0 |
| Appointment ratings | 9 | 9 | 0 | 0 |
| Appointment filtering | 11 | 11 | 0 | 0 |
| Appointment list & pagination | 4 | 4 | 0 | 0 |
| Doctor schedule | 4 | 4 | 0 | 0 |
| Booking wizard (UI) | 9 | 9 | 0 | 0 |
| Waitlist | 6 | 6 | 0 | 0 |
| Access control | 5 | 5 | 0 | 0 |
| Real-time notifications | 5 | 5 | 0 | 0 |
| AI symptom checker | 17 | 15 | 1 | 1 |
| MCP server | 3 | 3 | 0 | 0 |
| Payments | 3 | 3 | 0 | 0 |
| Error contract | 3 | 3 | 0 | 0 |
| Performance | 5 | 5 | 0 | 0 |
| Accessibility | 2 | 1 | 1 | 0 |
| **Total** | **132** | **128 (97%)** | **2 (2%)** | **2 (2%)** |

**Not covered — known reasons:**

| ID | Gap | Reason |
|----|-----|--------|
| A-07 | Malformed JWT error contract | Found by Schemathesis 2026-05-12 — fix in next cycle |
| AI-07 | "chest pain" → Cardiologist | covered — B-05 closed 2026-08-21 |
| AI-08 | `doctors.length > 0` assertion | B-06 open bug — product decision on seeding or error code |

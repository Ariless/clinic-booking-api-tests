# Requirements Traceability Matrix — Clinic Booking API

**Purpose:** trace every business requirement to the test file(s) that verify it, and confirm coverage status.  
**Last updated:** 2026-05-16  
**Suite:** 118 automated tests across 7 layers

Legend: ✅ Covered · ⚠️ Partial · ❌ Not covered

---

## Authentication & accounts

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| A-01 | Patient can register with email and password | `auth.register.test.js` | ✅ |
| A-02 | Duplicate email returns 409 | `auth.register.test.js` | ✅ |
| A-03 | Patient can log in and receive JWT | `auth.login.test.js` | ✅ |
| A-04 | Invalid credentials return 401 | `auth.login.test.js` | ✅ |
| A-05 | Protected routes require a valid JWT | `security.test.js`, `appointments.rbac.patient.test.js` | ✅ |
| A-06 | Tampered JWT is rejected | `security.test.js` | ✅ |
| A-07 | Malformed JWT returns standard error response | ❌ No test — found by Schemathesis 2026-05-12 | ❌ |

---

## Appointment lifecycle

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| L-01 | Patient can book an available slot → status `pending` | `appointments.mini.j1.test.js`, `booking.cross-layer.test.js` | ✅ |
| L-02 | Two patients cannot book the same slot | `appointments.booking.conflict.test.js`, `booking-conflict.e2e.test.js` | ✅ |
| L-03 | Doctor can confirm a pending appointment → `confirmed` | `appointments.confirm.j3.test.js`, `doctor-confirm.e2e.test.js` | ✅ |
| L-04 | Doctor can reject a pending appointment → `rejected` | `appointments.reject.j2.test.js` | ✅ |
| L-05 | Patient can cancel pending or confirmed appointment | `appointments.cancel.patient.test.js` | ✅ |
| L-06 | Doctor can cancel a confirmed appointment | `appointments.rbac.doctor.test.js` | ✅ |
| L-07 | Cancelled slot is freed and available for rebooking | `appointments.cancel.patient.test.js` (DB assertion) | ✅ |
| L-08 | Invalid state transitions return 422 INVALID_TRANSITION | `appointments.invalid-transition.test.js` | ✅ |
| L-09 | Patient can reschedule pending or confirmed appointment | `appointments.reschedule.test.ts` | ✅ |
| L-10 | Reschedule is atomic: old slot freed, new slot booked, waitlist promoted | `appointments.reschedule.test.ts` (waitlist cascade test) | ✅ |
| L-11 | Reschedule to a different doctor returns 422 DOCTOR_MISMATCH | `appointments.reschedule.test.ts` | ✅ |
| L-12 | Patient can book a recurring series of weekly appointments | `appointments.recurring.test.ts`, `appointments.recurring.e2e.test.ts` | ✅ |
| L-13 | Patient can cancel an entire recurring series | `appointments.recurring.test.ts`, `appointments.recurring.e2e.test.ts` | ✅ |
| L-14 | Doctor can mark confirmed appointment as completed | `appointments.confirm.j3.test.ts` | ✅ |

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

## Waitlist

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| W-01 | Patient can join the waitlist for a fully booked doctor | `appointments.waitlist.test.js` | ✅ |
| W-02 | Patient can leave the waitlist | `appointments.waitlist.test.js`, `waitlist.cross-layer.test.js` | ✅ |
| W-03 | When a slot is freed, the first waitlist patient is auto-promoted | `appointments.waitlist.promotion.test.js` (DB assertion) | ✅ |
| W-04 | Patient with an active appointment is skipped during promotion | `appointments.waitlist.promotion.test.js` | ✅ |
| W-05 | Promoted patient receives a waitlist offer and can accept or decline | `appointments.waitlist.offers.test.js`, `offers.cross-layer.test.js` | ✅ |
| W-06 | Patient cannot accept or decline another patient's offer (BOLA) | `security.test.js` | ✅ |

---

## Access control (RBAC / IDOR / BOLA)

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| R-01 | Patient cannot read another patient's appointment | `security.test.js` | ✅ |
| R-02 | Patient cannot cancel another patient's appointment | `security.test.js` | ✅ |
| R-03 | Doctor cannot access another doctor's appointments | `appointments.rbac.cross-doctor.test.js` | ✅ |
| R-04 | Doctor-only endpoints return 403 for patients | `appointments.rbac.doctor.test.js` | ✅ |
| R-05 | Patient cannot delete another patient's waitlist entry | `security.test.js` | ✅ |

---

## Real-time notifications (WebSocket)

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| N-01 | Doctor receives WS event when patient books | `notifications.ws.test.js` | ✅ |
| N-02 | Doctor receives WS event when patient cancels | `notifications.ws.test.js` | ✅ |
| N-03 | Invalid WS token is rejected with close code 4001 | `notifications.ws.test.js` | ✅ |
| N-04 | Doctor WS connection indicator visible in browser | `doctor-notifications.e2e.test.js` | ✅ |
| N-05 | Patient receives WS event when appointment is confirmed | `patient-notifications.e2e.test.js` | ✅ |

---

## AI symptom checker

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| AI-01 | Response always contains `specialty` and `reasoning` fields | `ai.recommend.test.js` | ✅ |
| AI-02 | Recommended specialty is always from the known knowledge base | `ai.recommend.test.js` | ✅ |
| AI-03 | Prompt injection does not compromise output | `ai.recommend.test.js` | ✅ |
| AI-04 | Unavailable Claude API returns 503 gracefully | `ai.recommend.test.js` | ✅ |
| AI-05 | Reasoning logically justifies the recommended specialty | `ai.recommend.test.js` (LLM judge, `@rag`) | ✅ |
| AI-06 | Retrieved specialties appear in the model's reasoning | `ai.recommend.test.js` (RAG completeness, `@rag`) | ✅ |
| AI-07 | "chest pain" routes to Cardiologist, not Orthopedist | ❌ No test — B-05 open bug | ❌ |
| AI-08 | Response always includes at least one available doctor | ❌ No test — B-06 open bug | ❌ |

---

## Payments & consultations

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| P-01 | Patient can book a consultation with payment | `consultations.payment.test.js`, `consultations.cross-layer.test.js` | ✅ |
| P-02 | Duplicate payment with same idempotency key does not create duplicate consultation | `consultations.payment.test.js` | ✅ |
| P-03 | Failed payment returns 402 and does not create a consultation | `consultations.payment.test.js` (DB assertion) | ✅ |

---

## Error contract

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| E-01 | Every error response contains `errorCode`, `message`, `requestId` | `infrastructure.test.js` | ✅ |
| E-02 | Health endpoint always returns 200 | `infrastructure.test.js`, `chaos.test.js` | ✅ |
| E-03 | System returns 503 with correct error body under chaos injection | `chaos.test.js` | ✅ |

---

## Performance & reliability

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| PF-01 | p95 latency for all requests < 200ms under 50 concurrent users | `k6/booking-flow.js` (CI gate: `performance.yml`) | ✅ |
| PF-02 | p95 booking latency < 500ms under 50 concurrent users | `k6/booking-flow.js` | ✅ |
| PF-03 | Error rate < 1% under load (409 SLOT_TAKEN excluded) | `k6/booking-flow.js` | ✅ |
| PF-04 | Concurrent cancellations do not double-free a slot | `appointments.concurrency.test.js` | ✅ |
| PF-05 | Concurrent waitlist promotion fires exactly once | `appointments.concurrency.test.js` | ✅ |

---

## Accessibility

| ID | Requirement | Test file(s) | Status |
|----|-------------|--------------|--------|
| AC-01 | Login, register, booking pages pass axe-core WCAG 2.1 AA audit | `accessibility.test.js` | ✅ |
| AC-02 | Color contrast meets WCAG AA | ⚠️ Known debt — `.muted` at 3.9:1, excluded from run | ⚠️ |

---

## Coverage summary

| Area | Total requirements | Covered | Partial | Not covered |
|------|--------------------|---------|---------|-------------|
| Authentication | 7 | 6 | 0 | 1 |
| Appointment lifecycle | 14 | 14 | 0 | 0 |
| Appointment list & pagination | 4 | 4 | 0 | 0 |
| Doctor schedule | 4 | 4 | 0 | 0 |
| Waitlist | 6 | 6 | 0 | 0 |
| Access control | 5 | 5 | 0 | 0 |
| Real-time notifications | 5 | 5 | 0 | 0 |
| AI symptom checker | 8 | 6 | 0 | 2 |
| Payments | 3 | 3 | 0 | 0 |
| Error contract | 3 | 3 | 0 | 0 |
| Performance | 5 | 5 | 0 | 0 |
| Accessibility | 2 | 1 | 1 | 0 |
| **Total** | **66** | **62 (94%)** | **1 (2%)** | **3 (5%)** |

**Not covered — known reasons:**

| ID | Gap | Reason |
|----|-----|--------|
| A-07 | Malformed JWT error contract | Found by Schemathesis 2026-05-12 — fix in next cycle |
| AI-07 | "chest pain" → Cardiologist | B-05 open bug — retrieval scoring fix needed first |
| AI-08 | `doctors.length > 0` assertion | B-06 open bug — product decision on seeding or error code |

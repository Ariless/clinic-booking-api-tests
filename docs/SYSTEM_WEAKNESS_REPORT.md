# System Weakness Report — clinic-booking-api

**Scope:** QA-perspective analysis of architectural risks, concurrency gaps, and business logic vulnerabilities in the SUT. This is an FMEA-inspired (Failure Mode and Effects Analysis) structured map of failure modes and their test coverage — not a penetration test. Each section identifies a failure mode, its severity, whether the system mitigates it, and whether a test exists.

**Companion documents:** `RISK_ANALYSIS.md` (impact × likelihood → test files), `DESIGN_PRINCIPLES.md` (how tests are built around these risks), `KNOWN_ISSUES.md` (bug register — fixed + open + design debt).

---

## 1. Concurrency and race conditions

### 1.1 Double-booking window (mitigated, monitored)

**Risk:** Two patients submit `POST /appointments` for the same slot within milliseconds.

**How the system protects itself:**
- `bookSlot` wraps the read-check-write sequence in a `db.transaction()`.
- A unique index (`idx_appointments_one_active_per_slot`) on `(slotId)` catches any race that slips past the transaction check.
- SQLite serializes writes — true parallel writes queue up.

**Residual weakness:** The unique index constraint is the last line of defense. If it were ever dropped (accidentally, during migration), the transaction-level check alone would not catch all races under concurrent load. The buggy branch (`B6`) simulates exactly this: the index is dropped and the guard condition is flipped, allowing double-booking.

**Test coverage:** `appointments.booking.conflict.test.js` — verifies `409 SLOT_TAKEN` when two clients race for the same slot.

---

### 1.2 Waitlist promotion under concurrent cancellation

**Risk:** Two concurrent cancel requests arrive for different appointments on the same doctor's schedule. Both trigger `promoteFromWaitlist`. The oldest waitlist entry could be promoted twice.

**How the system protects itself:**
- Each cancel runs inside `db.transaction()`, which includes the `promoteFromWaitlist` call.
- SQLite serializes the two transactions — one completes before the other starts.
- `deleteWaitlistEntryById` inside the promotion removes the entry atomically within the transaction.

**Residual weakness:** `promoteFromWaitlist` is documented as "must be called inside an existing transaction" (code comment). If it were ever called outside a transaction (e.g., a future refactor), the read-insert-delete sequence would not be atomic and the same patient could be promoted into two appointments.

**Test coverage:** `appointments.waitlist.promotion.test.js` — verifies a single promotion per freed slot. Concurrent promotion scenario is not yet explicitly tested → planned in `tests/api/concurrency/`.

---

### 1.3 Auto-expiry timer races with manual operations

**Risk:** The background timer (`expireStalePendingAppointments`) fires at the same time a doctor manually cancels or rejects an appointment that is about to expire.

**Scenario:**
1. Appointment A is `pending`, age = maxAge - 1ms.
2. Doctor sends `PATCH /cancel`.
3. Timer fires 1ms later, also targets appointment A.

**How the system protects itself:**
- Both operations run inside `db.transaction()`.
- SQLite serializes them — whichever acquires the write lock first completes; the second reads the already-cancelled status and either no-ops or throws `INVALID_TRANSITION`.

**Residual weakness:** The timer loop in `expireStalePendingAppointments` processes all stale appointments in a single transaction. If the list is large, this transaction holds the write lock for an extended period, blocking all concurrent writes (bookings, cancellations). Under high load this becomes a latency spike.

**Test coverage:** Not tested — requires time manipulation or short `AUTO_EXPIRE_PENDING_MAX_AGE_MS` override. Planned.

---

## 2. State consistency gaps

### 2.1 Slot availability does not distinguish booking states

**Risk:** `slots.isAvailable` is a boolean. It does not encode *why* a slot is unavailable: pending booking, confirmed booking, or in-progress expiry. This means:

- A confirmed appointment and a pending appointment look identical to the slot availability check.
- If a `confirmed` appointment were ever accidentally expired (currently prevented because the expiry query filters `status = 'pending'`), the slot would be freed and a new patient could book — double-occupancy.

**Current protection:** `expireStalePendingAppointments` explicitly filters `WHERE status = 'pending'`. Confirmed appointments never expire.

**Residual weakness:** The guard is in the query string, not enforced by a DB constraint. A future query change or a bug in the filter would silently corrupt slot state.

**Test coverage:** `appointments.confirm.j3.test.js` — verifies slot is NOT freed after confirm. The expiry path for confirmed appointments is not explicitly tested.

---

### 2.2 No audit trail — actor identity lost on state changes

**Risk:** When a doctor cancels a patient's appointment, the `appointments` table records `status = 'cancelled'` and `updatedAt`. It does not record *who* made the change. A patient self-cancel and a doctor-initiated cancel are indistinguishable in the DB.

**Impact:** Dispute resolution, compliance reporting, and debugging are impossible without application logs. The system relies entirely on Pino logs for actor identity — if logs are lost or not ingested, the information is gone.

**Mitigated by:** Pino structured logging + Loki/Grafana observability stack already covers actor identity at the application level. A separate DB audit table adds no meaningful portfolio value on top of this. Weakness acknowledged, not planned for implementation.

---

### 2.3 Waitlist fairness — per-doctor, not per-slot

**Risk:** The waitlist is keyed on `doctorId`. When any slot frees for that doctor, the oldest waitlist entry wins it — regardless of the patient's time preference. A patient who wanted the 9am slot may be booked into a 5pm slot they cannot attend.

**Impact:** Silent booking into an unwanted slot. Patient would need to cancel, which frees the slot again and triggers another promotion — potential cascade of cancellations.

**Current state:** This is a known product design decision, not a bug. Documented here because it produces testable edge cases (patient cancels promoted appointment → second promotion fires).

**Test coverage:** Not explicitly tested.

---

## 3. Security boundaries

### 3.1 Doctor self-registration — no `doctorRecordId` validation

**Risk:** `POST /auth/register` with `role: "doctor"` accepts any `doctorRecordId` integer without verifying it exists in the `doctors` table. An attacker can register as a doctor associated with a legitimate doctor's record and gain access to that doctor's appointment management endpoints.

**Severity:** High — RBAC is bypassed at the identity layer.

**Current state:** Known gap, documented in SUT `DEFENSE_NOTES.md`. Not fixed in the current scope (learning project). In production this would require an invitation token or admin-issued `doctorRecordId`.

**Test coverage:** No test exists for this gap — it is an acknowledged design limitation, not a regression risk in the current codebase.

---

### 3.2 IDOR on appointment read — ✅ found and fixed (2026-04-30)

**Risk:** `GET /appointments/:id` without `requireAuth` and without an ownership check — any unauthenticated user could read any appointment by ID; any authenticated patient could read another patient's appointment.

**→ Bug details, fix, and test coverage:** `KNOWN_ISSUES.md` B-01

---

### 3.3 Rate limiting is per-IP only

**Risk:** Rate limiters on `/login`, `/register`, and `POST /appointments` key on client IP. Behind a shared NAT (corporate network, VPN) or a reverse proxy that does not forward `X-Forwarded-For`, all users share one IP bucket. A single aggressive client exhausts the limit for everyone on that network.

**Residual weakness:** `TRUST_PROXY=false` by default. In a Docker or cloud deployment where a proxy sits in front, the real client IP is in `X-Forwarded-For`, not `req.ip`. Without `TRUST_PROXY=true`, the rate limiter sees the proxy IP and the limit never fires per-client.

**Test coverage:** Rate limit tests (`@rate-limit`) verify the 429 contract. The proxy trust scenario is not tested — requires infrastructure-level setup.

---

### 3.4 Accessibility violations — ✅ found and fixed (2026-04-30)

**Risk:** Pages lacked semantic HTML structure required by WCAG 2.1 AA — missing `<main>` landmark and `<h1>` on key pages. Screen reader users could not navigate efficiently. EU Accessibility Act compliance risk.

**Known residual:** `color-contrast` excluded — `.muted` is `#64748b` (3.9:1, below WCAG AA 4.5:1). See `KNOWN_ISSUES.md` D-01.

**→ Bug details, fix, and test coverage:** `KNOWN_ISSUES.md` B-02

---

## 4. Operational risks

### 4.1 SQLite single-writer bottleneck

**Risk:** SQLite allows only one concurrent writer. Under any meaningful load, write operations (bookings, cancellations, confirmations) queue behind each other. The auto-expiry transaction, which processes all stale appointments in one lock, is the worst-case write holder.

**Impact:** Latency spikes on write endpoints during expiry runs. Not observable in a single-user test but appears under k6 load scenarios.

**Test coverage:** Partial ✅ — `k6/booking-flow.js` establishes a p95 latency baseline for the booking flow (50 VUs, 30s hold). Thresholds: `p95 < 200ms` for read endpoints, `p95 < 500ms` for bookings. The expiry-timer spike scenario is not yet isolated — requires time control or a seeded batch of stale appointments.

---

### 4.2 No slot-level locking beyond the transaction

**Risk:** Between the moment a patient selects a slot in the UI and the moment they submit the booking form, the slot has no "soft lock" or reservation. Another patient can book the same slot during that window.

**How the system handles it:** The booking fails with `409 SLOT_TAKEN` and the UI shows an error message.

**Impact:** Not a data corruption risk — the error contract is clean. It is a UX failure mode that the E2E conflict test (`booking-conflict.e2e.test.js`) specifically validates.

**Test coverage:** `booking-conflict.e2e.test.js` — patient B has slot selected in UI; patient A books via API; patient B submits and sees error. ✅

---

## 5. API fuzzing findings — Schemathesis (found 2026-05-12)

### 5.1 Malformed JWT → `400 <EMPTY>` — error contract violation

**Risk:** When a request arrives with a malformed `Authorization` header (present but not a valid JWT format), the middleware fires before the route handler and returns `400 Bad Request` with an empty body. This breaks the error contract: every error response must contain `{ errorCode, message, requestId }`.

**Found by:** Schemathesis — generated a random-bytes Authorization header, sent it to auth-required endpoints. Expected: `401` with JSON body. Received: `400` with empty body.

**Architectural note:** JWT parse failure happens at the Express middleware level (`express-jwt` or custom auth middleware) before the route handler can format the error. The route handler's error formatting never runs.

**Affected endpoints:** All auth-required routes — `GET /appointments/my`, `GET /appointments/doctor`, `GET /appointments/waitlist/me`, `DELETE /appointments/waitlist/:id`, `PATCH /appointments/:id/cancel`, and others.

**Severity:** Medium — real clients using correctly formatted tokens will never hit this. A security scanner or attacker probing the API will see inconsistent error responses.

**Test coverage:** ❌ Existing `security.test.js` tests missing auth header or uses valid-but-unauthorized tokens — never tests malformed token. Schemathesis is the first tool to cover this path.

**Fix direction:** Add error handler in auth middleware that catches JWT parse errors and returns `401 { errorCode: "AUTH_INVALID", message: "...", requestId: "..." }`.

---

### 5.2 TRACE method returns 404 instead of 405

**Risk:** Sending `TRACE <any-endpoint>` returns `404 NOT_FOUND` rather than `405 Method Not Allowed`. HTTP spec (RFC 7231) requires `405` for methods not supported by a route.

**Found by:** Schemathesis — automatically probes unsupported methods on every operation.

**Scope:** Systemic — affects all 35 endpoints.

**Severity:** Low — no security impact, no data risk. Pure HTTP compliance.

**Fix direction:** Add `app.use((req, res, next) => { if (req.method === 'TRACE') return res.status(405).end(); next(); })` at the top of the Express app.

---

### 5.3 `POST /consultations` — `401` not documented in OpenAPI spec

**Risk:** The consultations endpoint returns `401 AUTH_REQUIRED` (missing auth) and `401 AUTH_INVALID` (user deleted mid-session), but neither `401` code appears in the spec's documented responses. Spec-compliant clients may not handle this case.

**Found by:** Schemathesis — used a valid-format token whose user no longer existed in DB.

**Severity:** Low — spec doc gap, not a runtime bug.

**Fix direction:** Add `401` response to all auth-required endpoints in `openapi.yaml`.

---

## 6. AI recommendation risks

### 5.1 Retrieval quality — wrong specialty for common symptoms (found 2026-05-08)

**Risk:** Keyword-overlap scoring in `retrieval.js` uses generic words like "pain" that match multiple specialties. "chest pain" scores Orthopedist higher than Cardiologist — a silent misrouting with no error signal.

**Architectural note:** The retrieval layer is the first-pass filter. If it returns the wrong top-1, Claude never sees the correct specialty in its context window. The LLM may correct this in real Claude mode but not in mock mode, where retrieval result is returned directly.

**→ Bug details, workaround, and fix plan:** `KNOWN_ISSUES.md` B-05

---

### 5.2 Specialty/seed data mismatch — empty doctors array (found 2026-05-08)

**Risk:** Knowledge base and `ALLOWED_SPECIALTIES` include 6 specialties; seed data only seeds 3 doctors (Cardiologist, Dermatologist, Neurologist). If retrieval returns Orthopedist or Pediatrician, the API responds `200 OK` with `doctors: []` — a valid-looking response with no actionable result.

**Architectural note:** The mismatch between knowledge base coverage and seeded data creates a silent failure path: no error code, no indication to the patient that no appointment can actually be made.

**→ Bug details, workaround, and fix plan:** `KNOWN_ISSUES.md` B-06

---

### 1.4 Reschedule compound operation (free + promote + book)

**Risk:** `PATCH /reschedule` must atomically: (1) book new slot, (2) free old slot, (3) trigger waitlist promotion on old slot. The **order** of operations within the transaction is a correctness invariant, not just an implementation detail.

**How the system protects itself:**
- All three steps run inside a single `db.transaction()`.
- SQLite rolls back the entire transaction on any failure — no partial state (e.g. old slot freed but new slot not booked).
- The unique index `idx_appointments_one_active_per_slot` catches concurrent booking of the new slot that slips past the availability check.

**Bug found and fixed (2026-05-16 — B-07):** Original implementation ran `promoteFromWaitlist(oldSlotId)` **before** moving the appointment to the new slot. With an active waitlist patient, `promoteFromWaitlist` inserted a new appointment on `oldSlotId` while the rescheduled appointment still referenced `oldSlotId` → UNIQUE constraint violation → incorrect `409 SLOT_TAKEN`. The 7 tests without waitlist were no-ops for `promoteFromWaitlist` — bug was invisible until test 8 added a waitlist patient. Fix: reorder to (1) mark new slot unavailable, (2) move appointment, (3) free old slot, (4) promote.

**Residual weakness:** If two patients race to reschedule to the same new slot, the second request receives `409 SLOT_TAKEN` via the unique constraint — same protection as original booking. Concurrency scenario not yet explicitly tested.

**Severity:** Low — transaction boundary is correctly drawn; constraint provides a backstop. Operation ordering is now correct.

**Test coverage:** ✅ `appointments.reschedule.test.ts` (8 tests) — covers happy path (pending→new slot), confirmed→pending reset, 409 SLOT_TAKEN, 422 INVALID_TRANSITION/DOCTOR_MISMATCH/SAME_SLOT, 403 FORBIDDEN, and waitlist cascade (the test that found B-07). Concurrency test (two patients, same new slot simultaneously) ❌ planned.

---

## 6. Summary table

| Weakness | Severity | Mitigated? | Test exists? |
|---|---|---|---|
| Double-booking race | High | ✅ transaction + unique index | ✅ `booking.conflict` |
| Concurrent waitlist promotion | Medium | ✅ transaction serialization | Partial — single-path only |
| Auto-expiry timer race | Low | ✅ SQLite serialization | ❌ planned |
| Slot state ambiguity (pending vs confirmed) | Medium | Partial — query filter | Partial — J3 test |
| No audit trail | Medium | ✅ Pino + Loki/Grafana | — not planned (mitigated by observability stack) |
| Waitlist fairness | Low | N/A — product decision | ❌ planned |
| Doctor self-registration | High | ❌ known gap | ❌ acknowledged |
| IDOR on `GET /appointments/:id` | High | ✅ fixed: `requireAuth` + ownership check | ✅ `security.test.js` (found + fixed 2026-04-30) |
| Rate limit per-IP only | Low | Partial | Partial — 429 contract only |
| SQLite write bottleneck | Medium | ❌ architectural limit | ⚠️ baseline only — `k6/booking-flow.js`; expiry spike not isolated |
| No slot soft-lock in UI | Low | ✅ clean 409 error | ✅ `booking-conflict.e2e` |
| Accessibility violations (missing landmarks, headings) | Medium | ✅ fixed: `<main>` + `<h1>` added | ✅ `accessibility.test.js` (found + fixed 2026-04-30) |
| Color contrast below WCAG AA | Low | ❌ known design debt (#64748b) | ⚠️ excluded from axe run, documented |
| Retrieval quality — ambiguous symptoms route to wrong specialty | Medium | Partial — LLM may correct; mock mode exposes raw retrieval | ❌ no regression test for ambiguous symptoms (found 2026-05-08, Pact) |
| Specialty/seed data mismatch — `doctors: []` on valid 200 | Medium | ❌ no guard | ❌ no test; silent failure (found 2026-05-08, Pact) |
| Reschedule free+promote+book atomicity | Low | ✅ single transaction + unique index; operation order fixed (B-07) | ✅ 8 tests; concurrency scenario planned |
| Malformed JWT → `400 <EMPTY>` — error contract violation | Medium | ❌ middleware fires before route handler, returns raw 400 | ❌ found by Schemathesis 2026-05-12 — no test for malformed (vs missing) auth header |
| TRACE method returns 404 instead of 405 | Low | ❌ Express default | ❌ not tested — HTTP spec requires 405 for unsupported methods |
| `POST /consultations` missing `401` in OpenAPI spec | Low | N/A — spec doc gap | ❌ spec does not document 401 for auth-required endpoints |
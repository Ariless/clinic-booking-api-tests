# System Weakness Report — clinic-booking-api


<!-- sut-refs-notice -->
> **Referenced but living in the SUT repository:** `openapi.yaml`, `retrieval.js`, `DEFENSE_NOTES.md` — see *System under test* in `README.md`.

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

**Test coverage:** `appointments.booking.conflict.test.ts` — verifies `409 SLOT_TAKEN` when two clients race for the same slot.

---

### 1.2 Waitlist promotion under concurrent cancellation

**Risk:** Two concurrent cancel requests arrive for different appointments on the same doctor's schedule. Both trigger `promoteFromWaitlist`. The oldest waitlist entry could be promoted twice.

**How the system protects itself:**
- Each cancel runs inside `db.transaction()`, which includes the `promoteFromWaitlist` call.
- SQLite serializes the two transactions — one completes before the other starts.
- `deleteWaitlistEntryById` inside the promotion removes the entry atomically within the transaction.

**Residual weakness:** `promoteFromWaitlist` is documented as "must be called inside an existing transaction" (code comment). If it were ever called outside a transaction (e.g., a future refactor), the read-insert-delete sequence would not be atomic and the same patient could be promoted into two appointments.

**Test coverage:** `appointments.waitlist.promotion.test.ts` — verifies a single promotion per freed slot. Concurrent promotion scenario is not yet explicitly tested → planned in `tests/api/concurrency/`.

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

**Test coverage:** `appointments.confirm.j3.test.ts` — verifies slot is NOT freed after confirm. The expiry path for confirmed appointments is not explicitly tested.

---

### 2.4 Storage type leaked into the JSON contract — `isAvailable` (found and fixed 2026-08-22)

**Risk:** SQLite has no boolean type, so `slots.isAvailable` is `INTEGER NOT NULL`. `getAvailableByDoctorId` selects the column and the route serialises the row unchanged, so `GET /doctors/:id/slots` answers `"isAvailable": 1`. Every consumer that treats the API as typed disagrees with that: the mobile app declares `isAvailable: boolean`, and the pact it publishes pins a boolean.

**Why it stayed invisible:** `1` is truthy. `slots.filter(s => s.isAvailable)` in `BookingScreen.tsx` behaves exactly as intended, and the web UI carries a `Boolean(s.isAvailable)` wrapper that quietly absorbs the same difference. No scenario test can see it — every assertion that reaches the value through its truthiness passes either way. Only a type-level oracle catches it, which is what the pact is.

**Residual weakness:** The mismatch becomes a user-visible fault the moment a consumer tightens the check — `=== true`, a runtime schema validator, or a generated typed client. The failure mode is "this doctor has no free slots", which reads as a data problem, not a serialisation one.

**Fixed 2026-08-22 (B-15):** `toApiSlot` in `slotsRepository` maps the flag on the three read paths that reach the API; the integer column stays the internal representation, so writes, the booking guards and `invariants.js` are untouched. `Slot.isAvailable` in the OpenAPI spec is `boolean`, matching `CreateSlotRequest`, which had been `boolean` all along — the spec had been recording the leak rather than the intent.

**Test coverage:** `mobile.pact.provider.test.ts` — the interaction that found the mismatch now guards the boolean. The class of defect stays worth watching: any other column read straight into a response body carries the same risk, and only a type-level oracle sees it.

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

### 3.4 Accessibility violations — ✅ found and fixed (2026-04-30, recurrence fixed 2026-05-22)

**Risk:** Pages lacked semantic HTML structure required by WCAG 2.1 AA — missing `<main>` landmark and `<h1>` on key pages. Screen reader users could not navigate efficiently. EU Accessibility Act compliance risk.

**Known residual:** `color-contrast` excluded — `.muted` is `#64748b` (3.9:1, below WCAG AA 4.5:1). See `KNOWN_ISSUES.md` D-01.

**Recurrence (2026-05-22):** Five pages added since the original fix shipped without `<main>` landmarks (`patient-appointments`, `patient-consultations`, `patient-notifications`, `doctor-appointments`, `doctor-schedule`). Additionally `doctor-schedule` had 14 unlabelled `<input type="time">` elements in the dynamically generated working hours table. Found by extending `accessibility.test.ts` to cover new pages. All fixed.

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

**Impact:** Not a data corruption risk — the error contract is clean. It is a UX failure mode that the E2E conflict test (`booking-conflict.e2e.test.ts`) specifically validates.

**Test coverage:** `booking-conflict.e2e.test.ts` — patient B has slot selected in UI; patient A books via API; patient B submits and sees error. ✅

---

## 5. API fuzzing findings — Schemathesis (found 2026-05-12)

### 5.1 Malformed JWT → `400 <EMPTY>` — error contract violation

**Risk:** When a request arrives with a malformed `Authorization` header (present but not a valid JWT format), the middleware fires before the route handler and returns `400 Bad Request` with an empty body. This breaks the error contract: every error response must contain `{ errorCode, message, requestId }`.

**Found by:** Schemathesis — generated a random-bytes Authorization header, sent it to auth-required endpoints. Expected: `401` with JSON body. Received: `400` with empty body.

**Architectural note:** JWT parse failure happens at the Express middleware level (`express-jwt` or custom auth middleware) before the route handler can format the error. The route handler's error formatting never runs.

**Affected endpoints:** All auth-required routes — `GET /appointments/my`, `GET /appointments/doctor`, `GET /appointments/waitlist/me`, `DELETE /appointments/waitlist/:id`, `PATCH /appointments/:id/cancel`, and others.

**Severity:** Medium — real clients using correctly formatted tokens will never hit this. A security scanner or attacker probing the API will see inconsistent error responses.

**Test coverage:** ❌ Existing `security.test.ts` tests missing auth header or uses valid-but-unauthorized tokens — never tests malformed token. Schemathesis is the first tool to cover this path.

**Fix direction:** Add error handler in auth middleware that catches JWT parse errors and returns `401 { errorCode: "AUTH_INVALID", message: "...", requestId: "..." }`.

---

### 5.2 No path returned 405 under any method ✅ FIXED 2026-08-26

**Risk:** Sending `TRACE <any-endpoint>` returns `404 NOT_FOUND` rather than `405 Method Not Allowed`. HTTP spec (RFC 7231) requires `405` for methods not supported by a route.

Re-checked 2026-08-26 against the running SUT, and the gap is wider than TRACE: **no path returns `405` under any method**, and `405` does not appear anywhere in `sut/src`. `POST`, `PUT`, `PATCH` and `DELETE` on `/api/v1/doctors` — a real path that serves `GET` — all answer `404`, the same code as `/api/v1/nonexistent`. A client cannot distinguish "this path does not exist" from "this path exists but not for your method". `OPTIONS` and `HEAD` are the exception: Express answers those itself, both `200`.

**Found by:** Schemathesis — automatically probes unsupported methods on every operation.

**Scope:** The whole application, not a set of endpoints. TRACE has no handler anywhere, so the request falls through to `notFoundHandler` regardless of path — a path that has never existed answers identically. Counting endpoints here was misleading: the number described the API's size, while the defect belongs to the routing layer above it.

**Severity:** Low — no security impact, no data risk. Pure HTTP compliance.

**Fixed 2026-08-26.** `sut/src/middlewares/method-not-allowed.js`, mounted between the routes
and the 404 handler. It walks the router the way Express does — each layer's matchers against
the remaining path, recursing into mounted sub-routers — and collects the methods registered
for the path, ignoring the one that was asked for. A non-empty set that lacks the request's
method is a 405 with `Allow`; an empty set falls through to the 404 handler unchanged.

Verified against a running SUT: `TRACE`, `POST`, `PUT` and `DELETE` on `/api/v1/doctors`
answer `405` with `Allow: GET, HEAD, OPTIONS`; `GET /api/v1/auth/login` answers `405` with
`Allow: OPTIONS, POST`; `/api/v1/nonexistent` still answers `404` under every method,
`TRACE` included. Pinned by `tests/api/http.methods.test.ts` — 10 tests, of which 6 fail
against the pre-fix build, checked by disabling the middleware and re-running.

One subtlety cost a debugging pass: a router mounted at `"/"` (the health routes) carries a
matcher that only accepts `"/"` itself, because Express skips the prefix check for it and
hands the router every path. Without a branch for that, `PUT /health` looked like an unknown
path rather than a wrong method.

**Original fix direction, kept for the record:** A TRACE-only guard at the top of the app — `if (req.method === 'TRACE') return res.status(405).end()` — closes the reported symptom but not the defect: it would answer `405` for paths that do not exist, where `404` is correct, and it leaves `POST` on a `GET`-only path still answering `404`. Honest fix is a `405` handler that runs after routing and knows which methods the matched path allows (Express exposes this via a router layer walk, or `express-route-405`-style middleware), returning `405` with an `Allow` header only when the path matched and the method did not.

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

## 7. Fixture infrastructure weaknesses (found 2026-05-20)

### 7.1 FK enforcement gap in `deleteOwnedSlotIfUnused` transaction (fixed — B-08)

**Risk:** SQLite FK enforcement (`PRAGMA foreign_keys = 1`) was active. `deleteOwnedSlotIfUnused` deleted `appointments` then `slots` — but `waitlist_offers.slotId` also referenced `slots.id`. With FK enforcement ON, `DELETE FROM slots` raises `SQLITE_CONSTRAINT_FOREIGNKEY` when offers exist. Exception propagated to the HTTP layer as `500`, which teardown code silently ignored. Slot was never deleted.

**Effect:** Stale slots accumulated across test runs. Since `nextSeedSlotWindow()` generates deterministic time windows, next-run fixtures collided at the same timestamps → `SLOT_OVERLAP` → fixture setup failed.

**How the system protects itself (after fix):** `DELETE FROM waitlist_offers WHERE slotId = ?` now runs first in the transaction, before deleting appointments and the slot. FK violation is impossible.

**Portfolio note:** FK constraints are defensive — but they can silently invalidate older code written before FK enforcement was switched on. The bug was invisible because the HTTP teardown discarded the 500 response.

**Test coverage:** All waitlist-related teardowns now pass clean across consecutive runs. `slotFixture.ts` now logs `console.error` on any non-204 response from `deleteSlot`.

---

### 7.2 `softDeleteUser` cascade gap — waitlist entries survive soft-delete (fixed — B-09)

**Risk:** `softDeleteUser` set `deletedAt` on the user record but did not remove their `slot_waitlist` entries. The system has a feature (`promoteFromWaitlist`) that runs as a side effect of any slot being freed. If a soft-deleted user's waitlist entry survived, they could be promoted to a new pending appointment after their account was deleted.

**How the system protects itself (after fix):** `softDeleteUser` transaction now atomically deletes `slot_waitlist WHERE patientId = ?` before setting `deletedAt`.

**Residual weakness:** Active appointments for the deleted user are NOT cancelled by `softDeleteUser`. Teardown of the slot fixture handles this (cancels active appointments then deletes slot), but in production a "delete account" flow would leave orphan pending appointments referencing a soft-deleted patient.

**Test coverage:** `appointments.waitlist.promotion.test.ts`, `appointments.waitlist.offers.test.ts` — teardown passes clean.

---

### 7.3 `promoteFromWaitlist` side effect not accounted for in single-pass teardown (fixed — CI-07)

**Risk:** Any operation that frees a slot (cancel, reject, reschedule) triggers `promoteFromWaitlist` as a side effect. Teardown code that cancels appointments to free a slot — and then calls `deleteSlot` in one pass — doesn't account for the possibility that `promoteFromWaitlist` re-booked the slot with another patient between cancel and delete.

**How the system protects itself (after fix):** `slotFixture.ts` teardown uses a loop (up to 5 passes) that re-lists appointments after each cancellation and repeats until no active appointments remain. Each pass empties one waitlist entry.

**Residual weakness:** If more than 5 patients are on the waitlist for a doctor when teardown runs, the loop would terminate early and `deleteSlot` would still fail. In practice tests use at most 2 patients.

---

## 8. Kafka event stream weaknesses (found 2026-08-24)

The producer, the eight `clinic.appointment.*` topics and the companion test file were written on
2026-05-15 and marked *"pending Docker verification"* in `PROJECT_PLAN.md`. 2026-08-24 was the first
time any of it met a running broker. Everything below surfaced in that first session.

### 8.1 `appointmentId` is reused across records — event correlation is unsafe

**Risk:** Appointment ids come from the SQLite rowid without `AUTOINCREMENT`. When a record is
deleted, the freed id is handed to the next insert. In a single suite run the SUT emitted:

```
booked    {appointmentId: 1, patientId: 11}
cancelled {appointmentId: 1, patientId: 11, cancelledBy: "doctor"}
booked    {appointmentId: 1, patientId: 12}
cancelled {appointmentId: 1, patientId: 12, cancelledBy: "patient"}
```

Five different records of five different patients were published under `appointmentId: 1`.

**Why it matters downstream:** a consumer that deduplicates, correlates or builds state keyed on
`appointmentId` — the natural choice, and the one the project's own task in `TASKS.md` §"one Kafka
event per booking" points at — will merge unrelated patients into one entity. In a clinic that means
a cancellation notice addressed to the wrong person; the event itself is well-formed, so nothing
alerts.

**How it was found:** a test filtering events by `appointmentId` claimed the cancellation emitted by
the *previous* test's account teardown and failed with `patientId 10 vs 11`. The mismatched id is
the visible symptom; the reusable key is the defect.

**Mitigation in the tests:** events are correlated on `X-Request-Id`, which is unique per request and
present both in the response header and in every event payload. `BaseClient.parseResponse` now
returns `headers` so any test can do this.

**Not yet addressed in the SUT:** the id itself. Options are `AUTOINCREMENT` (monotonic rowids), or
a UUID business key on the event. See `sut/DESIGN_PROPOSALS.md` before changing the schema.

**Test coverage:** ✅ all 8 topics in `appointments.kafka.test.ts`, correlated by request id.

---

### 8.2 Deleting a patient account publishes `cancelled` with `cancelledBy: "doctor"`

**Risk:** When the `user` fixture removes its account, the patient's booking is cancelled and the
event goes out attributed to the doctor:

```
cancelled {appointmentId: 1, patientId: 11, cancelledBy: "doctor", doctorId: 1}
```

No doctor took that action. A consumer driving notifications would tell the patient their doctor
cancelled on them; a consumer building cancellation metrics would charge the cancellation to the
doctor's rate.

**Status:** open — found 2026-08-24, no fix attempted. The event needs a third attribution value
(`system`, `account_deleted`) rather than borrowing the doctor's.

**Test coverage:** ❌ none — the behaviour was observed in the recorder log, not asserted.

---

### 8.3 A consumer group per test is never cleaned up

**Risk:** The original helper created a consumer group per test (`test-${Date.now()}-...`) and only
called `disconnect()`, which leaves the group registered until offsets retention expires — 7 days by
default. After six suite runs the broker held 54 groups.

**Effect:** rebalances slow down as the coordinator carries more groups, until the 5s wait for a
message expires. The failure message reads `Kafka message not received within 5000ms`, which points
at the producer while the actual cause is test litter on the broker. On CI this is the shape of a
suite that passes for a month and then starts failing for no visible reason.

**Mitigation:** one recorder per suite instead of one consumer per test, plus
`cleanupTestConsumerGroups()` on start and `deleteGroups` on stop. Groups on the broker after five
runs: 0.

**Test coverage:** ✅ structural — the helper deletes its own group; verified by counting groups.

---

### 8.4 Topic auto-creation raced the subscribe

**Risk:** The suite relied on `KAFKA_AUTO_CREATE_TOPICS_ENABLE`. Auto-creation is asynchronous: the
metadata request that triggers it is answered with `This server does not host this topic-partition`
while the topic is still being created.

**Effect:** on a clean broker the suite failed 8/9; on the second run 2/9; by the third it passed.
The suite was silently depending on topics left behind by earlier runs — and testing a broker
configuration that production normally disables.

**Mitigation:** `ensureKafkaTopics()` creates all eight topics through the admin client in
`beforeAll`, with `waitForLeaders: true`.

**Test coverage:** ✅ verified from a torn-down broker (`down -v`): 9/9, five consecutive runs.

---

### 8.5 `X-Request-Id` is generated, never accepted from the caller

**Risk:** `src/middlewares/request-id.js` always assigns a fresh UUID and ignores any inbound
`X-Request-Id`. A caller that already has a correlation id — an upstream service, a load test, a
client retry — cannot carry it into the SUT's logs or its Kafka events.

**Effect:** traces break at the SUT boundary. Correlating "this user action" with "this event" across
services requires the id to survive the hop, which is exactly the guarantee tracing depends on.

**Status:** open — found 2026-08-24. A one-line change (`req.requestId = req.get('X-Request-Id') ||
uuidv4()`) would fix it, but accepting a caller-supplied id needs a validation and trust decision
first, so it is written up rather than patched.

**Test coverage:** ❌ none.

---

## 9. Response cache weaknesses (added 2026-08-24)

A read-through Redis cache now serves `GET /doctors` and `GET /doctors/:id/slots` with a 30s TTL.
Without `REDIS_URL` the cache is inert and every read goes to SQLite, the same degradation contract
the Kafka producer follows — verified by stopping the container mid-session: both endpoints kept
answering 200.

### 9.1 A cached slot list is wrong the moment a slot is taken

**Risk:** slot availability changes on booking, cancellation, rejection, reschedule, completion,
slot creation, slot deletion, waitlist acceptance and series operations. A cache that misses any of
those paths offers a slot that is already taken.

**Effect:** two patients are handed the same slot and race for it. The unique index catches the
second write with a 409, so the data stays correct — but the API advertised availability that did
not exist, and the second patient sees a failure that looks like a bug.

**How it is protected:** every mutating path invalidates. Where the doctor is known cheaply, the
specific key is dropped; on waitlist and series paths, all slot keys are dropped through a SCAN
sweep (never KEYS — it blocks the server for the whole keyspace).

**Oracle proven:** invalidation on booking was disabled deliberately and the suite failed with the
cached list still advertising the taken slot. A cache test that has never been seen failing is not
evidence of anything.

**Test coverage:** ✅ `doctors.cache.test.ts` — 6 tests: TTL is bounded (never `-1`), the read is
genuinely served from the cache (a planted value the database could not produce comes back),
booking drops the entry, cancelling restores the slot, slot create/delete invalidate, and a cached
entry can never turn an unknown doctor into a 200.

---

### 9.2 Test-data collisions surfaced by suite growth (found 2026-08-24)

Two failures appeared in the full API run once the Kafka and cache tests began executing. Neither
was caused by the cache; both were latent test-data defects that a larger suite exposed.

**`slotFixture` shares one doctor.** Every test books against `seedDoctors[0]`, so slot windows are
a global resource. `nextSeedSlotWindow` walks forward four slots per day (10:00, 12:00, 14:00,
16:00).

1. **The recurring Kafka test left a slot behind forever.** It created a slot a week out and
   deleted it in `finally`, but `deleteOwnedSlotIfUnused` refuses a slot carrying an active
   appointment, and the series was still live. The slot survived every run, and once the window
   counter reached that date, unrelated tests failed with `SLOT_OVERLAP`. Fixed: the series is
   cancelled before the slot is dropped.

2. **`doctors.schedule.test.ts` defended itself with a day offset that expired.** `slotAt` added
   `+7` days with the comment *"avoids conflicts with slotFixture"*. At ~200 tests the fixture
   already covers 50 days forward, so the gap was long gone. A day offset can always be overtaken
   by suite growth; the hour cannot — the fixture only ever uses even hours, so the test moved to
   11:00. Fixed.

**Pattern worth keeping:** a test suite that shares a mutable resource has a capacity, and the
defences written against collisions have to be checked against the suite's current size, not the
size it had when they were written.

**Test coverage:** ✅ full API suite green after both fixes — 199 passed, 0 failed (B-14 remains a
deliberate, expected failure).

---

## 10. GraphQL surface weaknesses (added 2026-08-24)

`POST /api/v1/graphql` exposes `doctors`, `doctor(id)` and `myAppointments` over the same
repositories the REST routes use. A second read surface on one domain, added for the failure modes
REST does not have.

### 10.1 A rejected request still answers HTTP 200

**Risk:** `{ doctors { id salary } }` fails schema validation before any resolver runs, and the
server answers **200** with an `errors` array. `myAppointments` without a token behaves the same
way: 200, `data: null`, `errors[0].extensions.errorCode = AUTH_REQUIRED`.

**Effect:** every tool that judges health by status code — an uptime check, a 4xx/5xx alert, a
latency dashboard split by status, a smoke test asserting `expect(status).toBe(200)` — reports a
healthy API while every request is failing. In REST the same two failures are a 400 and a 401.

**Sharper still:** the status depends on the `Accept` header. The same invalid query returns **400**
under `application/graphql-response+json` and **200** under `application/json` or no Accept at all.
A test written against one media type says nothing about clients using the other.

**Test coverage:** ✅ `graphql.test.ts` — both media types pinned, and the unauthenticated case
asserts the 200/`errors` pair rather than the status alone.

**Not addressed:** monitoring. Nothing currently counts `errors[]` in GraphQL responses, so a rise
in failures is invisible to the observability stack. Worth a counter next to the existing metrics.

---

### 10.2 Nested fields let the caller choose the database cost (fixed)

**Risk:** `Doctor.slots` resolved per parent, so `{ doctors { slots } }` issued one query per
doctor — measured at **6 queries for 6 doctors** through a new `db_slot_queries_total` counter. The
multiplier is chosen by the client, by adding one nested field, and grows with the data.

**Effect:** a request that looks small is expensive, and the cost scales with the doctor table. On a
marketplace-sized dataset this is the standard GraphQL outage.

**Fixed:** a per-request batching loader (the DataLoader pattern, ~30 lines, no dependency) collects
the calls made in one tick and answers them with a single `IN` query. Measured after the fix: **1
query**. The loader is per-request on purpose — a shared one would serve one caller's data to the
next, and availability changes between requests.

**Test coverage:** ✅ the test reads the counter before and after and requires ≤1 query; it was
first written against the naive resolver and observed failing with "6 queries for 6 doctors".

---

### 10.3 Query depth is bounded by the schema, not by a rule

**Status:** no depth or complexity limit is enforced. Today the schema has no cycle — `Doctor` leads
to `Slot`, and `Slot` leads nowhere — so depth is naturally finite and an abusive query cannot be
constructed. This holds only as long as that stays true: adding `Slot.doctor` or
`Appointment.patient` would open the usual unbounded-nesting problem and a depth rule would become
necessary. Recorded so the absence is a decision rather than an oversight.

**Test coverage:** ❌ none — nothing to assert while the schema is acyclic.

---

## 11. Patient data leaving the SUT (added 2026-08-26)

`symptoms` is the only free-text field this API carries that is health information about an
*identified* person — the request arrives with a bearer token, so the text is not anonymous. It
leaves the SUT by design in exactly one direction, into the prompt. Everything below is about the
directions it must not leave by, and what was and was not guarding them.

### 11.1 Three exits, none of them tested (found 2026-08-26)

**Risk:** the input reached three surfaces that outlive the request — the log stream (Loki keeps it),
the error bodies handed back to the client, and the AI bug reporter, which sends a failed test's
error message and stack to Anthropic, writes them to `bug-reports/`, and attaches them to Allure.
Nothing asserted anything about any of them.

**What was found on inspection.** Two of the three were already correct and simply unguarded. The
route logs `symptomsCharCount`, not the text (`sut/src/routes/aiRoutes.js`), and no error message on
any status is built from the input. That is the reason to write the tests rather than a reason not
to: the next `req.log.info({ symptoms })` added while debugging would have been caught by nothing,
and the redaction list in `logger.js` covered `authorization` and `cookie` on the same terms — right,
and asserted nowhere.

The third was a real gap. `utils/aiBugReporter.ts` passed `error.message` and `error.stack` straight
into a prompt. Playwright builds an assertion message out of the values it compared, so a failing
`@rag` test carries the symptoms and a failing auth test carries an address and a bearer token — to
a third party, into a file, and into a report artifact.

**Fix:** `utils/phi.ts` — `redactPhi()` replaces the field values this API actually carries
(`symptoms`, `email`, `password`, `name`, `reasoning`, and the three token fields), plus bare
addresses and JWTs wherever they appear. `buildBugReportPrompt()` was split out of the transport so
what leaves can be asserted without a key or a network call. Deliberately not a classifier: what it
does not recognise stays, because a report reduced to `[redacted]` is not a report, and handing the
text to a model to decide what is sensitive routes it through the very hop this guards.

**Tests:** `sut/src/__tests__/aiPrivacy.test.js` (6) drives the real `src/app.js` over a real socket
with a marker string in the symptoms and asserts it appears in no log line on the 200, 400, 422, 404
and 503 paths, and that the bearer token is redacted rather than merely absent.
`sut/src/__tests__/aiServicePrivacy.test.js` (5) does the same for the standalone service's answers.
`tests/unit/bug-reporter.redaction.test.ts` (9) covers the redactor and the prompt.

Each was proven from both sides: adding `symptoms` to the route's log line, emptying the redaction
list, building `err.message` from the prompt, and removing `redactPhi` from the reporter each turn
exactly the corresponding test red.

**Deliberately not covered.** The Allure parameters in `ai.recommend.test.ts` print symptoms, but
those are literals written in the test file, not input from a patient — redacting them would hide
the evidence a failed AI test exists to show.

### 11.2 A malformed model answer is reported as an outage (found 2026-08-26, open)

**Risk:** `callClaude()` in `ai-service/index.js` wraps both the network call and
`message.content[0].text` in one `try` with a bare `catch`, so a 200 whose body is not the expected
shape raises `CLAUDE_UNAVAILABLE` — a `503 claude_unavailable`. The service's own 500 branch is
unreachable through the model path.

**Effect:** a parse failure and an outage are the same signal, and they send whoever is on call to
different systems. It is also the failure structured outputs were adopted to make visible: the SUT
copy distinguishes the two in its message, the service does not.

**Direction of a fix:** narrow the `try` to the request, and classify a body that does not match the
schema separately — the SUT copy's wording (`did not match the requested schema`) already exists to
be reused. Not done here; found while writing 11.1 and recorded rather than folded into it.

**Test:** `aiServicePrivacy.test.js` pins the current behaviour (`503`, no input echoed), so a fix
will surface as that test failing on the status rather than silently changing the contract.

## 12. Agentic AI weaknesses (added 2026-08-27)

Mapped against the OWASP Top 10 for Agentic Applications (ASI01–ASI10, published 2025-12-09). The
full applicability analysis — including the six categories this system cannot have, and what would
have to be built for them to apply — is `docs/OWASP_AGENTIC.md`. Only the weaknesses are here.

### 12.1 The AI route reached a paid external model for an unidentified caller ✅ FIXED 2026-08-27

**Risk:** `POST /api/v1/ai/recommend-doctor` had no `requireAuth`. A request with no `Authorization`
header returned `200` and a recommendation; so did `Bearer garbage.token.here`, because the token was
never parsed — a malformed credential was indistinguishable from a valid one. Every other domain
route required a token. The one route that spends money at a third party did not.

**Effect:** three, in the order they bite. (1) Unbounded cost — anyone could spend the operator's
Anthropic balance. (2) The rate limiter degraded: `aiRateLimitKey` hashes the `Authorization` header
and falls back to the literal `guest`, so all anonymous callers shared one `<ip>:guest` bucket, and
the per-user half of the key engaged only for authenticated callers. Combined with per-IP-only
limiting (D-03), the practical ceiling was low. (3) Free text from an unauthenticated source reached
a prompt with no barrier in front of it.

**Why it maps to ASI03 rather than to a plain missing auth check:** the category is about an action
performed under a borrowed identity. The caller borrowed the operator's Anthropic credential without
presenting one of their own.

**Fix:** `requireAuth` on the route; `security: [bearerAuth]` and the `401`/`404` responses added to
`openapi/openapi.yaml`, which had documented neither. Both consumers already send a token, so nothing
changed on either client.

**Tests:** `tests/api/security.agentic.test.ts` (3) — 401 without a token, 401 with a malformed token,
200 for an authenticated patient. Removing `requireAuth` turns exactly the two 401 tests red.

**Why it survived:** the suite's own client always sent a token, so every test of this route
exercised the authenticated path. Nothing asked the opposite question.

### 12.5 The circuit breaker was implemented and tested nowhere (ASI08, ✅ COVERED 2026-08-27)

**Risk:** `aiRecommendation.js` implements a closed → open → half-open breaker over
`CLAUDE_UNAVAILABLE` failures and publishes it on `GET /api/v1/ai/circuit-state`; `getCircuitState`,
`resetCircuit` and `forceCircuitOpen` are exported. For a long time no test in either repository
called any of them.

**Effect while it lasted:** the component whose job is to stop a model outage becoming a retry storm
against a paid API was the one link in the chain nothing asserted here. The two propagation paths
around it *were* covered ("Claude unreachable", "ai-service unreachable"), which is what made the gap
easy to miss — the propagation of a failure looks like the handling of a failure.

**One correction to "tested nowhere" (2026-08-27).** The mobile project does test it:
`clinic-mobile-tests/features/circuit-breaker.feature` drives all three states through
`POST /api/v1/debug/ai-circuit-control` and reads `/circuit-state`, and those scenarios were green
throughout. They could not have found either defect below, and that is the point worth keeping rather
than the correction itself. A mobile scenario asserts that the state reads `open` and that the
patient sees an error — the right questions for that layer. The status code behind the error never
reaches an assertion (12.7), and the counting semantics are invisible from outside a single scenario,
because seeing them requires a failure, then a success, then another failure in one process (12.6).
So the accurate statement is not "untested" but "tested only where these defects cannot be seen",
which is a claim about layers rather than about effort.

**How it was found:** writing a cross-reference comment that claimed ASI08 was covered by "the
circuit breaker tests"; grepping for `circuit` across both suites returned that comment and nothing
else. The claim came from assuming a component that visible must be tested.

**Closed by:** `sut/src/__tests__/aiCircuitBreaker.test.js` — 16 tests in two halves: 14 on states
and transitions through a mocked dependency (closed → open → half-open → closed, plus what counts as
a failure and what does not), and 2 on the route itself over real HTTP against the assembled app in
`CLAUDE_DEGRADE` mode, because what an open breaker looks like to a caller is a separate question
from what the module's internal state says. Writing it immediately surfaced 12.6 below.

**Checked by mutation, not by coverage:** five deliberate breaks in `aiRecommendation.js` — fail-fast
removed, no transition to half-open, the threshold comparison shifted, `openedAt` not restamped on
reopening, and the failure condition widened to count every thrown error. The first four turned the
suite red immediately. **The fifth survived**, because the test meant to pin the condition used an
unroutable specialty — which returns `{ ok: false }` rather than throwing, so it never reaches the
`catch` at all and cannot distinguish "only these two codes count" from "everything counts". The
14th test (`an error that is not an unavailable dependency does not count`) was added for that
mutation and kills it. Worth recording as its own small lesson: a test that exercises the right
scenario can still be blind to the branch it was written for.

### 12.6 The breaker counted failures that were not consecutive (✅ FIXED 2026-08-27)

**Risk:** the comment above the implementation reads *"Tracks consecutive CLAUDE_UNAVAILABLE
failures"*. It does not. `_onSuccess()` — which resets the counter — runs only when the state is
already half-open:

```js
if (_state === "half-open") _onSuccess();
```

So a success on the ordinary closed path leaves `_failures` where it was. One failure, any number of
healthy calls in between, one more failure, and a breaker configured for two consecutive failures
opens.

**Effect:** the breaker trips on a cumulative failure count over the process's whole lifetime rather
than on a burst. On a long-running instance it will eventually open during normal operation — two
unrelated blips hours apart are enough — and take a healthy endpoint out of service. That is the
opposite of what a breaker is for: it is meant to shed load during an outage, not to accumulate a
grudge.

**Fix:** `_onSuccess()` is now called on any success, not only in half-open — the reading the
docstring was already claiming. The alternative (keep the cumulative count, decay it over time, and
correct the comment) was rejected: nothing in the design wanted a lifetime tally, and the comment is
evidence of intent rather than of a deliberate choice.

```js
// before                                  // after
if (_state === "half-open") _onSuccess();  _onSuccess();
```

**Proven by the test going red.** The test had been written against the defect and pinned it
deliberately; applying the fix turned it — and only it, plus 12.7's — red, which is the evidence that
it was testing the thing it claimed to. It is now `a success clears the count, so the failures that
open it are consecutive ones`, and it carries a second half the pinned version did not need: a
genuine run of adjacent failures still opens the breaker. Without that, a fix that simply disabled
the breaker would pass every other assertion in the file.

**Why this one is worth the paragraph:** it is the second time on this route that a comment described
intent and the code did something else (the first was the prompt asking for JSON while nothing
enforced it). Both were found by writing a test against the documented behaviour rather than against
the observed one.

### 12.7 An open breaker answered 500, not 503 — and its error code was in no contract (✅ FIXED 2026-08-27)

**Risk:** when the breaker is open, `recommendDoctors` throws an error carrying
`code = "CIRCUIT_OPEN"`. `routes/aiRoutes.js` maps exactly two codes to a status — `CLAUDE_UNAVAILABLE`
and `AI_SERVICE_UNAVAILABLE` — so `CIRCUIT_OPEN` falls through to the generic error handler with no
`status` set and is answered as **`500 INTERNAL_ERROR`**.

**Effect:** the breaker works, and then tells the caller the wrong thing. `503` means "the dependency
is down, back off and retry"; `500` means "this service is broken". A client, a retry policy, an
uptime check and an on-call alert all treat those differently — and the breaker exists precisely to
produce the first one cheaply. So the mechanism that is supposed to shed load politely announces
itself as a server fault instead.

**Second half of the same gap:** `CIRCUIT_OPEN` appeared in no contract document — not in
`API_ENDPOINTS.md`, not in `openapi/openapi.yaml`. A code that can reach a client and is written down
nowhere cannot be depended on by one. (An earlier draft of this entry also named `CONTRACT_PACK.md`;
there is no such file in either repository.)

**And a third thing the fix surfaced.** Documenting the code meant looking at what else was missing
from the same block, and two more things were: `AI_SERVICE_UNAVAILABLE` had been answerable since
2026-08-21 and was in `API_ENDPOINTS.md` but never in the OpenAPI spec, and `GET /api/v1/ai/circuit-state`
— unauthenticated, as old as the breaker itself — was in neither. The route that publishes the
breaker's state was as undocumented as the breaker's error code.

**Fix:** `CIRCUIT_OPEN` is mapped to `503` in `aiRoutes.js` alongside the other two — the breaker is
a dependency-unavailable condition by definition. It keeps its own code rather than collapsing into
`CLAUDE_UNAVAILABLE`: to an operator "the model failed" and "we stopped asking" are different events,
which is the same reasoning that split `CLAUDE_UNAVAILABLE` from `AI_SERVICE_UNAVAILABLE`. Written
down in `API_ENDPOINTS.md` and `openapi/openapi.yaml`, together with the two omissions above.

**Proven by the test going red**, the same way as 12.6. `aiCircuitBreaker.test.js` now asserts
`503` / `CIRCUIT_OPEN` over real HTTP, and the 405 rule the spec follows applies to the newly
documented `/circuit-state` path without a change — the handler walks the router rather than a
second table, so a path added to the spec is already answering correctly.

**What the fix uncovered on the client (project 2, fixed the same day).** Giving the condition a name
made it reachable by name, and the mobile app was not handling it. `SymptomCheckerScreen.tsx` branches
on `errorCode`: `FEATURE_DISABLED` and `CLAUDE_UNAVAILABLE` get *"AI recommendations are temporarily
unavailable. Please browse all doctors instead"*, and everything else falls through to *"Something
went wrong. Please try again."* An open breaker landed in the second — asking the patient to retry a
request the backend has deliberately stopped making, which is the exact load the breaker exists to
prevent. `CIRCUIT_OPEN` now joins the first branch, with five new unit tests
(`clinic-mobile/__tests__/SymptomCheckerScreen.test.tsx`, none existed for that screen) of which one
was observed failing without the fix.

**And why the mobile suite had not caught it**, despite testing the breaker end to end since 2026-08-21:
the step `the symptom checker shows a patient-appropriate error within 3 seconds` read the error text
through `this.el?.('symptom-error')?.getText?.()` — and `this.el` is defined nowhere in that project's
`support/`, so the optional chain collapsed to `''` on every run, was attached to the report, and was
never asserted on. `getErrorText()` existed on the page object and went unused. The step proved an
error appeared quickly, which is a real fast-fail assertion, and named itself after a claim it never
checked. Now fixed to read through the page object and to assert that the copy does not say *"try
again"*. Written up as §17 of `clinic-mobile-tests/MOBILE_TESTING_INSIGHTS.md`.

### 12.2 The two services do not authenticate each other (ASI07, open)

**Risk:** `POST /recommend` on `ai-service` accepts any caller that can reach the port. The service
holds an Anthropic key and sends any text it is given to a model. Nothing binds a request to the SUT.

**Mitigated in one direction only:** the SUT does not trust what comes back — `recommendViaService`
re-checks the specialty against the allow-list, now covered by
`sut/src/__tests__/aiSupplyChain.test.js` (4 tests, ASI04). The missing direction is that the service
does not know who is asking.

**Direction of a fix:** a shared secret header verified by the service, or mTLS if the topology grows.
Not done here: it changes the contract between two deployables and the Pact file that pins it.

### 12.3 The recommendation carries no disclosure that it is machine-generated (ASI09, open)

**Risk:** the response is `{ recommendedSpecialty, doctors, reasoning }` and nothing else. Nothing
marks it as an AI recommendation rather than clinical advice, and `reasoning` is model-written prose
that reads like a clinician's note.

**Where it is covered and where it is not:** EU AI Act Art. 13 transparency is tested on the mobile
client (`clinic-mobile-tests/features/eu-ai-act.feature` — a disclosure banner in the UI). The
requirement is therefore met at one surface and absent at the API, where any other consumer meets it.

**Direction of a fix:** a constant flag on the response body, documented in the spec, so a consumer
cannot present the output as a diagnosis without ignoring the contract. Left open deliberately —
adding a field is a product decision; `security.agentic.test.ts` pins the current shape and says so.

### 12.4 The retrieval corpus is interpolated into the prompt unescaped (ASI06, guarded)

**Risk:** the top three knowledge entries become prompt lines as `- ${specialty}: ${description}`,
joined by newlines, with no delimiter and no role boundary. A `\n` inside a description does not
corrupt the JSON and does not fail a schema check — it buys the author of that row as many extra
prompt lines as they want, in the position the model reads as the system's own instructions.
Poisoning this context needs a pull request against a data file, not access to the model.

**Guard rather than fix:** `tests/unit/knowledge-integrity.test.ts` (4) asserts one prompt line per
entry, a line count equal to the entry count, no directive phrasing, and a length bound. Escaping the
interpolation would be the structural fix and is not done — the corpus is a checked-in file with six
rows, so the guard sits where a change to it would be reviewed.

## 13. CI infrastructure weaknesses (added 2026-08-29)

Weaknesses in the harness rather than in the SUT. They are recorded here because both of them
produced a red pipeline that pointed at the wrong thing — the first reported a missing package as a
failure of the smoke gate, the second is the reason it could.

### 13.1 The test repository resolved the SUT's dependencies out of its own `node_modules` (found and fixed 2026-08-29)

**Risk:** `tests/unit/ai.retrieval.test.ts` and `ai.retrieval.metrics.test.ts` load SUT production
code into the Playwright process directly:

```ts
require(path.join(SUT_ROOT, 'src/services/aiRecommendation'))
```

In CI the SUT is checked out into `./sut` and started in Docker, where its dependencies live inside
the image. Nothing ran `npm install` in that directory, so `sut/node_modules` did not exist on the
runner, and Node resolved every bare `require` in the SUT's own source upwards — into the test
repository's `node_modules`.

That worked by coincidence. Everything `aiRecommendation.js` reached (`@anthropic-ai/sdk`, and
`better-sqlite3` transitively through `doctorsRepository` → `db/connection`) happens to be listed in
this repository's `package.json`, for reasons that were never written down as this reason.

**What broke it:** SUT commit `255fa4a` (2026-08-28, "Record what a model call did, in gen_ai.*
names") added a seventh require to `aiRecommendation.js` — `../telemetry/genAiTelemetry`, which
pulls `@opentelemetry/api` and `@opentelemetry/semantic-conventions/incubating`. Neither is a
dependency of this repository. Locally the suite stayed green, because `sut/node_modules` exists on
a development machine.

**Effect:** every job that starts Playwright failed at file collection — seven in `api-tests.yml`
plus `impact-analysis`, `security-scan` (agentic), `model-drift` and `update-visual-snapshots`. A
change to the SUT's observability, in a different repository, took the whole pipeline down, and the
first line of the log named the smoke script.

**Why the obvious fix was not taken:** adding `@opentelemetry/api` and
`@opentelemetry/semantic-conventions` to this repository's `package.json` would have restored the
green in one line, and would have deepened the problem. Two package files would then carry the same
libraries at independently drifting versions, and these unit tests would be checking SUT code
against a *different* build of a dependency than the one running in the container — a test that no
longer testifies about production while still reporting a pass.

**Fix:** `npm ci --prefix sut --omit=dev` alongside the existing `npm ci`, in all seven jobs that
start Playwright, with `sut/package-lock.json` added to the `setup-node` cache key. The SUT gets its
own dependency tree, so resolution on the runner matches the developer machine and the Docker image.
`--omit=dev` skips Jest and Stryker, which nothing on the runner uses: 43 packages, ~10s uncached.
`chaos.yml` and `rate-limit.yml` were never affected — both already run `npm ci` in `sut` for their
seeding step.

**Verification:** a copy of the SUT without `node_modules`, placed inside the test repository,
reproduces the runner's resolution exactly. Against that copy the pre-fix command fails identically
to CI (`genAiTelemetry.js:21`, `Total: 0 tests in 0 files`); after `npm ci --prefix … --omit=dev`
collection succeeds — 42 unit tests listed, 40 passed / 2 skipped.

**Residual weakness:** nothing tests that the two repositories stay compatible. The next SUT commit
that adds a top-level require will still be discovered by a red pipeline rather than by a check, and
the discovery will still arrive named as whichever gate ran first. The structural answer is that
`retrieve` and `buildPrompt` are pure functions of the SUT and their unit tests belong in the SUT
repository, where dependencies are installed by definition — not adopted here, deliberately: the
RAG unit layer is part of what this suite exists to demonstrate.

### 13.2 A collection error in one file is reported as a failure of an unrelated gate (open)

**Risk:** `playwright.config.ts` sets `testDir: "./tests"` and defines no project boundary around
`tests/unit/`. Playwright loads every file under `testDir` before `--grep` filters anything, so an
import error in any file fails every run, whatever it was scoped to.

**Effect, observed in 13.1:** the failing tests are tagged `@unit`. The job that reported the
failure was `Smoke`, whose step reads `run: npm run test:smoke`. Nothing in the first screen of the
log connects the failure to the unit layer, and the tag that would have connected them is the one
thing `--grep` never got to evaluate.

**Direction of a fix:** a separate Playwright project for `tests/unit/`, so that layer loads — and
fails — as itself. Not done: it changes how every job selects tests and wants its own verification
run.

**Test:** none. This is a property of the runner configuration, not a behaviour of the SUT.

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
| IDOR on `GET /appointments/:id` | High | ✅ fixed: `requireAuth` + ownership check | ✅ `security.test.ts` (found + fixed 2026-04-30) |
| Rate limit per-IP only | Low | Partial | Partial — 429 contract only |
| SQLite write bottleneck | Medium | ❌ architectural limit | ⚠️ baseline only — `k6/booking-flow.js`; expiry spike not isolated |
| No slot soft-lock in UI | Low | ✅ clean 409 error | ✅ `booking-conflict.e2e` |
| Accessibility violations (missing landmarks, headings) | Medium | ✅ fixed: `<main>` + `<h1>` added; recurrence fixed 2026-05-22 (5 new pages + 14 unlabelled inputs) | ✅ `accessibility.test.ts` (found + fixed 2026-04-30; recurrence caught 2026-05-22) |
| Color contrast below WCAG AA | Low | ❌ known design debt (#64748b) | ⚠️ excluded from axe run, documented |
| Retrieval quality — ambiguous symptoms route to wrong specialty | Medium | Partial — LLM may correct; mock mode exposes raw retrieval | ❌ no regression test for ambiguous symptoms (found 2026-05-08, Pact) |
| Specialty/seed data mismatch — `doctors: []` on valid 200 | Medium | ❌ no guard | ❌ no test; silent failure (found 2026-05-08, Pact) |
| Reschedule free+promote+book atomicity | Low | ✅ single transaction + unique index; operation order fixed (B-07) | ✅ 8 tests; concurrency scenario planned |
| Malformed JWT → `400 <EMPTY>` — error contract violation | Medium | ❌ middleware fires before route handler, returns raw 400 | ❌ found by Schemathesis 2026-05-12 — no test for malformed (vs missing) auth header |
| TRACE method returns 404 instead of 405 | Low | ❌ Express default | ❌ not tested — HTTP spec requires 405 for unsupported methods |
| `POST /consultations` missing `401` in OpenAPI spec | Low | N/A — spec doc gap | ❌ spec does not document 401 for auth-required endpoints |
| FK enforcement gap in `deleteOwnedSlotIfUnused` | Medium | ✅ fixed B-08: `waitlist_offers` deleted first in transaction | ✅ all waitlist teardowns pass clean (2026-05-20) |
| `softDeleteUser` missing waitlist cascade | Medium | ✅ fixed B-09: slot_waitlist cleared in softDelete transaction | ✅ twoUsersFixture teardown passes clean (2026-05-20) |
| `promoteFromWaitlist` side effect in teardown | Low | ✅ fixed CI-07: retry loop in slotFixture teardown | ✅ offers + promotion tests teardown clean (2026-05-20) |
| Unanswered waitlist offer holds the slot past its TTL | High | ✅ addressed B-10 (2026-08-13): `expireStaleOffers()` sweep + `AUTO_EXPIRE_OFFERS_INTERVAL_MS` timer; the 410 path in `acceptOffer` releases the slot | ✅ covered by four expiry tests in `appointments.waitlist.offers.test.ts`; 2 confirmed failing against the pre-fix build |
| Expiry write and its `410` throw shared one transaction | Medium | ✅ addressed B-11 (2026-08-13): expiry returns a marker, throw moved outside `db.transaction()` | ✅ `410 OFFER_EXPIRED is persisted, not rolled back` |
| Lapsed offer leaves the same patient first in line | Medium | ✅ addressed B-12 (2026-08-13): `getNextWaitlistEntry` covers `expired` alongside `declined` | ✅ `expired offer is not handed back to the same patient` |
| `isAvailable` consistency depended on scenario coverage | Medium | ✅ addressed 2026-08-13: `ASSERT_INVARIANTS` runtime contract (5 checks) answers 500 on a violation; `idx_offers_one_pending_per_slot` carries one of them structurally | ✅ `invariants.test.ts` — oracle proven to fail on deliberate desync |
| `isAvailable` conflates doctor intent with occupancy | Medium | ❌ by design for now — a slot closed by the doctor and a slot frozen by a lost offer are indistinguishable | ⚠️ not detectable; schema split deferred, see `sut/DESIGN_PROPOSALS.md` §1 option D |
| Storage type leaked into the JSON contract (`isAvailable` = `1`, not `true`) | Medium | fixed B-15 (2026-08-22): `toApiSlot` maps the API read paths; OpenAPI response schema corrected | `mobile.pact.provider.test.ts` — type-level oracle; found and now guards the fix |
| `appointmentId` reused after deletion — unsafe as an event correlation key | High | ❌ open — rowid without `AUTOINCREMENT` (found 2026-08-24) | ✅ tests correlate on `X-Request-Id` instead; the id reuse itself is untested |
| Account deletion publishes `cancelled` as `cancelledBy: "doctor"` | Medium | ❌ open — no `system` attribution value (found 2026-08-24) | ❌ observed in recorder log, not asserted |
| Consumer group per test never deleted — broker accumulates groups | Medium | ✅ fixed 2026-08-24: one recorder per suite + `deleteGroups` on stop | ✅ 0 groups after five runs |
| Kafka suite depended on asynchronous topic auto-creation | Medium | ✅ fixed 2026-08-24: `ensureKafkaTopics()` in `beforeAll` | ✅ 9/9 from a torn-down broker, five consecutive runs |
| `X-Request-Id` ignored on inbound requests — trace breaks at the SUT | Medium | ❌ open (found 2026-08-24) | ❌ none |
| Cached slot list served a slot already booked | High | ✅ invalidation on every availability-changing path (2026-08-24); SCAN sweep where the doctor is not cheaply known | ✅ `doctors.cache.test.ts` — oracle proven by disabling invalidation |
| Cache entry without expiry would make a missed invalidation permanent | Medium | ✅ bounded TTL (30s) asserted, never `-1` | ✅ TTL test |
| Redis outage taking the API down with it | High | ✅ cache inert without `REDIS_URL`; container stopped mid-session, endpoints kept answering 200 | ⚠️ verified manually, not asserted in the suite |
| Recurring Kafka test leaked a slot on every run → `SLOT_OVERLAP` elsewhere | Medium | ✅ fixed 2026-08-24: series cancelled before the slot is deleted | ✅ full API suite green |
| `slotAt` day-offset defence outgrown by the suite | Medium | ✅ fixed 2026-08-24: moved to an hour `slotFixture` never allocates | ✅ full API suite green |
| GraphQL answers 200 for validation and auth failures | Medium | ⚠️ spec-compliant, not a defect — but status-based monitoring is blind to it (found 2026-08-24) | ✅ `graphql.test.ts` asserts the 200/`errors` pair; ❌ no metric counts GraphQL errors |
| Same invalid query returns 400 or 200 depending on `Accept` | Medium | ⚠️ by spec; a test on one media type does not cover the other | ✅ both media types pinned |
| `doctors { slots }` issued one query per doctor (N+1) | High | ✅ fixed 2026-08-24: per-request batching loader, 6 queries → 1 | ✅ counter-based test, observed failing before the fix |
| No query depth/complexity limit | Low | ⚠️ acyclic schema makes it moot today; revisit if a back-reference is added | ❌ none |
| Symptoms reachable in logs / error bodies / bug reports — no assertion either way | High | ✅ two exits were already clean; the reporter now redacts (`utils/phi.ts`) | ✅ 20 tests across `aiPrivacy`, `aiServicePrivacy`, `bug-reporter.redaction` (2026-08-26) |
| `ai-service` reports a malformed model answer as `503 claude_unavailable` | Medium | ❌ open — one `try`, one bare `catch` (found 2026-08-26) | ⚠️ current behaviour pinned, not endorsed |
| SUT and `ai-service` carry separate `@anthropic-ai/sdk` copies at different versions | Medium | ❌ open — 0.92.0 vs 0.95.1 (found 2026-08-26) | ❌ `aiServiceParity.test.js` compares prompt and schema, not the client |
| AI route performed a delegated call to a paid model with no caller identity (ASI03) | High | ✅ fixed 2026-08-27: `requireAuth` + spec updated | ✅ `security.agentic.test.ts` — proven red without the fix |
| SUT and `ai-service` do not authenticate each other (ASI07) | Medium | ❌ open — the return direction is checked, the inbound one is not | ⚠️ ASI04 half covered by `aiSupplyChain.test.js` |
| No server-side disclosure that a recommendation is machine-generated (ASI09) | Medium | ❌ open — met on the mobile client only | ⚠️ current response shape pinned, deliberately |
| Retrieval corpus interpolated into the prompt unescaped (ASI06) | Medium | ⚠️ guarded, not escaped | ✅ `knowledge-integrity.test.ts` — proven red on a poisoned row |
| Circuit breaker implemented, exposed on `/circuit-state`, asserted nowhere (ASI08) | Medium | ✅ covered 2026-08-27 | ✅ `aiCircuitBreaker.test.js` — 16 tests, states plus the route in `CLAUDE_DEGRADE` |
| Breaker counted non-consecutive failures — a long-lived process would open it during normal operation | Medium | ✅ fixed 2026-08-27: any success clears the count | ✅ `aiCircuitBreaker.test.js`, observed red against the pre-fix build |
| An open breaker answered `500 INTERNAL_ERROR` instead of `503`, and `CIRCUIT_OPEN` was in no contract | Medium | ✅ fixed 2026-08-27: mapped to 503; code, `AI_SERVICE_UNAVAILABLE` and `/circuit-state` added to the spec | ✅ `aiCircuitBreaker.test.js`, observed red against the pre-fix build |
| SUT source loaded by the unit layer resolved its dependencies from the test repository | High | ✅ fixed 2026-08-29: `npm ci --prefix sut --omit=dev` in all seven Playwright jobs | ⚠️ verified by reproducing the runner's resolution locally; no check guards the next divergence |
| A collection error in one file fails every job and is reported as the gate that ran first | Medium | ❌ open — `testDir: "./tests"`, no project boundary around `tests/unit/` | ❌ none — runner configuration, not SUT behaviour |

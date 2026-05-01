# System Weakness Report — clinic-booking-api

**Scope:** QA-perspective analysis of architectural risks, concurrency gaps, and business logic vulnerabilities in the SUT. This is not a penetration test — it is a structured map of failure modes that informed the test suite design.

**Companion documents:** `RISK_ANALYSIS.md` (impact × likelihood → test files), `DESIGN_PRINCIPLES.md` (how tests are built around these risks).

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

**Test coverage:** Not tested at DB level — no audit assertions exist. Planned as part of Audit Trail feature.

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

**Risk:** `GET /appointments/:id` existed without `requireAuth` and without an ownership check. Any unauthenticated user could read any appointment by ID. Any authenticated patient could read another patient's appointment.

**Found by:** `security.test.js` — two tests failed:
- `GET /:id` with no token → expected `401`, received `200`
- `GET /:id` with another patient's token → expected `403`, received `200`

**Fix applied to SUT (`appointmentsRoutes.js`):**
- Added `requireAuth` middleware to `GET /:id`
- Added ownership check: patient can only read their own appointment (`appointment.patientId !== userId` → `403 FORBIDDEN`)

**Test coverage:** `security.test.js` (`@security`) — 5 tests all green after fix.

---

### 3.3 Rate limiting is per-IP only

**Risk:** Rate limiters on `/login`, `/register`, and `POST /appointments` key on client IP. Behind a shared NAT (corporate network, VPN) or a reverse proxy that does not forward `X-Forwarded-For`, all users share one IP bucket. A single aggressive client exhausts the limit for everyone on that network.

**Residual weakness:** `TRUST_PROXY=false` by default. In a Docker or cloud deployment where a proxy sits in front, the real client IP is in `X-Forwarded-For`, not `req.ip`. Without `TRUST_PROXY=true`, the rate limiter sees the proxy IP and the limit never fires per-client.

**Test coverage:** Rate limit tests (`@rate-limit`) verify the 429 contract. The proxy trust scenario is not tested — requires infrastructure-level setup.

---

### 3.4 Accessibility violations — ✅ found and fixed (2026-04-30)

**Risk:** Pages lacked semantic HTML structure required by WCAG 2.1 AA. Screen reader users could not navigate pages efficiently.

**Found by:** `accessibility.test.js` (`@a11y`) using axe-core. Violations detected:
- `landmark-one-main` — no `<main>` landmark on login, register, booking pages
- `page-has-heading-one` — booking page had `<h2>` sections but no `<h1>`
- `region` — content not contained within landmark regions

**Fix applied to SUT:**
- Added `<main>` landmark to `login.html`, `register-patient.html`, `patient-booking.html`
- Added visually-hidden `<h1>Book an appointment</h1>` to booking page
- Added `.visually-hidden` CSS utility class to `app.css`

**Known residual:** `color-contrast` rule excluded — `.muted` uses `#64748b` (3.9:1 ratio, below WCAG AA 4.5:1). Documented design debt; requires a design decision to darken the palette.

**Test coverage:** `accessibility.test.js` — 3 tests all green after fix.

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

## 5. Summary table

| Weakness | Severity | Mitigated? | Test exists? |
|---|---|---|---|
| Double-booking race | High | ✅ transaction + unique index | ✅ `booking.conflict` |
| Concurrent waitlist promotion | Medium | ✅ transaction serialization | Partial — single-path only |
| Auto-expiry timer race | Low | ✅ SQLite serialization | ❌ planned |
| Slot state ambiguity (pending vs confirmed) | Medium | Partial — query filter | Partial — J3 test |
| No audit trail | Medium | ❌ logs only | ❌ planned (Audit Trail feature) |
| Waitlist fairness | Low | N/A — product decision | ❌ planned |
| Doctor self-registration | High | ❌ known gap | ❌ acknowledged |
| IDOR on `GET /appointments/:id` | High | ✅ fixed: `requireAuth` + ownership check | ✅ `security.test.js` (found + fixed 2026-04-30) |
| Rate limit per-IP only | Low | Partial | Partial — 429 contract only |
| SQLite write bottleneck | Medium | ❌ architectural limit | ⚠️ baseline only — `k6/booking-flow.js`; expiry spike not isolated |
| No slot soft-lock in UI | Low | ✅ clean 409 error | ✅ `booking-conflict.e2e` |
| Accessibility violations (missing landmarks, headings) | Medium | ✅ fixed: `<main>` + `<h1>` added | ✅ `accessibility.test.js` (found + fixed 2026-04-30) |
| Color contrast below WCAG AA | Low | ❌ known design debt (#64748b) | ⚠️ excluded from axe run, documented |
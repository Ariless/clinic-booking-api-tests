# Known Issues Register — clinic-booking-api

Living document. Every bug found during testing — fixed or open — recorded here with business impact, severity, and what was done. Companion: `SYSTEM_WEAKNESS_REPORT.md` (architectural failure mode analysis), `RISK_ANALYSIS.md` (impact × likelihood matrix).

**Statuses:** `Fixed` · `Open` · `Design debt` (acknowledged, not planned)

---

## Fixed bugs

### B-01 — IDOR on `GET /appointments/:id` (no auth, no ownership check)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-04-30 |
| **Found by** | `security.test.js` — expected `401` on unauthenticated request, got `200` |
| **Severity** | High |
| **Business impact** | Any unauthenticated user could read any appointment by ID. Any authenticated patient could read another patient's appointment — privacy breach, GDPR-level exposure. |
| **Root cause** | `GET /:id` route in `appointmentsRoutes.js` was missing `requireAuth` middleware. No ownership check existed. |
| **Fix** | Added `requireAuth` to `GET /:id`. Added ownership check: `appointment.patientId !== userId` → `403 FORBIDDEN`. |
| **Where** | `SYSTEM_WEAKNESS_REPORT.md` §3.2 · `security.test.js` · `PORTFOLIO_NARRATIVE.md` |

---

### B-02 — Accessibility violations: missing landmarks and heading on three pages

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-04-30 |
| **Found by** | `accessibility.test.js` (`@a11y`) — axe-core reported `landmark-one-main`, `page-has-heading-one`, `region` violations |
| **Severity** | Medium |
| **Business impact** | Screen reader users could not navigate login, register, or booking pages efficiently. EU Accessibility Act (2025) — legal compliance risk. |
| **Root cause** | `login.html`, `register-patient.html`, `patient-booking.html` had no `<main>` landmark. Booking page had `<h2>` sections but no page-level `<h1>`. |
| **Fix** | Added `<main>` landmark to all three pages. Added visually-hidden `<h1>Book an appointment</h1>` to booking page. Added `.visually-hidden` utility class to `app.css`. |
| **Residual** | `color-contrast` excluded — `.muted` is `#64748b` (3.9:1, below WCAG AA 4.5:1). Documented design debt — see B-06. |
| **Where** | `SYSTEM_WEAKNESS_REPORT.md` §3.4 · `accessibility.test.js` · `PORTFOLIO_NARRATIVE.md` |

**Recurrence — 2026-05-22:** Five pages added since the original fix (`patient-appointments.html`, `patient-consultations.html`, `patient-notifications.html`, `doctor-appointments.html`, `doctor-schedule.html`) were shipped without `<main>` landmarks. Additionally, `doctor-schedule.html` had 14 unlabelled `<input type="time">` elements (working hours table rows generated dynamically via JS template literal — `aria-label` never added). Found by extended `accessibility.test.ts` run. Fixed: `<main>` + visually-hidden `<h1>` added to all five pages; `aria-label="${name} start/end"` added to the time inputs in the JS template.

---

### B-03 — WebSocket never connected in browser (`window.ClinicCore` undefined)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-03 |
| **Found by** | `doctor-notifications.e2e.test.js` — `waitForConnection()` timed out; WS status never showed `connected` |
| **Severity** | High |
| **Business impact** | Doctors received no real-time notifications in the browser. Booking and cancellation events were silently dropped on the client side. API tests passed — the bug was invisible to any non-browser test. |
| **Root cause** | `doctor-appointments.html` called `window.ClinicCore.getToken()`. `ClinicCore` was never defined — `ClinicApp` was the correct global. Silent `TypeError` on page load; WebSocket initialisation never ran. |
| **Fix** | Changed `window.ClinicCore.getToken()` → `window.ClinicApp.getToken()` in `doctor-appointments.html`. |
| **Why API tests missed it** | The `notifications.ws.test.js` API test uses a Node.js `ws` client with the token passed directly — it bypasses the browser JavaScript entirely. Only the E2E test opened a real browser and exercised the client-side initialisation code. |
| **Where** | `project_ui_e2e_tests.md` (memory) · `doctor-notifications.e2e.test.js` · `PORTFOLIO_NARRATIVE.md` |

---

### B-04 — Doctor confirm banner hidden in <1ms (timing race in SUT)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-03 |
| **Found by** | `doctor-confirm.e2e.test.js` — intermittent failure; `bannerSuccess` not visible |
| **Severity** | Low |
| **Business impact** | Doctor clicks Confirm — no visual feedback. From the doctor's perspective the action may appear to have had no effect. |
| **Root cause** | `showBanner()` was called before `await loadAppointments()`. `loadAppointments()` called `hideBanners()` immediately on start, hiding the success banner before Playwright could observe it. |
| **Fix** | Moved `showBanner()` call to after `await loadAppointments()` in `doctor-appointments.html`. |
| **Where** | `project_ui_e2e_tests.md` (memory) · `doctor-confirm.e2e.test.js` |

---

## Open bugs

### B-05 — Retrieval layer maps "chest pain" → Orthopedist instead of Cardiologist

| Field | Value |
|---|---|
| **Status** | 🔴 Open |
| **Found by** | Pact provider verification 2026-05-08 — provider returned `recommendedSpecialty: "Orthopedist"` for interaction body `{ symptoms: "chest pain" }` |
| **Severity** | Medium |
| **Business impact** | Patient with classic cardiac symptoms is directed to the wrong specialist. Silent misrouting — the API returns `200` with a valid-looking specialty. No error signal. |
| **Root cause** | Keyword-overlap scoring in `retrieval.js`: "pain" matches Orthopedist keyword list; "chest" also triggers a match. Orthopedist total score > Cardiologist score for the input "chest pain". The LLM corrects this in real Claude mode (model has broader context), but in mock mode the raw retrieval result is returned directly — wrong specialty. |
| **Workaround** | Use `AI_MOCK_RESPONSE=false` with a real API key for the recommendation endpoint. In mock mode, the retrieval ranking is the final answer. |
| **Fix plan** | Improve retrieval scoring: add term specificity weighting (rare terms score higher than generic ones like "pain"); or add a symptom-to-specialty override table for high-confidence mappings. Regression test: `retrieve("chest pain")` → Cardiologist as top-1 in `unit/ai.retrieval.test.js`. |
| **Test gap** | No regression test for ambiguous symptoms. Tracked in `../BACKLOG.md`. |
| **Where** | `SYSTEM_WEAKNESS_REPORT.md` §5.1 · `../BACKLOG.md` (Regression: "chest pain" → Cardiologist) · `PORTFOLIO_NARRATIVE.md` |

---

### B-07 — Wrong operation order in reschedule causes 409 SLOT_TAKEN with active waitlist (✅ Fixed 2026-05-16)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-16 |
| **Found by** | `appointments.reschedule.test.ts` — test 8 (waitlist cascade); 7/8 passed, test 8 returned `409 SLOT_TAKEN` for a free slot |
| **Severity** | High |
| **Business impact** | All reschedule operations when an active waitlist existed returned incorrect `409 SLOT_TAKEN`. Patient could not change appointment time — error said "slot taken" for a slot that was free. The 7 non-waitlist tests passed silently; the bug was invisible without a waitlist scenario. |
| **Root cause** | `rescheduleAppointment` in `appointmentsRepository.js` freed the old slot and called `promoteFromWaitlist(oldSlotId)` **before** moving the appointment to the new slot. `promoteFromWaitlist` inserted a new appointment on `oldSlotId` while the rescheduled appointment still referenced `oldSlotId` — two active appointments on the same slot → UNIQUE constraint `idx_appointments_one_active_per_slot` fired → `409 SLOT_TAKEN`. |
| **Fix** | Reordered operations inside `db.transaction()`: (1) mark new slot unavailable, (2) move appointment to new slot, (3) mark old slot available, (4) call `promoteFromWaitlist`. Appointment leaves old slot before promotion can insert into it. |
| **Where** | `SYSTEM_WEAKNESS_REPORT.md` §1.4 · `appointments.reschedule.test.ts` test 8 · `sut/src/repositories/appointmentsRepository.js` |

---

### B-06 (resolved) — Valid 200 response returns `doctors: []` for unseeded specialties

| Field | Value |
|---|---|
| **Status** | ✅ Resolved 2026-06-22 |
| **Found by** | Pact provider verification 2026-05-08 — interaction expected `eachLike({...})` (at least one doctor); SUT returned `doctors: []` |
| **Severity** | Medium |
| **Business impact** | Patient receives a successful recommendation for Orthopedist or Pediatrician — but there are no doctors of that specialty in the system. No appointment can be made. Response looks successful; error is silent. |
| **Root cause** | `ALLOWED_SPECIALTIES` and the knowledge base include 6 specialties. Seed data (`seed.js`) only seeds 3 doctors: Cardiologist (John Doe), Dermatologist (Jane Smith), Neurologist (Jim Beam). Orthopedist and Pediatrician have zero doctors in DB. |
| **Fix applied** | Option B — `aiRoutes.js` now returns `404 DOCTORS_UNAVAILABLE` when `doctors: []` after a valid recommendation. Silent 200 replaced with an honest error contract. |
| **Regression test** | `"404 DOCTORS_UNAVAILABLE: specialty in knowledge base but no doctors in DB @api"` — uses "my baby needs vaccination" (Pediatrician score=2, others=0). Runs in mock mode without API key. |
| **Where** | `SYSTEM_WEAKNESS_REPORT.md` §5.2 · `PORTFOLIO_NARRATIVE.md` |

---

---

## Design debt (acknowledged, not planned)

### D-01 — Color contrast below WCAG AA (`#64748b`, ratio 3.9:1)

| Field | Value |
|---|---|
| **Status** | ⚠️ Acknowledged — no fix planned |
| **Where it appears** | `.muted` class used for secondary text across all pages |
| **Standard** | WCAG AA requires 4.5:1 for normal text |
| **Decision** | `color-contrast` rule excluded from axe-core runs. Requires a design decision to darken the palette — out of scope for this project. All structural and keyboard violations are fully tested. |

---

### D-02 — Doctor self-registration accepts any `doctorRecordId` (no validation)

| Field | Value |
|---|---|
| **Status** | ⚠️ Acknowledged — known gap, not in scope |
| **Risk** | Anyone can register as a doctor by providing any integer `doctorRecordId`. Gains access to doctor-scoped RBAC endpoints (confirm, reject, manage appointments). |
| **Severity** | High if this were production |
| **Decision** | Documented in SUT `DEFENSE_NOTES.md`. In production this requires an invitation token or admin-issued ID. This is a learning/portfolio project — the gap is explicitly documented, not hidden. |
| **Where** | `SYSTEM_WEAKNESS_REPORT.md` §3.1 |

---

### D-03 — Rate limiting is per-IP only (shared NAT / proxy scenario)

| Field | Value |
|---|---|
| **Status** | ⚠️ Acknowledged — partial mitigation |
| **Risk** | Behind a shared NAT or reverse proxy without `X-Forwarded-For`, all users share one rate limit bucket. One aggressive client exhausts the limit for everyone on that network. |
| **Mitigation** | `TRUST_PROXY=true` env var enables Express trust proxy; rate limiter then reads `X-Forwarded-For`. Set in `docker-compose.test.yml` and recommended for production deployments. |
| **Residual** | Per-user rate limiting (by token, not IP) would be stronger. Not planned. |
| **Where** | `SYSTEM_WEAKNESS_REPORT.md` §3.3 |

---

### DEAD-01 — `INVALID_PATTERN` errorCode unreachable via HTTP — dead code in repository layer (found 2026-05-17)

| Field | Value |
|---|---|
| **Status** | ⚠️ Design debt — dead code, not a production bug |
| **Found by** | `appointments.recurring.test.ts` — expected `INVALID_PATTERN`, received `VALIDATION_ERROR` |
| **Severity** | Low |
| **Root cause** | Validation is duplicated across two layers. `appointmentsRoutes.js` checks `slotPattern !== "weekly"` and returns `VALIDATION_ERROR` before calling the repository. `appointmentsRepository.js` has its own check that returns `INVALID_PATTERN` — but this code is never reached via HTTP because the route layer intercepts first. |
| **Fix** | Remove the duplicate check in the repository, or remove it from the route and let the repository own the validation. No functional change — just dead code elimination. |
| **Where** | `src/routes/appointmentsRoutes.js` (PATCH recurring) · `src/repositories/appointmentsRepository.js` |
| **Portfolio note** | Test on specific `errorCode` (not just HTTP status) exposed a validation layer inconsistency. "Test as specification" — the test revealed that the system has two conflicting specifications for the same check. |

---

## CI / environment issues

### CI-01 — Rate limit test gets 400 instead of 429 in CI (2026-05-11)

| Field | Value |
|---|---|
| **Status** | 🔴 Open — test skipped in CI pending fix |
| **Symptom** | `POST /auth/register @rate-limit` expects 429, receives 400 in CI |
| **Root cause** | `docker-compose.test.yml` sets `RATE_LIMIT_REGISTER_MAX=1000`. Test exhausts fewer requests than the limit, then sends invalid data expecting rate limit to fire — but SUT validates the request body first (400 VALIDATION_ERROR) before reaching the rate limiter. Locally the env var is set to 10000 so the test skips via its skip guard. |
| **Fix** | Add skip guard: if `RATE_LIMIT_REGISTER_MAX > 5` → skip test. Or set `RATE_LIMIT_REGISTER_MAX=3` in `docker-compose.test.yml` but only for this test step. |
| **Category** | CI environment configuration — not a product bug |
| **Portfolio note** | Classic "passes locally, fails in CI" — environment variable difference causes middleware ordering to change observable behaviour |

### CI-03 — Route pattern without trailing `**` stopped matching paginated URL (✅ Fixed 2026-05-16)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-16 |
| **Symptom** | `patient appointments — network drop on load, error banner shown @ui` expected error banner to be visible, received hidden — after adding `?page=1&limit=20` query params to the appointments URL |
| **Root cause** | `page.route("**/api/v1/appointments/my", ...)` glob pattern without trailing `**` matches the path exactly. Adding query params changed the URL from `/appointments/my` to `/appointments/my?page=1&limit=20` — route handler was registered but never triggered. Fetch hit the real API, got an empty list, no error banner appeared. |
| **Fix** | Changed pattern to `"**/api/v1/appointments/my**"` — trailing `**` matches any suffix including query strings. |
| **Category** | Test infrastructure — route pattern brittle to URL shape changes |
| **Portfolio note** | Silent test degradation: test ran, route registered, handler called 0 times. One character fix. Demonstrates that `page.route()` patterns must be verified when URL construction changes. |

---

### CI-02 — Flaky SLOT_OVERLAP in `appointments.waitlist.offers.test.js` (2026-05-11, ✅ Fixed 2026-05-20)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-20 |
| **Symptom** | `withSecondSlot` fails: `SLOT_OVERLAP` when creating a second slot with the same `seedSlotStart/seedSlotEnd` as a slot from a previous test run |
| **Root cause (actual)** | Two independent causes: (1) B-08 — `deleteOwnedSlotIfUnused` silently failed with 500 when `waitlist_offers` had a FK reference to the slot (SQLite FK enforcement ON, FK violated → exception in transaction → 500 response → silently ignored in teardown). (2) CI-08 — `withSecondSlot` didn't cancel active appointments before `deleteSlot` after offer accept, causing 409 SLOT_IN_USE silently ignored. Both resulted in stale slots that caused SLOT_OVERLAP on the next run. |
| **Fix** | Fixed B-08 (deleted waitlist_offers first in transaction) + fixed CI-08 (added appointment cancellation in withSecondSlot finally block) |
| **Category** | Test isolation — silent teardown failure cascades across runs |
| **Portfolio note** | The SLOT_OVERLAP appeared to be a time-collision issue but was actually a teardown failure propagation: FK violation → 500 swallowed → slot persists → next run collides. The real bug was invisible without status checking in teardown. |

---

### CI-04 — Private SUT repo caused misleading "file not found" in CI (✅ Fixed 2026-05-18)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-18 |
| **Symptom** | All CI jobs fail: `open .../sut/docker-compose.test.yml: no such file or directory` — looks like a missing file, not an auth error |
| **Root cause** | SUT repo (`clinic-booking-api`) was made private. The `actions/checkout@v4` step had no `token:` configured — default `GITHUB_TOKEN` has no cross-repo access for private repos. Checkout step failed silently (no `sut/` directory created). All subsequent steps that reference `sut/docker-compose.test.yml` fail with "file not found" — the real error (401 Unauthorized on repo checkout) was not surfaced. |
| **Fix** | Created PAT with `repo` scope → added as `SUT_GITHUB_TOKEN` secret in tests repo → added `token: ${{ secrets.SUT_GITHUB_TOKEN }}` to all SUT checkout steps across 7 workflows. |
| **Category** | CI infrastructure — auth misconfiguration with misleading error message |
| **Portfolio note** | The error pointed at the wrong layer: "file not found" suggests a missing file in the repo, but the real cause was one step earlier — repo auth failure. Demonstrates that CI failure messages describe symptoms, not causes. Required reading backwards from symptom through the step sequence to find where the chain actually broke. |

---

### CI-05 — `SQLITE_READONLY` in global teardown when running in Docker CI (✅ Fixed 2026-05-18)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-18 |
| **Symptom** | 8 tests pass, then `SqliteError: attempt to write a readonly database` at `global-teardown.ts:21` → CI exits with code 1 despite all tests green |
| **Root cause** | The SUT runs inside a Docker container as root. The SQLite DB file (`sut/data/clinic.db`) is owned by root on the host via the volume mount `./data:/app/data`. The GitHub Actions runner user does not have write permission to the file. `global-teardown.ts` opens the DB for read-write and tries to `DELETE` test users — OS rejects the write. |
| **Fix** | Catch `SQLITE_READONLY` error code in `global-teardown.ts` and skip cleanup with a log message. The DB is ephemeral in CI (fresh container each run) — teardown cleanup is only needed for local persistent DBs. |
| **Category** | CI environment — Docker volume ownership difference between container (root) and host runner |
| **Portfolio note** | All 8 tests passed. The exit code 1 came from teardown, not from a test. Without knowing where Playwright reports teardown errors separately from test results, this looks like a test failure — it isn't. Environment-aware teardown: if the DB is readonly, the cleanup environment is ephemeral, so skipping is correct behaviour, not an error to propagate. |

---

### CI-06 — Doctor schedule pollution causes ordering-dependent fixture failures (✅ Fixed 2026-05-20)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-20 |
| **Symptom** | `security.test.ts` and other slot-dependent tests fail with `OUTSIDE_WORKING_HOURS 422` from the slot fixture — not from the test assertions themselves. Isolated runs pass (7/7); full `@api` suite fails (6 failures). |
| **Root cause** | `doctors.schedule.test.ts` calls `PUT /me/schedule` to set working hours for `doctor0` and does **not** clean up after itself. `slotFixture` creates slots at `now+24h + seq×2h` — a deterministic time that may fall outside the configured 09:00–17:00 window depending on when the suite runs. Tests that use `{ slot }` fixture and run after the schedule tests fail at fixture setup, not at assertion level. |
| **Effect** | The error message (`slot fixture failed: OUTSIDE_WORKING_HOURS`) points at the fixture, not the real source. An engineer debugging this finds the failing test (e.g. `security.test.ts: 401 no auth token`) but the test logic is correct — the problem is one test polluting DB state for another. |
| **Fix options** | (a) `doctors.schedule.test.ts` teardown: call `DELETE /me/schedule` (if endpoint exists) or DELETE from DB after each test. (b) `slotFixture` teardown: reset doctor schedule. (c) Add an explicit `DELETE FROM doctor_schedules WHERE doctorRecordId = 1` in `global-teardown.ts`. |
| **Fix applied** | `doctors.schedule.test.ts`: added `await doctors.deleteSlot(body.id, doctorAuth)` after `expect(status).toBe(201)` in all 4 tests that create slots. Also added `await doctors.setSchedule([], doctorAuth)` in `beforeEach` to reset the schedule. |
| **Category** | Test isolation — persistent DB state leaked between test files |
| **Portfolio note** | Classic cross-test contamination: the failing test (security) is unrelated to the bug (schedule). The test that set the state (schedule) passed fine. Only observable when running together in one Playwright worker, in a specific order. Demonstrates why teardown parity with setup is essential, and why isolated test runs can mask ordering bugs. |

---

---

### B-14 — Procedure can be booked into a slot shorter than its required duration (Open)

| Field | Value |
|---|---|
| **Status** | 🔴 Open |
| **Found by** | `appointments.type.test.ts` — `test.fail()` B-14: expects `422 SLOT_TOO_SHORT` for procedure into 15min slot, receives `201` |
| **Severity** | Medium |
| **Business impact** | A 60-minute procedure booked into a 15-minute slot creates an appointment that overruns its slot window. If another slot starts immediately after, the procedure physically overlaps — but the system creates the appointment without warning. Patient and doctor see conflicting schedules. |
| **Root cause** | `POST /appointments` validates `type` is a known value but does not compare slot duration against the type's minimum duration. `SLOT_TOO_SHORT` error code is defined but check is not implemented. |
| **Fix** | In `appointmentsRoutes.js`, after fetching the slot: compute `slotDurationMs = new Date(slot.endTime) - new Date(slot.startTime)`; compare against `TYPE_DURATIONS[type]`; return `422 SLOT_TOO_SHORT` if insufficient. |
| **Where** | `tests/api/appointments.type.test.ts` (test.fail line) · `sut/src/routes/appointmentsRoutes.js` (B-14 comment) |

---

### B-08 — `deleteOwnedSlotIfUnused`: FK violation on slot deletion when `waitlist_offers` exist (✅ Fixed 2026-05-20)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-20 |
| **Found by** | Teardown debugging — `SLOT_OVERLAP` on consecutive test runs; DB inspection showed stale slots surviving teardown |
| **Severity** | Medium |
| **Business impact** | Silent data leak: slots that should be cleaned up after tests persisted in the DB. Next test run hit `SLOT_OVERLAP` on the same time windows → fixture setup failed → cascading test failures. In production this would mean "deleted" slots remaining in the calendar. |
| **Root cause** | SQLite FK enforcement (`PRAGMA foreign_keys = 1`) was ON. `deleteOwnedSlotIfUnused` transaction deleted `appointments` then `slots` — but `waitlist_offers.slotId` also referenced `slots.id`. `DELETE FROM slots WHERE id = ?` raised `SQLITE_CONSTRAINT_FOREIGNKEY` inside the transaction → exception propagated → route handler returned `500` → teardown code silently ignored the non-204 response. Slot was never deleted. |
| **Fix** | Added `db.prepare("DELETE FROM waitlist_offers WHERE slotId = ?").run(slotId)` as the first step of the transaction in `slotsRepository.js::deleteOwnedSlotIfUnused`. |
| **Where** | `sut/src/repositories/slotsRepository.js` · `SYSTEM_WEAKNESS_REPORT.md` (new §2.4) |
| **Portfolio note** | FK constraints enforce referential integrity — but they can also silently invalidate code that was written when FK enforcement was off. The teardown never threw because the HTTP call discarded its return value. Added `deleteStatus !== 204` check to `slotFixture.ts` to surface future teardown failures immediately. |

---

### B-09 — `softDeleteUser` missing `slot_waitlist` cleanup → promotion cascade during fixture teardown (✅ Fixed 2026-05-20)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-20 |
| **Found by** | Teardown debugging — `slotFixture` `deleteSlot` failed with `409 SLOT_IN_USE` after `twoUsersFixture` user2 was soft-deleted |
| **Severity** | Medium |
| **Business impact** | Soft-deleted users remained in `slot_waitlist`. When any slot in their doctor's calendar was freed (e.g. during test teardown), `promoteFromWaitlist` created a new pending appointment for the deleted user — blocking slot deletion. In production: a deleted user's waitlist entry could cause their ghost appointment to appear on a doctor's calendar. |
| **Root cause** | `softDeleteUser` in `usersRepository.js` set `deletedAt` on the user but did not clean `slot_waitlist`. Fixture teardown called `cancelAsDoctor` (which freed the slot and triggered `promoteFromWaitlist`) → `promoteFromWaitlist` found the deleted user's waitlist entry and checked for existing active appointments — found none (user was just deleted, their appointment was cancelled) → took the direct promotion path → inserted new pending appointment → `deleteSlot` got `409 SLOT_IN_USE`. |
| **Fix** | Added `db.prepare("DELETE FROM slot_waitlist WHERE patientId = ?").run(uid)` inside the `softDeleteUser` transaction, before the `UPDATE users SET deletedAt` statement. |
| **Where** | `sut/src/repositories/usersRepository.js` · `SYSTEM_WEAKNESS_REPORT.md` (new §2.4) |
| **Portfolio note** | Classic cascade: the bug only manifested in teardown, not in production flows, because `softDeleteUser` is only called via `DELETE /users/me` which normally happens when the user exists and has no conflicting state. The teardown order (user2 soft-deleted before slot cleanup) created the unique combination. |

---

### CI-07 — `slotFixture` teardown: `cancelAsDoctor` triggers `promoteFromWaitlist` loop — slot re-booked before `deleteSlot` (✅ Fixed 2026-05-20)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-20 |
| **Found by** | Added `deleteStatus !== 204` check to `slotFixture` → error surfaced: `409 SLOT_IN_USE` after teardown for waitlist offer tests (decline and get-offers) |
| **Severity** | Low (test infrastructure only) |
| **Root cause** | `slotFixture` teardown cancelled all active appointments on the slot, then called `deleteSlot`. Cancelling an appointment triggers `promoteFromWaitlist`, which re-booked the slot with a waitlist patient who had not yet been removed (e.g. patient declined an offer and stayed on waitlist). The slot had a fresh pending appointment by the time `deleteSlot` ran → `409 SLOT_IN_USE`. Single-pass cancellation was not sufficient. |
| **Fix** | Replaced single-pass cancellation with a retry loop (up to 5 passes): re-list doctor appointments after each cancel pass and repeat until no active appointments remain on the slot. Each pass exhausts one waitlist entry. |
| **Where** | `tests/fixtures/slotFixture.ts` |
| **Portfolio note** | `cancelAsDoctor` has a side effect (`promoteFromWaitlist`) that the teardown code didn't account for. The fixture treated cancellation as terminal — but the domain says freeing a slot is an event, not a final state. Fixing teardown to be side-effect-aware rather than just one-shot is an example of infrastructure matching domain semantics. |

---

### CI-08 — `withSecondSlot` helper: no appointment cancellation before `deleteSlot` after offer accept (✅ Fixed 2026-05-20)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-20 |
| **Found by** | DB inspection after test run — stale slots 18, 21 with `accepted` waitlist_offers remained in DB |
| **Severity** | Low (test infrastructure only) |
| **Root cause** | `withSecondSlot` in `appointments.waitlist.offers.test.ts` created a second slot and deleted it in `finally`. After the "accept offer" test, patient1 had a new pending appointment on slot2. `withSecondSlot.finally` called `deleteSlot(slot2)` without cancelling this appointment first → `409 SLOT_IN_USE` → swallowed (no status check) → slot2 leaked. The `slot` fixture only cleaned up appointments on slot1 (fixture slot), not slot2. |
| **Fix** | Added appointment cancellation loop to `withSecondSlot.finally`: instantiate `AppointmentsClient(request)`, list doctor appointments, cancel any active ones on slot2, then `deleteSlot`. Added `request: APIRequestContext` parameter to `withSecondSlot`. |
| **Where** | `tests/tests/api/appointments.waitlist.offers.test.ts` |
| **Portfolio note** | The accept-offer flow creates a new appointment as a side effect. The helper's `finally` block only called `deleteSlot` — it assumed slot2 was always empty after the test. Test helpers need to clean state with the same thoroughness as fixtures, not assume the slot is free. |

---

## Summary table

| ID | Title | Status | Severity | Found by |
|---|---|---|---|---|
| B-01 | IDOR on `GET /appointments/:id` | ✅ Fixed 2026-04-30 | High | `security.test.js` |
| B-02 | Missing landmarks + heading (a11y) | ✅ Fixed 2026-04-30 | Medium | `accessibility.test.js` (axe-core) |
| B-03 | WS never connected (`ClinicCore` undefined) | ✅ Fixed 2026-05-03 | High | `doctor-notifications.e2e.test.js` |
| B-04 | Confirm banner hidden in <1ms | ✅ Fixed 2026-05-03 | Low | `doctor-confirm.e2e.test.js` |
| B-05 | "chest pain" → Orthopedist (wrong retrieval ranking) | 🔴 Open | Medium | Pact provider verification |
| B-06 | `doctors: []` on valid 200 (unseeded specialties) | 🔴 Open | Medium | Pact provider verification |
| B-07 | Wrong operation order in reschedule → 409 with active waitlist | ✅ Fixed 2026-05-16 | High | `appointments.reschedule.test.ts` |
| CI-01 | Rate limit test: 400 instead of 429 in CI | 🔴 Open | Low | CI run 2026-05-11 |
| CI-02 | Flaky SLOT_OVERLAP in waitlist offers test | 🔴 Open | Low | CI run 2026-05-11 |
| CI-03 | Route pattern broke on paginated URL (missing `**`) | ✅ Fixed 2026-05-16 | Low | `api-error-states.test.ts` |
| CI-04 | Private SUT repo → misleading "file not found" in CI | ✅ Fixed 2026-05-18 | Medium | CI run 2026-05-18 |
| CI-05 | `SQLITE_READONLY` in teardown — Docker owns the DB file | ✅ Fixed 2026-05-18 | Low | CI run 2026-05-18 |
| D-01 | Color contrast below WCAG AA | ⚠️ Design debt | Low | `accessibility.test.js` |
| D-02 | Doctor self-registration — no `doctorRecordId` validation | ⚠️ Design debt | High (prod) | Manual review |
| D-03 | Rate limiting per-IP only | ⚠️ Design debt | Low | Manual review |
| CI-06 | Doctor schedule pollution → ordering-dependent fixture failures | ✅ Fixed 2026-05-20 | Low | Full `@api` run 2026-05-18 |
| DEAD-01 | `INVALID_PATTERN` errorCode unreachable — dead code in repository layer | ⚠️ Design debt | Low | `appointments.recurring.test.ts` 2026-05-17 |
| B-14 | Procedure bookable into slot shorter than 60min — no SLOT_TOO_SHORT check | 🔴 Open | Medium | `appointments.type.test.ts` 2026-05-19 |
| B-08 | `deleteOwnedSlotIfUnused` FK violation: `waitlist_offers` not deleted before slot | ✅ Fixed 2026-05-20 | Medium | Teardown debugging 2026-05-20 |
| B-09 | `softDeleteUser` missing `slot_waitlist` cleanup → ghost promotion in teardown | ✅ Fixed 2026-05-20 | Medium | Teardown debugging 2026-05-20 |
| CI-07 | `slotFixture` teardown: `cancelAsDoctor` triggers `promoteFromWaitlist` loop | ✅ Fixed 2026-05-20 | Low | Teardown error surfacing 2026-05-20 |
| CI-08 | `withSecondSlot`: no appointment cancel before `deleteSlot` after offer accept | ✅ Fixed 2026-05-20 | Low | DB inspection 2026-05-20 |

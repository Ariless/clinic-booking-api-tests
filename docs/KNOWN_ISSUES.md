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

### B-06 (open) — Valid 200 response returns `doctors: []` for unseeded specialties

| Field | Value |
|---|---|
| **Status** | 🔴 Open |
| **Found by** | Pact provider verification 2026-05-08 — interaction expected `eachLike({...})` (at least one doctor); SUT returned `doctors: []` |
| **Severity** | Medium |
| **Business impact** | Patient receives a successful recommendation for Orthopedist or Pediatrician — but there are no doctors of that specialty in the system. No appointment can be made. Response looks successful; error is silent. |
| **Root cause** | `ALLOWED_SPECIALTIES` and the knowledge base include 6 specialties. Seed data (`seed.js`) only seeds 3 doctors: Cardiologist (John Doe), Dermatologist (Jane Smith), Neurologist (Jim Beam). Orthopedist and Pediatrician have zero doctors in DB. |
| **Workaround** | Avoid recommending Orthopedist/Pediatrician by ensuring retrieval returns one of the 3 seeded specialties. In practice: use unambiguous symptoms that map cleanly to Cardiologist/Dermatologist/Neurologist. |
| **Fix plan** | Option A — seed all 6 specialties. Option B — return `404 DOCTORS_UNAVAILABLE` when `doctors: []` after a valid recommendation, instead of silent 200. Option B is the more honest API contract. |
| **Test gap** | No test that asserts `doctors.length > 0` after any recommendation. Tracked in `../BACKLOG.md`. |
| **Where** | `SYSTEM_WEAKNESS_REPORT.md` §5.2 · `../BACKLOG.md` (Regression: doctors.length > 0) · `PORTFOLIO_NARRATIVE.md` |

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

### CI-02 — Flaky SLOT_OVERLAP in `appointments.waitlist.offers.test.js` (2026-05-11)

| Field | Value |
|---|---|
| **Status** | 🔴 Open — intermittent |
| **Symptom** | `withSecondSlot` fails: `SLOT_OVERLAP` when creating a second slot with the same `seedSlotStart/seedSlotEnd` as a slot already created by another test |
| **Root cause** | Test isolation gap — `withSecondSlot` uses the same fixed seed slot times as other tests. When tests run in certain order, the slot from a previous test isn't cleaned up before this one creates a conflicting slot. |
| **Fix** | Use unique timestamps in `withSecondSlot` (e.g. offset by a fixed delta from seed times) |
| **Category** | Test isolation — shared fixture data conflict |
| **Portfolio note** | Demonstrates why shared fixture times cause ordering-dependent flakiness even with DB resets between test files |

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
| D-01 | Color contrast below WCAG AA | ⚠️ Design debt | Low | `accessibility.test.js` |
| D-02 | Doctor self-registration — no `doctorRecordId` validation | ⚠️ Design debt | High (prod) | Manual review |
| D-03 | Rate limiting per-IP only | ⚠️ Design debt | Low | Manual review |
| DEAD-01 | `INVALID_PATTERN` errorCode unreachable — dead code in repository layer | ⚠️ Design debt | Low | `appointments.recurring.test.ts` 2026-05-17 |

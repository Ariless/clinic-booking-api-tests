# Known Issues Register — clinic-booking-api

Living document. Every bug found during testing — fixed or open — recorded here with business impact, severity, and what was done. Companion: `SYSTEM_WEAKNESS_REPORT.md` (architectural failure mode analysis), `RISK_ANALYSIS.md` (impact × likelihood matrix).

**Statuses:** `Fixed` · `Open` · `Design debt` (acknowledged, not planned)

> File names in older entries were rewritten from `.test.js` to `.test.ts` on 2026-08-21, after the
> TypeScript migration left every reference here pointing at a path that no longer exists. The one
> exception is `appointmentStateMachine.test.js`, which is a Jest unit test in the SUT repository and
> genuinely still `.js`.

---

## Fixed bugs

### B-15 — `GET /doctors/:id/slots` returned `isAvailable` as `0`/`1`, not a boolean (✅ Fixed 2026-08-22)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-22 — found and fixed the same day |
| **Found by** | `mobile.pact.provider.test.ts`, first run of the clinic-mobile provider verification — `$[*].isAvailable -> Expected 1 (Integer) to be the same type as true (Boolean)`, on every slot in the response |
| **Severity** | Medium |
| **Business impact** | The mobile app declares `isAvailable: boolean` (`BookingScreen.tsx`) and filters with `slots.filter(s => s.isAvailable)`. `1` is truthy, so the screen rendered correctly and the mismatch stayed invisible. It would have stopped being invisible at the first stricter check — `s.isAvailable === true`, a runtime schema validator, or a typed client generated from the spec — and the failure would have surfaced as "this doctor has no free slots", a data problem in appearance and a serialisation problem in fact. The web UI already carried the workaround: `doctor-schedule.html` wrapped the value in `Boolean(s.isAvailable)`. |
| **Root cause** | SQLite has no boolean type — `slots.isAvailable` is `INTEGER NOT NULL` (`migrate.js`). `getAvailableByDoctorId`, `getSlotsByDoctorId` and `insertSlot` selected the column and the routes serialised the rows unchanged, so the storage type leaked into the JSON contract. The OpenAPI spec had recorded the leak rather than the intent: `Slot.isAvailable` was `integer` with the description "SQLite stores 0/1", while `CreateSlotRequest.isAvailable` on the way in was already `boolean`. |
| **Fix** | `toApiSlot(row)` in `slotsRepository.js` maps the flag on the three read paths that reach the API. Writes, the booking guards and `invariants.js` run their own queries against the integer column and are untouched. `Slot.isAvailable` in `openapi/openapi.yaml` is now `boolean`, matching the request schema. |
| **Verification** | `mobile.pact.provider.test.ts` — the interaction that found it now passes; `test.fail()` was never needed. Full run after the fix: `test:api` 183 passed / 37 skipped, `test:browser` 143 passed / 2 skipped, SUT Jest 100 passed. |
| **Where** | `sut/src/repositories/slotsRepository.js` · `sut/openapi/openapi.yaml` · `tests/api/pact/mobile.pact.provider.test.ts` · `SYSTEM_WEAKNESS_REPORT.md` §2.4 |

---

### B-01 — IDOR on `GET /appointments/:id` (no auth, no ownership check)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-04-30 |
| **Found by** | `security.test.ts` — expected `401` on unauthenticated request, got `200` |
| **Severity** | High |
| **Business impact** | Any unauthenticated user could read any appointment by ID. Any authenticated patient could read another patient's appointment — privacy breach, GDPR-level exposure. |
| **Root cause** | `GET /:id` route in `appointmentsRoutes.js` was missing `requireAuth` middleware. No ownership check existed. |
| **Fix** | Added `requireAuth` to `GET /:id`. Added ownership check: `appointment.patientId !== userId` → `403 FORBIDDEN`. |
| **Where** | `SYSTEM_WEAKNESS_REPORT.md` §3.2 · `security.test.ts` · `PORTFOLIO_NARRATIVE.md` |

---

### B-02 — Accessibility violations: missing landmarks and heading on three pages

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-04-30 |
| **Found by** | `accessibility.test.ts` (`@a11y`) — axe-core reported `landmark-one-main`, `page-has-heading-one`, `region` violations |
| **Severity** | Medium |
| **Business impact** | Screen reader users could not navigate login, register, or booking pages efficiently. EU Accessibility Act (2025) — legal compliance risk. |
| **Root cause** | `login.html`, `register-patient.html`, `patient-booking.html` had no `<main>` landmark. Booking page had `<h2>` sections but no page-level `<h1>`. |
| **Fix** | Added `<main>` landmark to all three pages. Added visually-hidden `<h1>Book an appointment</h1>` to booking page. Added `.visually-hidden` utility class to `app.css`. |
| **Residual** | `color-contrast` excluded — `.muted` is `#64748b` (3.9:1, below WCAG AA 4.5:1). Documented design debt — see B-06. |
| **Where** | `SYSTEM_WEAKNESS_REPORT.md` §3.4 · `accessibility.test.ts` · `PORTFOLIO_NARRATIVE.md` |

**Recurrence — 2026-05-22:** Five pages added since the original fix (`patient-appointments.html`, `patient-consultations.html`, `patient-notifications.html`, `doctor-appointments.html`, `doctor-schedule.html`) were shipped without `<main>` landmarks. Additionally, `doctor-schedule.html` had 14 unlabelled `<input type="time">` elements (working hours table rows generated dynamically via JS template literal — `aria-label` never added). Found by extended `accessibility.test.ts` run. Fixed: `<main>` + visually-hidden `<h1>` added to all five pages; `aria-label="${name} start/end"` added to the time inputs in the JS template.

---

### B-03 — WebSocket never connected in browser (`window.ClinicCore` undefined)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-03 |
| **Found by** | `doctor-notifications.e2e.test.ts` — `waitForConnection()` timed out; WS status never showed `connected` |
| **Severity** | High |
| **Business impact** | Doctors received no real-time notifications in the browser. Booking and cancellation events were silently dropped on the client side. API tests passed — the bug was invisible to any non-browser test. |
| **Root cause** | `doctor-appointments.html` called `window.ClinicCore.getToken()`. `ClinicCore` was never defined — `ClinicApp` was the correct global. Silent `TypeError` on page load; WebSocket initialisation never ran. |
| **Fix** | Changed `window.ClinicCore.getToken()` → `window.ClinicApp.getToken()` in `doctor-appointments.html`. |
| **Why API tests missed it** | The `notifications.ws.test.ts` API test uses a Node.js `ws` client with the token passed directly — it bypasses the browser JavaScript entirely. Only the E2E test opened a real browser and exercised the client-side initialisation code. |
| **Where** | `doctor-notifications.e2e.test.ts` · `PORTFOLIO_NARRATIVE.md` |

---

### B-04 — Doctor confirm banner hidden in <1ms (timing race in SUT)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-03 |
| **Found by** | `doctor-confirm.e2e.test.ts` — intermittent failure; `bannerSuccess` not visible |
| **Severity** | Low |
| **Business impact** | Doctor clicks Confirm — no visual feedback. From the doctor's perspective the action may appear to have had no effect. |
| **Root cause** | `showBanner()` was called before `await loadAppointments()`. `loadAppointments()` called `hideBanners()` immediately on start, hiding the success banner before Playwright could observe it. |
| **Fix** | Moved `showBanner()` call to after `await loadAppointments()` in `doctor-appointments.html`. |
| **Where** | `doctor-confirm.e2e.test.ts` |

---

## Open bugs

> As of 2026-08-22 nothing in this section is open: B-05 and B-07 are fixed, B-06 is resolved and
> now covered by a test. The section keeps its name and its cards for history. The bugs that are
> still open live further down: **B-14** (procedure booked into a slot shorter than it needs) and
> **B-15** (`isAvailable` returned as `0`/`1` instead of a boolean).

### B-05 — Retrieval layer maps "chest pain" → Orthopedist instead of Cardiologist (✅ Fixed 2026-08-21)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-21 |
| **Found by** | Pact provider verification 2026-05-08 — provider returned `recommendedSpecialty: "Orthopedist"` for interaction body `{ symptoms: "chest pain" }` |
| **Severity** | Medium |
| **Business impact** | Patient with classic cardiac symptoms is directed to the wrong specialist. Silent misrouting — the API returns `200` with a valid-looking specialty. No error signal. |
| **Root cause** | Keyword-overlap scoring in `retrieval.js`: "pain" matches Orthopedist keyword list; "chest" also triggers a match. Orthopedist total score > Cardiologist score for the input "chest pain". The LLM corrects this in real Claude mode (model has broader context), but in mock mode the raw retrieval result is returned directly — wrong specialty. |
| **Workaround** | Use `AI_MOCK_RESPONSE=false` with a real API key for the recommendation endpoint. In mock mode, the retrieval ranking is the final answer. |
| **Fix** | `fcccd6d` in the SUT — `retrieval.js` now matches multi-word keywords word by word instead of by substring, so "chest pain" scores Cardiologist above Orthopedist. |
| **Regression test** | `unit/ai.retrieval.test.ts` — "retrieve: bare 'chest pain' ranks Cardiologist first — B-05 regression @unit". The earlier `test.fail()` marker alerted on the fix and was removed. |
| **Register note** | This card said 🔴 Open with "no regression test" until 2026-08-22, four months after `../BACKLOG.md` recorded the fix. Two documents, one fact, no link between them — the register is the one people read. |
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
| **Regression test** | `"404 DOCTORS_UNAVAILABLE: specialty is recommendable but nobody is on staff @api"` in `api/ai.recommend.test.ts`, added 2026-08-22. |
| **Register note** | This row previously named a test that did not exist anywhere in the suite — `DOCTORS_UNAVAILABLE` appeared only in `sut/src/routes/aiRoutes.js`. The gap widened on 2026-08-21, when the seed started staffing all six specialties so that ordinary AI tests resolve to a real doctor: from then on the branch was unreachable from a seeded database, not merely untested. The test now creates the state instead of relying on the seed — `fixtures/unstaffedSpecialtyFixture.ts` parks the paediatric doctor's specialty for the duration of the test and restores it afterwards. |
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

### D-04 — Retrieval does not normalise words: a paraphrase retrieves nothing (measured 2026-08-26)

| Field | Value |
|---|---|
| **Status** | ⚠️ Design debt — measured, accepted, not planned |
| **Found by** | `tests/unit/ai.retrieval.metrics.test.ts` against `data/retrievalGoldenSet.ts`. RAG-08 ("itchy" not matching the keyword "itching") was the single known instance; the golden set turned one anecdote into a number. |
| **Severity** | Medium — the patient gets `422 UNKNOWN_SPECIALTY`, not a wrong doctor |
| **Measured** | 34 clinically-decided cases: overall accuracy@1 61.8%, recall@3 64.7%, MRR 0.632, coverage 67.6%. Split by phrasing: `direct` recall@3 100%, `morphology` 60%, `synonym` 0%, `colloquial` 14.3%. |
| **Root cause** | `retrieve()` matches on `word === keyword \|\| word.includes(keyword)`. Substring containment covers suffixes ("coughing" → "cough", "joints" → "joint") and nothing else: a prefix change ("itchy" vs "itching", "tingle" vs "tingling") fails, and a word that shares no stem with any keyword ("ribcage", "blotches", "forgetting") cannot match at all. There is no stemming and no synonym layer. |
| **Why it is accepted** | The knowledge base has six entries and `topK` is 3 — half the corpus is returned on every hit, so a denser retriever has little room to win. The gap to a competent lexical retriever (BM25: stemming plus IDF weighting) is larger than the gap from BM25 to embeddings on a corpus this size, and Anthropic has no embeddings API, so a vector path would add a second provider (Voyage AI) or model weights in the repository. Measured first, decided second. |
| **Countervailing strength** | False-positive rate is 0/3: nothing is retrieved for "what are your opening hours". The retriever stays silent rather than guessing, which is the safer failure for a medical route. |
| **Where** | `sut/src/services/retrieval.js` · `sut/ai-service/retrieval.js` (two copies, kept in step by `aiServiceParity.test.js`) |
| **Portfolio note** | The interesting artefact is not the retriever, it is the measurement: a golden set decided clinically, metrics that mirror what production serves (accuracy@1 = mock mode's `retrieved[0]`, recall@3 = what the model receives), and a breakdown by phrasing that names *where* the algorithm stops working instead of reporting one number. |

---

### D-05 — Ranking counts matches instead of weighting them: a child complaint routes to GP (found 2026-08-26)

| Field | Value |
|---|---|
| **Status** | ⚠️ Design debt — reproducible, guarded by a test |
| **Found by** | `tests/unit/ai.retrieval.metrics.test.ts` — the only golden-set case that lands in the top 3 without ranking first |
| **Severity** | Medium in mock mode, low with a live model |
| **Reproduce** | `retrieve("my child has high fever and cough")` → `["General Practitioner", "Pediatrician"]` |
| **Root cause** | The score is a count of matched keywords, and every keyword carries the same weight. "fever" and "cough" are two generic General Practitioner keywords; "child" is one specific Pediatrician keyword. Two beats one, so the generic specialty wins. IDF exists to prevent exactly this and the retriever has none. |
| **Impact** | `AI_MOCK_RESPONSE=true` answers from `retrieved[0]`, so the configuration CI runs recommends a General Practitioner for a child with a fever. With a real model the ranking matters less: both specialties reach the prompt as context and the model picks — `LLM eval` measures that end of it. |
| **Fix** | Weight keywords by inverse document frequency, or rank by best single-keyword specificity rather than match count. Not planned — see D-04 on why the retriever stays lexical. |
| **Where** | `sut/src/services/retrieval.js:19` (scoring loop) |

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

### CI-01 — Rate limit test gets 400 instead of 429 in CI (2026-05-11, ✅ Fixed 2026-05-11)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-05-11 |
| **Symptom** | `POST /auth/register @rate-limit` expects 429, receives 400 in CI |
| **Root cause** | `docker-compose.test.yml` sets `RATE_LIMIT_REGISTER_MAX=1000`. Test exhausts fewer requests than the limit, then sends invalid data expecting rate limit to fire — but SUT validates the request body first (400 VALIDATION_ERROR) before reaching the rate limiter. Locally the env var is set to 10000 so the test skips via its skip guard. |
| **Fix** | Both halves shipped the same day and the entry was never updated (corrected 2026-08-21). `auth.register.test.ts:96` carries the skip guard — `test.skip(REGISTER_MAX > 5, …)` — and `api-tests.yml` sets `RATE_LIMIT_REGISTER_MAX: "1000"` at workflow level (588d7a0), so the test process sees the same value as the SUT and skips with an explanation instead of asserting against a validation error. |
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

### CI-02 — Flaky SLOT_OVERLAP in `appointments.waitlist.offers.test.ts` (2026-05-11, ✅ Fixed 2026-05-20)

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

### CI-07 — `.gitignore` hid the test-data source directory; a `@rag` baseline was never committed (✅ Fixed 2026-08-26)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-26 |
| **Symptom** | `git add data/retrievalGoldenSet.ts` refused: "The following paths are ignored by one of your .gitignore files". |
| **Root cause** | `.gitignore:13` read `data/` — a whole-directory rule sitting in the block of run artefacts (`test-results/`, `allure-results/`, `coverage/`). But `data/` is the **source** directory for test data (`testData.ts`, `seedAccounts.ts`, `schemas/`); the only artefact in it is an empty `clinic.db`, which is what the rule was written for. |
| **Not the first time** | Commit `18f41284 fix: add data layer TS files excluded by gitignore` is the same trap firing earlier. It was resolved by force-adding the affected files; the rule that caused it was left in place, so the next file added to `data/` hit it again. |
| **The unnoticed casualty** | `data/specialty-distribution-baseline.json` had never been committed. `tests/api/ai.recommend.test.ts:493` loads it with `require`, so on a fresh clone that line throws `MODULE_NOT_FOUND`. The test is `@rag`-gated and skips without an API key — but `model-drift.yml` runs `@rag` **with** a real key on a schedule, which is precisely the path that reaches the `require`. Same class as TST-06: listed as coverage, unable to run where it counts. Whether the scheduled job actually failed is unverified — per BACKLOG it had been sitting on an exhausted balance. |
| **Fix** | `data/` → `data/clinic.db`. `data/.DS_Store` stays covered by the repo-wide `.DS_Store` rule on line 11. Verified per file with `git check-ignore -v`: only `clinic.db` and `.DS_Store` remain ignored, and the two missing sources became visible to `git status`. |
| **Category** | Repository hygiene — an ignore rule aimed at artefacts that covered sources |
| **Portfolio note** | The failure mode is silence: a new file under `data/` is simply absent from the repository, every local run stays green, and the gap only surfaces on a fresh clone or in a scheduled job nobody watches. It had already been patched once at the symptom (`git add -f`) without touching the cause, which is why it recurred. Worth pairing with TST-06 as the same lesson from a different direction — a test can be listed, tagged, and counted while having no way to execute. |

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

## Suite defects — the tests themselves

Bugs in this repository, not in the SUT. They belong in the same register: a test that cannot fail,
or fails for the wrong reason, misreports the system exactly as a broken endpoint does.

### DOC-02 — The gap-analysis generator stopped seeing tests after the TS migration (✅ Fixed 2026-08-21)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-21 |
| **Symptom** | Regenerating `docs/AI_GAP_ANALYSIS.md` produced a report opening with *"**No test inventory was provided.** The analysis below assumes a baseline of zero test coverage"* — 43 endpoints, 0% coverage, against a suite of 299 tests. |
| **Root cause** | `collectTestInventory()` filtered on `entry.name.endsWith(".test.js")`. After the TypeScript migration no file matched, so the script sent Claude an empty inventory. It did not error — it produced a confident, entirely wrong report, and the previous version on disk (generated 2026-05-09, when the filter still matched) hid the breakage. |
| **Fix** | Filter accepts `.test.ts` and `.test.js`. Regenerated: 33 paths, 28 with coverage, 5 without, which matches the suite. Same pass added `dotenv` to all five `ai:*` scripts — they required the key pasted on the command line, while README documented them as plain `npm run` commands. |
| **Category** | Tooling drift after a migration — a generator that degrades into a wrong answer rather than an error |
| **Portfolio note** | Same family as TST-03, one step worse. A dead npm script announces itself the moment you run it; a generator that quietly loses its input keeps producing output, and the output is a document someone may act on. Anything that reads the suite by file extension is a migration hazard worth grepping for. |

### DOC-03 — The extracted AI service was documented as wired in; it never was (✅ Fixed 2026-08-21)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-21 — wired in for real |
| **Symptom** | `BACKLOG.md` recorded *"AI service extraction + Pact redesign"* as `[x] done 2026-05-18`, stating the SUT proxies through `callAiService()`, that both compose files were updated, and that a 503 test was added. |
| **What was actually true** | `ai-service/` existed and worked standalone. Nothing called it: no client, no URL config, no compose entry, and `git log -S "callAiService"` across all branches returned nothing — the function had never been written. `AI_SERVICE_UNAVAILABLE` appeared in no SUT source file. The test `503 AI_SERVICE_UNAVAILABLE: ai-service unreachable @api` guarded on `AI_SERVICE_DEGRADE`, which nothing set, so it had skipped on every run since it was written. |
| **Decision** | Wire it. The service is a poor product decision at this size — one function does not need its own deployable — and a good testing one: it creates a real service boundary where Pact provider verification, dependency degradation and a circuit breaker are exercised against something, not simulated. |
| **What shipped** | `src/services/aiServiceClient.js` (delegation over HTTP, `AI_SERVICE_URL` / `AI_SERVICE_TIMEOUT_MS` / `AI_SERVICE_DEGRADE`); `AI_SERVICE_UNAVAILABLE` → 503 in the error catalog, distinct from `CLAUDE_UNAVAILABLE`; the breaker now counts an unreachable service as a failure; the service in `docker-compose.yml` plus an overlay `docker-compose.ai-service.yml`; a `Delegated AI service` CI job running Pact provider verification against the live service, the whole API layer over the delegated topology, and a deliberate-outage step. Delegation is opt-in: without `AI_SERVICE_URL` the decision still happens in-process, so ordinary runs need one container. |
| **Found on the way in** | Two things the wiring surfaced. (1) The two copies of `retrieval.js` had drifted: the SUT held the fixed multi-word-keyword rule, the service the old one, and switching topology would have silently reinstated **B-05** — "chest pain" → Orthopedist. Now held together by `src/__tests__/aiServiceParity.test.js`, which compares answers over a corpus rather than comparing files. (2) The service parsed Claude's reply with a bare `JSON.parse` and failed *every* real call, because Haiku wraps JSON in ```json fences; replaced with structured outputs (`output_config.format`), whose schema also carries the allowed-specialty enum. |
| **Verified** | 100 SUT unit tests; Pact provider verification against the running service; the full AI suite over the delegated topology with a real key — 17 passed, 3 skipped, 0 failed; and the degradation test, which had never once executed, passing for the first time. |
| **Category** | Documentation drift — work recorded as delivered that was never wired |
| **Portfolio note** | The skipped test is the lesson. A test that has never run is not coverage, it is a claim shaped like coverage, and it kept an absent integration looking accounted for for three months. The second lesson is cheaper to state and easier to repeat: duplicated logic in two deployables drifts, and the drift is invisible until the day you switch which copy runs. |

### DOC-01 — Six documents kept describing a split that no longer existed (✅ Fixed 2026-08-21)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-21 |
| **Symptom** | `TEST_STRATEGY.md`, `RISK_ANALYSIS.md`, `RTM.md`, `GO_NO_GO.md`, `BUSINESS_RULES.md` and `SYSTEM_WEAKNESS_REPORT.md` each opened with a notice claiming that `security.test.ts`, `chaos.test.ts`, `appointments.booking.rate-limit.test.ts`, `chaos.yml` and `security-scan.yml` lived outside this repository, and pointing the reader at a README section for them. All five files are in the repository, and README has never had that section — so the first thing a reader met was a claim they could disprove in one click, pointing at a section that does not exist. |
| **Root cause** | The notices were written when part of the suite lived in another repository, and survived the content coming back. Nothing regenerates them, so no process could notice; they are prose, and prose does not fail a build. |
| **Fix** | Where SUT-side files were genuinely meant (`API_ENDPOINTS.md`, `CONTRACT_PACK.md`, `openapi.yaml`, `retrieval.js`, `app-core.js`, `DEFENSE_NOTES.md`), the notice now says so and points at *System under test* in README. Where only in-repo tests were listed, the notice is gone. |
| **Also corrected in the same pass** | README claimed 5 fixed bugs against a register holding 23 closed entries, 120 requirements against a matrix totalling 121, and 10 visual tests against a file holding 7; `CI-01` sat open although its fix shipped 2026-05-11 in the very commit that created this register (588d7a0), and `CI-02` was marked open in the summary table while its own entry said fixed. |
| **Prevention** | `check-conventions.js` now guards register counts, the RTM total row and the visual test count from `docs/FACTS.json` — verified by breaking each on purpose and watching the check go red. |
| **Category** | Documentation drift — a claim that ages instead of breaking |
| **Portfolio note** | Test counts drift quietly; access claims drift loudly. This one told every reader that the interesting parts were held back, in a repository that had just published them. The fix worth keeping is not the edit — it is that three of the four numbers behind it now fail a check instead of ageing. |

### TST-10 — `model-drift.yml` never called a model (✅ Fixed 2026-08-27)

**Before:** the job exported `ANTHROPIC_API_KEY` and `ENABLE_AI_RECOMMENDATION` on the line that ran
`docker compose -f sut/docker-compose.test.yml up`, and the compose file hardcoded
`AI_MOCK_RESPONSE: "true"` and never mentioned `ANTHROPIC_API_KEY` at all. Variables exported before
`docker compose up` reach the **compose process**, not the container — only a `${...}` reference puts
them inside. So the SUT came up in mock mode: it answered every `@rag` request from retrieval, never
called Claude, and the job reported "no drift" every Monday.

The golden dataset is five direct symptom phrasings, which keyword retrieval gets right, so the run
was green — for the wrong reason, weekly, for as long as the job has existed. The suite's own
`AI_MOCK_RESPONSE: "false"` was set on the *runner*, which is what made the mismatch invisible: the
tests believed they were talking to a real model and the SUT was not.

**After:** `docker-compose.test.yml` reads `AI_MOCK_RESPONSE`, `ANTHROPIC_API_KEY` and
`ANTHROPIC_MODEL` through `${...}` with defaults that leave an ordinary run byte-identical, and the
drift job sets them in a proper `env:` block.

**The part worth keeping — a gate, not a fix.** Both AI jobs now fail unless `/health` reports
`checks.ai.implementation === "claude"`. The SUT already published which of its three paths it is on;
nothing asked. A corrected configuration can regress silently, and this class of defect — a job that
passes while measuring something other than what it claims — has now appeared four times in this
repository (TST-06, DOC-03, TST-09, this). The gate is the only part that makes the next one loud.

**Why it survived:** every signal pointed the right way. The workflow named the variables, the
comments described real Claude calls, the tests passed, the artifacts were dated and uploaded. The
only place the truth was visible was inside the container, and nothing looked there.

---

### TST-09 — The cassette key ignored the prompt, so every recorded request shared one key (✅ Fixed 2026-08-27)

**Before:** `cassetteKey()` hashed `JSON.stringify(body, Object.keys(body).sort())`. Given an array,
`JSON.stringify`'s second parameter is an **allow-list of property names applied at every depth**,
not a sort order — so passing the top-level keys deleted everything nested beneath them. The string
actually hashed was:

```
{"max_tokens":256,"messages":[{}],"model":"claude-haiku-4-5-20251001","output_config":{}}
```

No prompt in it at all. `chest pain and shortness of breath`, `knee pain after running` and a
question about tacos all produced `b02e25d435f3b13e`. The docstring above the function claimed the
opposite in as many words: *"the whole body participates: changing the prompt, the model, or the
schema should miss the cassette."*

**Effect — the one a replay suite cannot survive:** cassettes answer questions they were never
asked. Three files held the whole suite, one of them with 36 responses appended under a single key,
handed out in recording order to whatever asked next. Measured on the real suite before the fix:
**8 of 8 `@rag` tests passed in 2.1 seconds, 40 requests matched, 0 missed** — including
`my infant has an ear infection` and the prompt-injection battery, each served an answer recorded
for a different question. Wiring that into CI would have added a green job that asserted nothing,
which is worse than the gap it was closing.

**After:** an explicit `canonicalise()` that sorts keys recursively and keeps every value.
`cassetteKey` hashes the whole body. Six tests in `tests/unit/claude-cassette.test.ts`; the two that
matter are *two different prompts do not share a key* and its nested twin for the schema — a
top-level-only sort passes the first and fails the second.

**Consequence, closed 2026-08-27:** the three existing cassettes could not be salvaged. Only the
first request of each file was ever stored (`entry.request` is written once, on creation), so 35 of
the 36 responses in the large one belonged to prompts nobody recorded. They were deleted and the
layer re-recorded against the live API in one `npm run rag:record`: **40 responses across 29 files,
`matched 0 · recorded 40 · missed 0`**. The replay run that follows reports `matched 40 · recorded 0
· missed 0`, 8 passed in 3.5 s. `continue-on-error` is off the `rag-replay` job as of the same
commit — it gates now.

The file count is the part worth reading, and the check that separates a real fix from the old
illusion. Forty responses live in twenty-nine files because some prompts genuinely repeat — the
judge sends the same body three times, and `"chest pain and shortness of breath"` is shared by three
tests. Under the defect the same forty responses fitted in **three** files. Verified beyond the
count: every filename equals the hash of the request stored inside it (29/29), the 29 stored message
sets are pairwise distinct, and `"my infant has an ear infection"` — the case that used to be
answered from another question's recording — now owns a file whose recorded answer is
`Pediatrician`.

**Why the defect survived:** `cassetteKey` had no test. It is four lines and looks obviously right,
which is exactly the profile of the code that gets read instead of run.

---

### TST-07 — No Jest test in the SUT could load `src/app.js` (✅ Fixed 2026-08-26)

**Before:** `sut/src/__tests__/` held five suites, all of them module-level with the dependencies
stubbed. None reached `src/app.js`, and none could: `middlewares/request-id.js` requires `uuid`,
uuid 14 ships ESM in both its builds, and Jest's CommonJS runtime dies on it with
`SyntaxError: Unexpected token 'export'` before the first assertion. Node 22 loads it from CJS via
`require(esm)`, so production and the Playwright suite never saw the problem — the gap was invisible
from both sides, and showed up only when a test first tried to drive the real app.

**Effect:** anything that is a property of the *assembled* application — middleware order, what the
logger actually writes, which handler answers a given status — was unreachable from the fast suite.
The privacy tests are exactly that kind of property, so the gap surfaced the moment one was written.

**After:** `sut/test-helpers/uuid-cjs.js` (`v4()` = `crypto.randomUUID()`, the same platform source
uuid uses when it is available), mapped in `jest.config.js` under `moduleNameMapper`. Production
loads the real package unchanged.

**Why this and not a transform:** Babel would pull a toolchain into a repo that has none, to
translate one function of one dependency. The shim states the substitution in six lines where a
reader will find it.

---

### TST-08 — The AI bug reporter sent a failed test's values to Anthropic unredacted (✅ Fixed 2026-08-26)

**Before:** `utils/aiBugReporter.ts` built its prompt from `error.message` and `error.stack` as they
came. Playwright quotes the values an assertion compared, so a failing `@rag` test carried the
symptoms and a failing auth test carried an address and a bearer token — to a third party, into
`bug-reports/`, and into the Allure attachment. The reporter is wired into one demo spec today; the
obvious next step for it is every spec.

**After:** `utils/phi.ts` redacts known field values, bare addresses and JWTs;
`buildBugReportPrompt()` is exported so what leaves is assertable without a key or a network call.
Nine tests in `tests/unit/bug-reporter.redaction.test.ts`, including one that a report with nothing
personal in it comes back byte-identical — a redactor that eats everything is as useless as none.

**Why a field list and not a model:** asking a model which parts are sensitive sends the text
through the hop being guarded.

---

### TST-06 — The Claude degradation test was gated on a variable nothing set (✅ Fixed 2026-08-22)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-22 |
| **Symptom** | `Graceful degradation: wrong API key → 503 CLAUDE_UNAVAILABLE @rag` skipped on `!process.env.AI_DEGRADE_TEST`. That variable appeared nowhere else: not in `sut/.env.example`, not in any workflow, not in either README. The test had never executed once since it was written, while the register and the suite listing counted it as coverage of the 503 path. |
| **Root cause** | The guard named a configuration that did not exist. Degrading the model call needs the SUT to be *started* differently, and the SUT had no switch for it — unlike `AI_SERVICE_DEGRADE`, which points the service client at a dead port. Worse, mock mode (`AI_MOCK_RESPONSE=true`, what CI runs) answers from retrieval without calling Claude at all, so even a correct key-based misconfiguration would have returned a cheerful 200. |
| **Fix** | `CLAUDE_DEGRADE` in the SUT: the Anthropic client is constructed against `CLAUDE_DEGRADE_BASE_URL` (a dead port by default) with SDK retries off and a 2 s timeout, and the mock branch is bypassed so the call actually happens. The failure then travels the ordinary path — same catch, same `CLAUDE_UNAVAILABLE`, same breaker. Overlay `docker-compose.claude-degrade.yml` starts that topology and raises the breaker threshold, since a breaker tripping into `CIRCUIT_OPEN` is a different test. A step in the `api` job runs it on every push; the test guards on `CLAUDE_DEGRADE`, mirroring how the ai-service block guards on `AI_SERVICE_DEGRADE`. |
| **Verified** | Degraded SUT: both tests pass and the endpoint answers 503 in ~30 ms. Healthy SUT with the flag set: both fail on `Expected 503, Received 200`, so the assertion is doing work. No flag: both skip. Second test added — the failure must be attributed to `CLAUDE_UNAVAILABLE` and not `AI_SERVICE_UNAVAILABLE`, which is the whole reason there are two codes. |
| **Category** | Test infrastructure — a guard naming a configuration that was never built |
| **Portfolio note** | Third of a family found in two days: `AI_SERVICE_DEGRADE` (a backlog entry recorded as shipped, never wired), the clinic-mobile pact (a contract checked in "for provider verification" nobody verified), and this one. All three read as coverage from the outside, and all three were invisible for the same reason — a test that never runs reports nothing, and nothing looks exactly like success. Worth a grep across any suite: every environment variable a test skips on should be set somewhere. |

---

### TST-05 — Convention check read the fixture barrel by its wording, not its behaviour (✅ Fixed 2026-08-22)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-22 |
| **Symptom** | `npm run check:conventions` failed with *"fixtures/index.ts does not re-export ./pages — tests importing from '../../fixtures' would not get page objects"* on a repository where every test importing from `../../fixtures` did get its page objects, and 143 UI and E2E tests proved it by passing. |
| **Root cause** | The check tested for the string `from "./pages"` in `fixtures/index.ts`. The barrel is a chain — `userFixture → slotFixture → twoUsersFixture → pages → unstaffedSpecialty` — and index.ts re-exports only its last link. When `unstaffedSpecialtyFixture` was added to the end of the chain, the literal moved one file away and the check started reporting a healthy barrel as broken. Nothing about the guarantee had changed. |
| **Fix** | The check now walks the chain from `fixtures/index.ts` and asks whether `fixtures/pages.ts` is reachable, following re-exports and the `test as base` imports that link one fixture to the next. Plain imports are deliberately not followed: a fixture may import a page object as a type without putting it on the barrel. |
| **Verified** | Barrel truncated to `export * from "./twoUsersFixture"` — check fails with the new message. Barrel given a plain `import { LoginPage } from "./pages"` and no re-export — check still fails, so the walk cannot be satisfied by an import that carries nothing. Restored barrel — check passes. |
| **Category** | Test infrastructure — guard asserting a proxy for the property instead of the property |
| **Portfolio note** | The same shape as B-15 one level up: a check that watches the wording of an implementation goes red on healthy code as soon as the wording moves, and a red check that everyone knows to ignore is worse than no check. Guards should ask the question they mean — here "can the barrel still reach the page fixtures", not "does this one file mention them". |

---

### TST-01 — LLM judge decided by a single call and flipped between runs (✅ Fixed 2026-08-21)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-21 |
| **Symptom** | `LLM judge: reasoning semantically justifies recommended specialty @rag` failed in a full `@api` run against a healthy SUT. The reasoning it rejected was correct: *"Cardiologist specializes in heart and blood vessel disorders, which are the primary concerns for chest pain and shortness of breath symptoms that suggest potential cardiac conditions."* |
| **Root cause** | Two faults compounding. The verdict came from **one** judge call with a hard `expect(valid).toBe(true)`, and the question — *"does this reasoning logically justify the recommendation?"* — invited the judge to withhold approval for incompleteness. Measured on that one fixed input, five runs answered **false, false, true, true, true**: a ~40% failure rate on a passing system. The judge was not malfunctioning; it objected that no pulmonary or GI alternative was named — something the endpoint never claims to do. |
| **Fix** | Majority of three runs (`JUDGE_RUNS = 3`, threshold `ceil(n/2)`) — the same non-determinism guard the mobile a11y audit already used. The prompt now asks whether the reasoning supports routing to that specialist and says explicitly not to answer false merely because alternatives go unmentioned. All verdicts are attached to Allure on every run, pass or fail. |
| **Verified** | 5 consecutive runs green; a deliberately wrong reasoning (a dermatology sentence under cardiac symptoms) is still rejected 3/3, so the oracle can still say no. |
| **Category** | AI test design — non-deterministic oracle treated as a deterministic assertion |
| **Portfolio note** | The failure looked like an AI-quality problem and was a test-design problem. An LLM judge is a sampling process: one call is a sample size of one, and a threshold assertion over it encodes the noise as a verdict. Worth pairing with the negative check — an oracle nobody has watched refuse is indistinguishable from one that approves everything. |

### TST-02 — The 429 test asserted a launch configuration, not a behaviour (✅ Fixed 2026-08-21)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-21 |
| **Symptom** | `429 RATE_LIMITED after exceeding per-token limit @api` returned 200 where it expected 429 on a working local environment. |
| **Root cause** | The test sent a hard-coded 5 requests — the default of `AI_RATE_LIMIT_MAX`. A working `.env` raises that limit so the rest of the suite does not trip over the throttle, and the test then reported the launch configuration as a SUT defect. It stayed green in CI only because `docker-compose.test.yml` overrides the login, register and booking limits and happens to leave the AI one at its default. Reading `process.env.AI_RATE_LIMIT_MAX` inside the test would not have helped — the limit is enforced in the SUT process, not in this one. |
| **Fix** | Discover the ceiling by request: send up to 20 calls, stop at the first 429. If none arrives, `test.skip` with a message naming the cause and the way to run it (`restart the SUT at the default of 5`). Same rule as the Kafka and invariant suites — a suite that goes red because of how the SUT was launched trains people to ignore red. |
| **Verified** | Passes against a SUT started with `AI_RATE_LIMIT_MAX=5` (429 arrives on the 6th call); skips with the explanation against the raised limit in `.env`. |
| **Category** | Test design — environment coupling disguised as an assertion |
| **Portfolio note** | The distinction that matters: skipping *loudly* is a report, failing is a claim. This test had been making a claim about the SUT while describing the developer's `.env`. |

### TST-04 — Two SUT configurations the suite needs at once, and neither was declared (✅ Fixed 2026-08-21)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-21 |
| **Symptom** | Found while verifying the TST-02 fix. Against a SUT started at the default `AI_RATE_LIMIT_MAX=5`, `distribution drift: specialty frequencies stay within tolerance of baseline @rag` failed with *Expected: 200, Received: 429* — a throttle answering exactly as designed, reported as a broken endpoint. |
| **Root cause** | The AI suite needs mutually exclusive configurations. The throttle test wants the default of 5; every multi-call test wants it raised past the number of symptoms it sends — 12 for the drift corpus, 5 per metamorphic set, 5 for the golden dataset. Nothing stated the requirement, so which tests were red depended on how the SUT happened to be launched, and the failure message pointed at the endpoint instead of the environment. |
| **Fix** | `skipIfThrottled(status)` next to the status assertion in all 9 multi-call loops: a 429 mid-test skips with a message naming the cause and the fix, instead of asserting against it. |
| **Verified** | Both configurations, zero failures in each: at `AI_RATE_LIMIT_MAX=5` — 17 passed, 3 skipped (drift skips); at the raised limit from `.env` — 17 passed, 3 skipped (the throttle test skips). |
| **Category** | Test design — environment requirement encoded nowhere, surfaced as a false SUT defect |
| **Portfolio note** | Sibling of TST-02 and the more interesting half: there the test asserted a configuration, here two tests demanded opposite configurations and neither said so. A suite carrying incompatible environment requirements has to state them, or every run is red about the wrong thing. |

### TST-03 — `npm run test:visual` pointed at a file the TypeScript migration renamed (✅ Fixed 2026-08-21)

| Field | Value |
|---|---|
| **Status** | ✅ Fixed 2026-08-21 |
| **Symptom** | `npm run test:visual` and `test:visual:update` answered "No tests found" — so visual regressions went unchecked and baselines could not be refreshed through the documented command. |
| **Root cause** | Both scripts still named `tests/ui/visual.test.ts`; the migration renamed it to `.ts`. Playwright treats an unmatched path as "no tests", not as an error, so nothing announced the breakage. |
| **Fix** | Point both scripts at `visual.test.ts`. The suite runs 14 checks (7 tests × chromium + mobile-chrome) and passes. |
| **Category** | Tooling drift after a migration |
| **Portfolio note** | The whole visual layer was unreachable through its own npm script and nothing went red. Worth a convention check: every path named in `package.json` should exist. |

---

## Summary table

| ID | Title | Status | Severity | Found by |
|---|---|---|---|---|
| B-01 | IDOR on `GET /appointments/:id` | ✅ Fixed 2026-04-30 | High | `security.test.ts` |
| B-02 | Missing landmarks + heading (a11y) | ✅ Fixed 2026-04-30 | Medium | `accessibility.test.ts` (axe-core) |
| B-03 | WS never connected (`ClinicCore` undefined) | ✅ Fixed 2026-05-03 | High | `doctor-notifications.e2e.test.ts` |
| B-04 | Confirm banner hidden in <1ms | ✅ Fixed 2026-05-03 | Low | `doctor-confirm.e2e.test.ts` |
| B-05 | "chest pain" → Orthopedist (wrong retrieval ranking) | ✅ Fixed 2026-08-21 | Medium | Pact provider verification |
| B-06 | `doctors: []` on valid 200 (unseeded specialties) | ✅ Resolved 2026-06-22, covered by a test 2026-08-22 | Medium | Pact provider verification |
| B-07 | Wrong operation order in reschedule → 409 with active waitlist | ✅ Fixed 2026-05-16 | High | `appointments.reschedule.test.ts` |
| CI-01 | Rate limit test: 400 instead of 429 in CI | ✅ Fixed 2026-05-11: skip guard + `RATE_LIMIT_REGISTER_MAX` in CI env | Low | CI run 2026-05-11 |
| CI-02 | Flaky SLOT_OVERLAP in waitlist offers test | ✅ Fixed 2026-05-20 | Low | CI run 2026-05-11 |
| CI-03 | Route pattern broke on paginated URL (missing `**`) | ✅ Fixed 2026-05-16 | Low | `api-error-states.test.ts` |
| CI-04 | Private SUT repo → misleading "file not found" in CI | ✅ Fixed 2026-05-18 | Medium | CI run 2026-05-18 |
| CI-05 | `SQLITE_READONLY` in teardown — Docker owns the DB file | ✅ Fixed 2026-05-18 | Low | CI run 2026-05-18 |
| D-01 | Color contrast below WCAG AA | ⚠️ Design debt | Low | `accessibility.test.ts` |
| D-02 | Doctor self-registration — no `doctorRecordId` validation | ⚠️ Design debt | High (prod) | Manual review |
| D-03 | Rate limiting per-IP only | ⚠️ Design debt | Low | Manual review |
| CI-06 | Doctor schedule pollution → ordering-dependent fixture failures | ✅ Fixed 2026-05-20 | Low | Full `@api` run 2026-05-18 |
| DEAD-01 | `INVALID_PATTERN` errorCode unreachable — dead code in repository layer | ⚠️ Design debt | Low | `appointments.recurring.test.ts` 2026-05-17 |
| B-14 | Procedure bookable into slot shorter than 60min — no SLOT_TOO_SHORT check | 🔴 Open | Medium | `appointments.type.test.ts` 2026-05-19 |
| B-15 | `isAvailable` serialised as `0`/`1` where the mobile contract pins a boolean | ✅ Fixed 2026-08-22: `toApiSlot` maps the column on the API read paths; OpenAPI response schema corrected to `boolean` | Medium | `mobile.pact.provider.test.ts` 2026-08-22 |
| B-08 | `deleteOwnedSlotIfUnused` FK violation: `waitlist_offers` not deleted before slot | ✅ Fixed 2026-05-20 | Medium | Teardown debugging 2026-05-20 |
| B-09 | `softDeleteUser` missing `slot_waitlist` cleanup → ghost promotion in teardown | ✅ Fixed 2026-05-20 | Medium | Teardown debugging 2026-05-20 |
| CI-07 | `slotFixture` teardown: `cancelAsDoctor` triggers `promoteFromWaitlist` loop | ✅ Fixed 2026-05-20 | Low | Teardown error surfacing 2026-05-20 |
| CI-08 | `withSecondSlot`: no appointment cancel before `deleteSlot` after offer accept | ✅ Fixed 2026-05-20 | Low | DB inspection 2026-05-20 |
| B-10 | Waitlist offer held a slot until accepted or declined; an unanswered offer kept the slot off sale past its TTL | ✅ Fixed 2026-08-13: `expireStaleOffers()` sweep + `AUTO_EXPIRE_OFFERS_INTERVAL_MS` timer | High | Invariant review of `isAvailable` 2026-08-13 |
| B-11 | Expiry write in `acceptOffer` ran inside `db.transaction()` with the 410 thrown from the same block; better-sqlite3 rolls back on throw, so the row kept its previous status | ✅ Fixed 2026-08-13: expiry returns a marker, throw moved outside the transaction | Medium | Same review; confirmed with a `better-sqlite3` rollback probe |
| B-12 | Eligibility rule covered `declined`; an offer that lapsed left the same patient first in line for that slot | ✅ Fixed 2026-08-13: `expired` added alongside `declined`, shipped with the sweep | Medium | Surfaced while implementing B-10 |
| INV-01 | `isAvailable` consistency was covered by scenario tests only, so detection depended on a test targeting the path | ✅ Addressed 2026-08-13: `ASSERT_INVARIANTS` runtime contract (5 checks) + `idx_offers_one_pending_per_slot` | Medium | Invariant review 2026-08-13 |
| TST-01 | LLM judge decided on one call; ~40% failure rate on a correct answer | ✅ Fixed 2026-08-21: majority of 3 + sharpened question + verdicts in Allure | Medium | Full `@api` run 2026-08-21 |
| TST-02 | 429 test hard-coded the default rate limit, so it asserted the launch configuration | ✅ Fixed 2026-08-21: ceiling discovered by request, loud skip otherwise | Low | Full `@api` run 2026-08-21 |
| TST-03 | `test:visual` pointed at `visual.test.ts` after the TS migration — "No tests found", never red | ✅ Fixed 2026-08-21: path corrected, 14 checks pass | Low | Repository audit 2026-08-21 |
| TST-05 | Convention check looked for a literal `from "./pages"`; a longer fixture chain moved it and the check went red on a healthy barrel | ✅ Fixed 2026-08-22: the check walks the export chain and asks whether `fixtures/pages.ts` is reachable | Low | Full run after the B-15 fix 2026-08-22 |
| TST-06 | Claude degradation test gated on `AI_DEGRADE_TEST`, a variable nothing in either repository ever set — it had never run | ✅ Fixed 2026-08-22: `CLAUDE_DEGRADE` switch in the SUT + compose overlay + CI step; test rewired and a second assertion added | Medium | Repository audit 2026-08-21, fixed 2026-08-22 |
| TST-07 | No Jest test in the SUT could load `src/app.js` — uuid 14 is ESM-only and Jest's CommonJS runtime dies on it, so every property of the *assembled* app was unreachable from the fast suite | ✅ Fixed 2026-08-26: `test-helpers/uuid-cjs.js` mapped in `jest.config.js`; production loads the real package unchanged | Medium | Writing the first test that needed the real app 2026-08-26 |
| TST-08 | AI bug reporter sent a failed test's `error.message` and `error.stack` to Anthropic unredacted — Playwright quotes the compared values, so symptoms and bearer tokens travelled to a third party, a file and the Allure report | ✅ Fixed 2026-08-26: `utils/phi.ts` + `buildBugReportPrompt()` split out of the transport; 9 tests | High | PII audit of the three paths symptoms leave by 2026-08-26 |
| TST-09 | Cassette key ignored the prompt — `JSON.stringify(body, keys)` filters properties at every depth instead of sorting them, so every recorded request shared one key and replay answered questions it was never asked (8/8 green in 2.1s, 40 matched, 0 missed) | ✅ Fixed 2026-08-27: explicit recursive `canonicalise()`; 6 tests. Unsalvageable cassettes deleted and re-recorded the same day — 40 responses across 29 files (was 3), replay `matched 40 · missed 0`, job now gating | High | Wiring the replay job into CI 2026-08-27 |
| TST-10 | `model-drift.yml` never called a model — shell variables before `docker compose up` reach the compose process, not the container, and the compose file hardcoded `AI_MOCK_RESPONSE: "true"`; the job reported "no drift" weekly from mid-May | ✅ Fixed 2026-08-27: `${...}` pass-through + a `/health` gate asserting `implementation === "claude"` in both AI jobs | High | Centralising the model id 2026-08-27 |
| TST-04 | AI suite needs two mutually exclusive `AI_RATE_LIMIT_MAX` settings; a correct 429 was reported as a broken endpoint | ✅ Fixed 2026-08-21: `skipIfThrottled()` in all 9 multi-call loops | Medium | Verifying the TST-02 fix 2026-08-21 |
| DOC-01 | Six docs claimed that tests living in this repository lived elsewhere, pointing at a README section that never existed | ✅ Fixed 2026-08-21: notices rewritten or removed; counts corrected and put under the convention check | Medium | Repository audit 2026-08-21 |
| DOC-02 | `ai-gap-analysis.js` filtered on `.test.js`; after the TS migration it reported 0% coverage over an empty inventory | ✅ Fixed 2026-08-21: filter accepts `.ts`, report regenerated, `dotenv` added to all `ai:*` scripts | Medium | Regenerating the report 2026-08-21 |
| DOC-03 | `ai-service` recorded as wired into the SUT since 2026-05-18; `callAiService()` has never existed | ✅ Fixed 2026-08-21: delegation client, distinct 503 code, compose entry, CI job; parity test added after the two retrieval copies were found drifted | Medium | Repository audit 2026-08-21 |

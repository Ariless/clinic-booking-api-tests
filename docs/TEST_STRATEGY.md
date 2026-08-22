# Test strategy — clinic-booking-api-tests


<!-- sut-refs-notice -->
> **Referenced but living in the SUT repository:** `API_ENDPOINTS.md`, `CONTRACT_PACK.md`, `TESTING_AGAINST_THIS_SUT.md`, `openapi.yaml`, `PROJECT_PLAN.md`, `retrieval.js`, `appointmentsRepository.js`, `docker-compose.test.yml`, `docker-compose.observability.yml` — see *System under test* in `README.md`.

This document is the **risk- and portfolio-facing** view of the full suite (API + UI + E2E). **How** we build (pyramid, flakes, clients) stays in **`../DESIGN_PRINCIPLES.md`**.

**SUT contract (state machine, `errorCode`, RBAC):** use the system-under-test repo — `API_ENDPOINTS.md`, `CONTRACT_PACK.md`, `TESTING_AGAINST_THIS_SUT.md`, OpenAPI.

**Architectural weaknesses, race conditions, state consistency gaps:** **`SYSTEM_WEAKNESS_REPORT.md`** — QA analysis of where the system can fail and how the test suite covers (or plans to cover) each class of failure.

If you use the training fork **`clinic-booking-api-learning`**, the same ideas are mirrored there under **`PROJECT_PLAN.md`** → *External companion: Playwright API tests* and checkboxes in **`TODO.md`**.

---

## Appointment state machine

All tests map to transitions in this diagram. Terminal states (`cancelled`, `rejected`) cannot be re-entered.

```mermaid
stateDiagram-v2
    [*] --> pending : POST /appointments (patient books)

    pending --> confirmed : PATCH /confirm (doctor)
    pending --> rejected  : PATCH /reject (doctor)
    pending --> cancelled : PATCH /cancel (patient or doctor)
    pending --> cancelled : auto-expire (pending > max age)

    confirmed --> cancelled : PATCH /cancel (patient or doctor)

    pending   --> pending   : PATCH /reschedule (patient) — new slot, same doctor
    confirmed --> pending   : PATCH /reschedule (patient) — new slot, same doctor; doctor must re-confirm

    cancelled --> [*]
    rejected  --> [*]
```

**Full rules** (allowed/disallowed transitions, reschedule constraints, RBAC, error codes): **`BUSINESS_RULES.md`** §3, §7, §9.

---

## 1. Goal

Prove **high-impact failures** early, not maximize endpoint coverage:

- double sale of one slot (concurrency / `409`)
- cross-role data access (RBAC)
- wrong or inconsistent **appointment + slot** state
- broken **auth** and **catalog** entry points

### Risk tiers (how we talk about priority)

| Tier | Examples | Tests |
| --- | --- | --- |
| **High** | Double book, RBAC leak, core book path broken, E2E booking journey | Smoke + dedicated `@api` / `@e2e` files; see **`RISK_ANALYSIS.md`** |
| **Medium** | Cancel, reject, post-confirm slot invariant, invalid `422`, UI navigation flows | `@api` / `@ui` / `@e2e` planned files |
| **Low** | Doctor list schema, register form validation | Smoke or `@ui` as needed; not the main story |
| **Operational** | Rate limits, chaos, infrastructure health | `@rate-limit` / `@chaos` — conditional; require special env; separate CI job |

---

## 2. Scope

| In scope | Out of scope (here) |
| --- | --- |
| `POST/PATCH/GET` flows under `/api/v1` for auth, doctors, appointments | Full OpenAPI matrix |
| Slot visibility vs appointment state | Payment integrations |
| Tags for selective CI | |
| Performance baseline — k6 (see §14.4) | |

---

## 3. Risk-based layers (how we tag)

| Tag | Intent | Typical run |
| --- | --- | --- |
| **`@smoke`** | Fast gate: product can “breathe” (login, critical path fragment, RBAC boundary, catalog) | Every commit / PR |
| **`@api`** | Deeper contract and state transitions (confirm, reject, invariants) | PR or nightly |
| **`@regression`** | Optional explicit marker for “full depth” cases when you split CI jobs | Same as `@api` until you add `@regression` to selected titles |
| **`@negative`** | Invalid input / expected `4xx` / contract violations (use sparingly; avoid duplicating every field validator) | PR or with `@api` grep |
| **`@rbac`** | Optional extra marker on access-boundary tests (today **`appointments.rbac.patient`** and **`appointments.rbac.cross-doctor`** are `@smoke` only — add `@rbac` in the title when you want `grep @rbac`) | Smoke or regression |
| **`@ui`** | Pure UI state checks — no API assertion; headed Chromium | PR or nightly alongside `@api` |
| **`@e2e`** | Cross-layer journeys — UI action + API assertion (or vice-versa); `workers: 1` | PR or nightly |
| **`@chaos`** | Chaos mode feature verification — requires a **chaos-enabled server** (see §12); never runs in normal smoke/api jobs | Separate CI job or local manual run |
| **`@unit`** | Pure unit tests — no HTTP, no SUT, no browser; test SUT modules in isolation (retrieval scoring, prompt construction) | Always — no env setup needed |

Filter examples:

```bash
npm run test:smoke
npx playwright test --grep @api
npx playwright test --grep @negative   # when titles include it
npx playwright test --grep @rbac       # when titles include it
npx playwright test --grep @chaos      # requires CHAOS_ENABLED=true server
```

---

## 4. State machine — ownership of tests (portfolio narrative)

We avoid **two unrelated tests failing for one broken transition** by **splitting responsibility**:

| Layer | Files (pattern) | What it proves |
| --- | --- | --- |
| **J1 — user intent** | `appointments.mini.j1.*` | Slot → book → **pending** visible in `GET …/appointments/my` (smoke stops here; doctor confirm is **J3**). |
| **J3 — system transition** | `appointments.confirm.j3.*` | Doctor **confirm** → `confirmed` + **slot / public diary invariants** (e.g. slot not offered as available where contract forbids). |
| **J2 — alternative branch** | `appointments.reject.j2.*` | Reject + slot **returns** to a bookable/public state per contract. |
| **RBAC** | `appointments.rbac.patient.*`, `appointments.rbac.cross-doctor.*` | Patient JWT **cannot** read doctor’s appointments list (`403` / `FORBIDDEN`). |

Invalid transitions (`422`), refresh, and extra RBAC rows are **second wave** — see **`RISK_ANALYSIS.md`** and learning repo **`TODO.md`**.

---

## 5. Test data & isolation

- **Unique slot windows:** `data/seedAccounts.ts` → `nextSeedSlotWindow()` so parallel files against one SQLite DB do not hit `SLOT_OVERLAP` across tests.
- **No cross-file order:** each test creates what it needs (seed logins and/or register + teardown where used).

### API clients (one layer, not raw URLs in specs)

HTTP paths and JSON shapes live in **`api/*Client.js`** + **`data/testData.ts`** (`endpoints`). Specs call **`appointments.createAppointment`**, **`doctors.createSlot`**, etc. — so contract drift is fixed in **one place** and tests stay readable. (Full norms: **`DESIGN_PRINCIPLES.md`**.)

---

## 6. Schema validation (AJV)

Response shapes are validated with [AJV](https://ajv.js.org/) (JSON Schema, draft-07).

| File | What it validates |
| --- | --- |
| `utils/schemaValidator.ts` | Shared AJV instance + `assertSchema(body, validate)` helper |
| `data/schemas/errorSchema.ts` | Error contract: `errorCode`, `message`, `requestId` — all required, non-empty strings |
| `data/schemas/authSchemas.ts` | Token response: `token`, `refreshToken`, `user` object with `id`, `email`, `role`, `name` |
| `data/schemas/appointmentSchemas.ts` | Appointment object: `id`, `slotId`, `patientId`, `status` (enum), `createdAt` |
| `data/schemas/doctorsSchemas.ts` | Doctor list item: `id`, `name`, `specialisation`, `doctorRecordId` |

**Pattern in tests:**

```js
assertSchema(body, validateError);          // shape — required fields, types
expect(body.errorCode).toBe("FORBIDDEN");   // value — specific case assertion
```

All schemas use `additionalProperties: true` — non-breaking API additions do not fail the suite.

---

## 7. High-value cases (track in SUT `TODO` / learning `PROJECT_PLAN`)

| Case | File / status | Thesis |
| --- | --- | --- |
| Second patient, same `slotId` → `409` | **`appointments.booking.conflict.test.ts`** (`@api`) — **shipped** | No double booking |
| Patient `PATCH …/cancel` | **`appointments.cancel.patient.test.ts`** (`@api`) — **shipped** | Lifecycle + slot availability |
| Waitlist join → view → leave (happy path) | **`appointments.waitlist.test.ts`** (`@api`) — **shipped** | Core waitlist lifecycle |
| Waitlist duplicate join → `409`, patient deletes another's entry → `403` | **`appointments.waitlist.test.ts`** (`@api`) — **shipped** | Data integrity + security boundary |
| Cancel / reject → waitlist patient auto-promoted | **`appointments.waitlist.promotion.test.ts`** (`@api`) — **shipped** | Core business value: freed slot goes to next in queue |
| Waitlist offer: get pending offers, accept (swap booking), decline (stay on waitlist), 409 on double-accept | **`appointments.waitlist.offers.test.ts`** (`@api`) — **shipped** | Manual confirmation flow when patient already has an active booking |
| Login rate limit → `429 RATE_LIMITED` | **`auth.login.test.ts`** (`@rate-limit`) — **shipped**; run with `RATE_LIMIT_LOGIN_MAX=2 RATE_LIMIT_LOGIN_WINDOW_MS=5000` | Brute-force protection on login |
| Register rate limit → `429 RATE_LIMITED` | **`auth.register.test.ts`** (`@rate-limit`) — **shipped**; run with `RATE_LIMIT_REGISTER_MAX=2 RATE_LIMIT_REGISTER_WINDOW_MS=5000` | Spam registration prevention |
| Booking rate limit → `429 RATE_LIMITED` | **`appointments.booking.rate-limit.test.ts`** (`@rate-limit`) — **shipped**; run with `RATE_LIMIT_BOOKING_MAX=2 RATE_LIMIT_BOOKING_WINDOW_MS=5000` | Slot-hoarding / abuse prevention |
| Chaos mode: 503 contract + health exempt + probability off-switch + deterministic seed + latency | **`chaos.test.ts`** (`@chaos`) — **fully implemented** (see §12) | QA engineers test their own chaos infrastructure; interview: "I verify the tool that makes tests harder" |

---

## 8. File naming (this repo)

`{domain}.{feature}[.qualifier].test.ts` under `tests/api/` — e.g. `auth.login`, `appointments.reject.j2`, `appointments.rbac.cross-doctor`.

---

## 9. Success criteria

The suite is “good enough” for a **middle+/senior** story when:

- a failing test maps to a **named business harm** (money/conflict, privacy, broken lifecycle),
- smoke stays **short** and **stable**,
- deeper rules live in **`@api`** (or tagged regression) without duplicating the same transition without reason.

---

## 10. What we deliberately do *not* do (yet)

These are **conscious trade-offs** for a small suite — not oversights:

| Pattern | Decision |
| --- | --- |
| **Folders** `tests/api/smoke/` vs `regression/` vs `negative/` | **Not required** while file count is low; we use **`tests/api/`** + **`{domain}.{feature}.test.js`** + **tags**. Revisit if the tree grows past ~15–20 API files. |
| **TypeScript** | SUT-aligned **JavaScript (CommonJS)**; no TS migration for portfolio optics alone. |
| **`auth.validation` as its own file** | Register validation already lives in **`auth.register.test.ts`**; splitting would be cosmetic. |
| **`appointments.happy-path` rename** | **J1 / J2 / J3** names carry **state-machine** meaning; we do not rename to generic “happy-path” templates. |
| **Extended RBAC** (patient cannot confirm/reject; doctor cannot act on other doctors’ visits) | **Shipped** — `appointments.rbac.patient.test.ts`, `appointments.rbac.cross-doctor.test.ts` (`@api`). |
| **Mobile viewport testing** | **Shipped** — `mobile-chrome` project (`devices[‘Pixel 7’]`) added to `playwright.config.ts`; runs all `tests/ui/**` tests automatically on Pixel 7 viewport. 12/12 pass. API tests excluded (run on `chromium` only). |
| **Cucumber / BDD** (`playwright-bdd`) | Write `.feature` files (Gherkin) for key journeys (J1 book, U1 guest gate, E1 cross-layer); step definitions reuse existing Page Objects. `playwright-bdd` bridges Playwright runner + Cucumber syntax. Allure displays Given/When/Then steps per scenario — strong portfolio signal when combined with Allure already in place. |

---

## 11. Metrics (portfolio — not a metrics program)

**Useful for interviews / job search:** yes, if **light** and **truthful** — they show you know *what to measure and why*. **Avoid:** fake coverage %, heavy Grafana for a solo learning repo, or invented test-distribution percentages unless your tags really match.

**Good enough set:**

| Signal | Purpose |
| --- | --- |
| **Smoke pass / fail** | “Is the critical slice green?” — Playwright exit code + HTML report. |
| **Wall time** | Smoke and full API should stay **fast** (order of seconds locally) or smoke stops being a useful gate. |
| **Flakes** | Target **zero** as the goal; document in PR when something is quarantined. |
| **Risk table** | **`RISK_ANALYSIS.md`** is the primary “coverage” artifact — update ✅ vs Planned when tests land. |

**Do not** claim enterprise KPIs you do not run in CI. **`README.md`** has a short **Test metrics** snapshot aligned with this section.

**CI:** GitHub Actions runs smoke then **`npm test`** (entire `./tests` tree: API now; UI + e2e included automatically when files exist) against a **real checked-out SUT** — pass/fail and wall time are in the run log; HTML report is an artifact (see **`README.md`** → *CI*).

---

## 12. Chaos mode tests (`@chaos`)

File: **`tests/api/chaos.test.ts`**  
Tag: `@chaos` — excluded from normal smoke/api runs.

### Current state

**Fully implemented (2026-04-30):**
- Test 1 (smoke, chaos OFF): `GET /api/v1/doctors` → `200` when `CHAOS_ENABLED` is false — guards normal CI runs.
- Test 2 (`@chaos`): `CHAOS_FAIL_PROBABILITY=1` → `503` with `{ errorCode: "CHAOS_ERROR", message, requestId }`.
- Test 3 (`@chaos`): `GET /health` → `200` unaffected (chaos is mounted only at `/api/v1`).
- Test 4 (`@chaos`): `CHAOS_FAIL_PROBABILITY=0` → 5 parallel requests all return `200` — probability knob is the real off-switch.
- Test 5 (`@chaos`): `CHAOS_SEED=abc CHAOS_FAIL_PROBABILITY=0.5` → 20 sequential requests contain both `200` and `503` — seed controls the sequence.
- Test 6 (`@chaos`): `CHAOS_FAIL_PROBABILITY=0 CHAOS_LATENCY_MS=300` → response time ≥ 10ms and < `CHAOS_LATENCY_MS + 500`.

**Note on health chaos-state reporting (case 1):** `GET /health` currently does **not** expose `checks.chaos.status`. Skip guard in the test uses `process.env.CHAOS_ENABLED` from the test runner env instead. If the SUT health route is extended to include chaos state, add a corresponding assertion here.

### Setup requirement

These tests require the SUT started with chaos env vars, **not** the default server. Two approaches:

- **Local:** restart server with `CHAOS_ENABLED=true CHAOS_FAIL_PROBABILITY=1`, then run `CHAOS_ENABLED=true npx playwright test chaos.test.ts`
- **CI:** separate `chaos.yml` workflow (`workflow_dispatch`) starts the SUT with chaos env before running `@chaos` grep

### Test cases (full target set)

| # | What | Status | How | Assertion |
| --- | --- | --- | --- | --- |
| 1 | **Smoke: chaos off by default** | ✅ shipped | `GET /api/v1/doctors` (chaos OFF) | `200` |
| 2 | **503 error contract** | ✅ shipped | `CHAOS_FAIL_PROBABILITY=1`; any `GET /api/v1/doctors` | `503`, body `{ errorCode: "CHAOS_ERROR", message, requestId }` |
| 3 | **Probability off-switch** | ✅ shipped | `CHAOS_FAIL_PROBABILITY=0`; 5 parallel requests | All `200` — zero `503 CHAOS_ERROR` responses |
| 4 | **Health and metrics exempt** | ✅ shipped | `CHAOS_FAIL_PROBABILITY=1`; `GET /health` | `200` — chaos mounted only at `/api/v1` |
| 5 | **Deterministic seed** | ✅ shipped | `CHAOS_SEED=abc CHAOS_FAIL_PROBABILITY=0.5`; 20 sequential requests | Both `200` and `503` present; same sequence on every restart with same seed |
| 6 | **Latency injection** | ✅ shipped | `CHAOS_FAIL_PROBABILITY=0 CHAOS_LATENCY_MS=300`; time one request | `200`; elapsed ≥ 10ms and < `CHAOS_LATENCY_MS + 500` |

### Interview line

"I don't only test the product — I also verify that the chaos tool itself behaves as documented. If `CHAOS_SEED` were non-deterministic or the `/health` endpoint bled chaos faults, my chaos-based tests would produce false confidence. The test file is the contract for the infrastructure, not just the application."

---

## 13. CI job separation

**Current state (implemented 2026-04-29):** two workflow files under `.github/workflows/`:

| File | Trigger | Jobs |
| --- | --- | --- |
| `api-tests.yml` | push / PR to `main` | `smoke` → `api` + `e2e` (parallel) → `allure-report` |
| `chaos.yml` | `workflow_dispatch` (manual) | `chaos` |

### Active job layout

```mermaid
flowchart LR
    push([push / PR]) --> smoke

    subgraph api-tests.yml
        smoke[smoke\n@smoke tags\n~1s] --> api[api\ntests/api\n~3s]
        smoke --> e2e[e2e + ui\ntests/e2e\ntests/ui]
        api --> allure[allure-report\nGitHub Pages]
        e2e --> allure
    end

    subgraph chaos.yml
        manual([workflow_dispatch]) --> chaos[chaos\nCHAOS_ENABLED=true\n@chaos grep]
    end
```

> Smoke is the gate — API and E2E only start if smoke passes. Allure always runs (`if: always()`), even on failure.

### npm scripts

| Script | What it runs | Used by |
| --- | --- | --- |
| `test:smoke` | `--grep @smoke` | smoke job |
| `test:api` | `tests/api` | api job |
| `test:browser` | `tests/e2e tests/ui --pass-with-no-tests` | e2e job |
| `test:ui` | `tests/ui --pass-with-no-tests` | local |
| `test:e2e` | `tests/e2e --pass-with-no-tests` | local |
| `test:chaos` | `--grep @chaos` | chaos job |

### Rules
- **Smoke must pass** before downstream jobs start (`needs: [smoke]`).
- **`@chaos` always in its own workflow** — needs a chaos-enabled SUT; never mixed with normal smoke.
- **SQLite + parallel**: `e2e` stays `workers: 1` until SUT migrates to Postgres or test-DB-per-worker pattern.
- **`--pass-with-no-tests`** on browser job: e2e/ui jobs stay green until those test files are committed.

### Planned (not yet implemented)

```yaml
  regression:     # nightly / manual; needs: [smoke]; all @regression tags
  mobile:         # manual / scheduled; --project=mobile-chrome (Playwright device emulation)
```

### Local-only suites — risk vs infrastructure cost

Not every suite belongs in CI. The decision is explicit: signal value weighed against the infrastructure required to run it reliably.

| Suite | Why local only | Unblocking condition |
|---|---|---|
| `chaos.test.ts` (`@chaos`) | Requires chaos-enabled SUT (`CHAOS_ENABLED=true`, `CHAOS_PROBABILITY`, fault injection middleware). CI SUT runs in standard mode. | Separate `chaos.yml` already exists — triggered manually via `workflow_dispatch`. |
| `observability.loki.test.ts` (`@observability`) | Requires full Loki stack (`docker-compose.observability.yml`). CI runs SUT only, no Loki sidecar. | Add observability compose to CI workflow + `LOKI_ENABLED=true`. High infrastructure cost for low CI frequency value. |
| `appointments.booking.rate-limit.test.ts` | Requires `RATE_LIMIT_WINDOW_MS` env override — CI SUT uses production defaults; parallel runs exhaust the window and produce false 429s. | Add env override to `api-tests.yml`; or isolate to a separate serial job. |

**Why this matters:** running these in the default CI job would produce flaky failures caused by missing infrastructure, not product defects — exactly the failure-classification problem the framework is designed to avoid.

### SUT lifecycle — Docker Compose (changed 2026-05-09)

**Before:** each CI job started the SUT with a shell background process:

```yaml
- name: Install & seed SUT
  working-directory: sut
  run: npm ci && npm run db:seed

- name: Start SUT
  working-directory: sut
  run: |
    npm start > /tmp/sut.log 2>&1 &
    echo $! > /tmp/sut.pid
    for i in $(seq 1 45); do
      if curl -sf "$BASE_URL/health" > /dev/null; then echo "SUT ready"; exit 0; fi
      sleep 1
    done
    echo "=== SUT failed to start ===" && cat /tmp/sut.log && exit 1

- name: Stop SUT
  if: always()
  run: |
    [ -f /tmp/sut.pid ] && kill "$(cat /tmp/sut.pid)" 2>/dev/null || true
```

Rate limits were also overridden via `env:` in the workflow (global `RATE_LIMIT_*` vars).

**After:** each CI job uses Docker Compose:

```yaml
- name: Start SUT
  run: |
    mkdir -p sut/data
    docker compose -f sut/docker-compose.test.yml up -d --wait

- name: Stop SUT
  if: always()
  run: docker compose -f sut/docker-compose.test.yml down
```

Rate limits, `AI_MOCK_RESPONSE`, `CHAOS_ENABLED`, and all SUT env vars now live in `sut/docker-compose.test.yml`.

**Why:**
- `--wait` blocks until the healthcheck passes — no manual curl loop needed
- The image is the same artifact run locally and in CI: "works on my machine" and "works in CI" become the same statement
- `docker compose down` always removes the container, even if tests crash — no orphan processes
- SUT config is in one file (`docker-compose.test.yml`) rather than scattered between the workflow and `.env`

**Constraint:** `dbClient.ts` reads SQLite directly from the filesystem (not via API). The container uses a bind mount `./data:/app/data` so the test runner can still access the DB file at `sut/data/clinic.db` from outside the container.

**Note for local runs:** same command as CI:
```bash
mkdir -p sut/data
docker compose -f sut/docker-compose.test.yml up -d --wait
BASE_URL=http://localhost:3000 npx playwright test
docker compose -f sut/docker-compose.test.yml down
```

### Interview line

"Smoke is the gate — if it fails, nothing downstream runs. API and E2E start in parallel after smoke passes. The SUT runs as a Docker container in every CI job — same image locally and in CI, no curl loop, no orphan processes. `docker compose --wait` blocks until the healthcheck passes. Chaos is a separate manual workflow that starts the SUT with fault injection before running `@chaos` tests. Allure always merges results from all jobs and deploys to Pages even if a job fails. Three suites are intentionally local-only: chaos needs a fault-injected SUT, observability needs a Loki stack, and rate-limit tests need an env override to avoid false 429s in parallel CI runs. Each has an explicit unblocking condition — the exclusion is a cost decision, not a gap."

---

## 14. Portfolio differentiators — planned (agreed 2026-04-30)

Five patterns that distinguish this suite from typical QA portfolios. Each ships as SUT feature + tests together.

### 14.1 Security testing (`@security`)

File: **`tests/api/security.test.ts`**

Not penetration testing — boundary assertions that prove the API rejects unauthorized or malformed access at the contract level.

| Case | What | Assertion |
| --- | --- | --- |
| IDOR — patient reads another patient's appointment | `GET /appointments/:otherId` with own JWT | `403` |
| IDOR — patient cancels another patient's appointment | `PATCH /appointments/:otherId/cancel` with own JWT | `403` |
| BOLA — patient deletes another patient's waitlist entry | `DELETE /appointments/waitlist/:otherId` with own JWT | `403 FORBIDDEN` |
| BOLA — patient accepts another patient's waitlist offer | `POST /appointments/waitlist-offers/:otherId/accept` with own JWT | `403 FORBIDDEN` |
| BOLA — patient declines another patient's waitlist offer | `POST /appointments/waitlist-offers/:otherId/decline` with own JWT | `403 FORBIDDEN` |
| JWT tampered — modified payload | altered token on any protected route | `401` |
| Missing auth header | any `/api/v1` protected route with no `Authorization` | `401` |

**BOLA (Broken Object Level Authorization)** — OWASP API Top 10 №1. Same class as IDOR but API-specific: endpoint receives an object ID and must verify the caller owns that object. Waitlist offers are particularly sensitive — accepting one triggers slot reassignment and appointment cancellation.

### 14.2 Accessibility testing (`@a11y`)

**Status: ✅ shipped (2026-04-30)**

File: `tests/ui/accessibility.test.ts` — 3 tests, tag `@a11y @ui`.

Tool: **`@axe-core/playwright`** — axe-core runs against live pages in Chromium, asserts zero violations.

**Pages tested:** login (`/login`), register (`/register/patient`), patient booking (`/patient/booking`).

**What axe checks:** landmark structure, heading hierarchy, ARIA labels, keyboard navigability, colour contrast.

**Known exclusion:** `color-contrast` rule disabled — `.muted` uses `#64748b` (3.9:1 ratio, below WCAG AA 4.5:1). Documented design debt; all structural and keyboard violations are fully asserted.

**SUT fixes applied (2026-04-30):**
- Added `<main>` landmark to login, register, and booking pages
- Added visually-hidden `<h1>` to booking page (had `<h2>` sections but no page-level heading)
- Added `.visually-hidden` CSS utility class to `app.css`

**Why:** EU Accessibility Act (2025) makes this a legal requirement for web services in the UK/EU market. Most QA portfolios don't include a11y — this shows awareness of real users beyond happy-path testers.

### 14.3 Mutation testing (Stryker)

**Status: ✅ shipped (2026-05-01)**

Tool: **Stryker** on the SUT codebase (`clinic-booking-api`).  
Files: `src/utils/appointmentStateMachine.js` (mutated) + `src/utils/__tests__/appointmentStateMachine.test.js` (14 Jest unit tests).

**What was done:**
- Extracted the appointment state machine validation into a pure, testable function `isValidTransition(fromStatus, toStatus)`
- Refactored `appointmentsRepository.js` to call it instead of repeating inline status checks
- Wrote 14 unit tests covering all valid transitions, all invalid transitions, and edge cases (unknown/undefined status, terminal states have zero transitions)
- Ran Stryker: **92% mutation score** (12 of 13 mutants killed)

**Result:**

| Mutants | Killed | Survived | Score |
|---|---|---|---|
| 13 | 12 | 1 | **92.31%** |

**Surviving mutant:** `ArrayDeclaration` — Stryker replaces `?? []` with `?? ["Stryker was here"]` in the fallback path. No real test can kill this without asserting against an artificial string value. Documented as an acknowledged Stryker limitation on `includes()`-based logic — not a gap in business logic coverage.

**Commands (run from SUT root):**
```bash
npm run test:unit      # jest — 14 tests, ~0.2s
npm run test:mutation  # stryker run — mutation report in reports/mutation/mutation.html
```

**Interview angle:** *"I extracted the state machine logic into a pure function to make it testable in isolation — that's a testability decision, not a developer refactor. When the same validation is buried inside four different SQL transactions, you can't test it without a live database. The pure function lets Stryker mutate it and prove that the tests actually catch broken transition logic, not just that the API returns the right status code."*

**Why this matters for QA:** Stryker complements the buggy branch demo. The buggy branch proves tests catch intentional defects. Mutation testing proves tests would catch *unintentional* mutations — a quantified, automated signal that the test suite has real detection power.

### 14.4 Performance baseline (k6)

**Status: ✅ shipped (2026-05-01)**

File: **`k6/booking-flow.js`**  
Tool: **[k6](https://k6.io/)** — JavaScript-based load testing; runs natively in the terminal, no JVM required.

**Scenario:** patient booking flow under concurrent load — list doctors → get slots → attempt booking.

**Script structure:**
- `setup()` authenticates once and shares the JWT across all VUs — avoids hammering the login rate limiter (default: 10 / 15 min).
- Default function: 3 HTTP steps per iteration with realistic `sleep()` pauses between them.
- `409 SLOT_TAKEN` marked as expected via `responseCallback: http.expectedStatuses(201, 409)` — booking contention is a valid business outcome under load, not an error.

**Load profile:** 50 VUs, ramp 10s → hold 30s → ramp down 10s (total ~50s).

**Thresholds (fail the run if breached):**

| Metric | Threshold | Reasoning |
|---|---|---|
| `http_req_duration p(95)` | `< 200ms` | All requests: user-perceived latency budget |
| `http_req_failed` | `< 1%` | Unexpected 4xx/5xx; 409 excluded via `responseCallback` |
| `t_doctors p(95)` | `< 100ms` | Read-only endpoint, should be fast |
| `t_slots p(95)` | `< 100ms` | Read-only endpoint, should be fast |
| `t_booking p(95)` | `< 500ms` | Write + DB transaction; more headroom |

**How to run:**

```bash
# 1. Restart SUT with rate limiters raised (default booking limit is 20/min — too low for 50 VUs):
RATE_LIMIT_BOOKING_MAX=100000 node server.js

# 2. Run the load test from the tests repo root:
k6 run k6/booking-flow.js

# 3. Override base URL if needed:
k6 run --env BASE_URL=http://localhost:3000 k6/booking-flow.js
```

**CI gate — added 2026-05-12:**

**Before:** k6 ran locally only. Status: "I have a load test script." Thresholds existed in the script but nothing enforced them automatically.

**After:** `performance.yml` workflow (manual trigger via Actions tab). Starts SUT via docker-compose with `RATE_LIMIT_BOOKING_MAX=100000` override (inline compose override written in the workflow step — no new file committed). Runs `k6/booking-flow.js`. k6 exits non-zero if any threshold is breached → CI job fails automatically. Results saved as `k6-results.json` artifact.

**Why separate workflow, not a job in `api-tests.yml`:** Load tests take ~50s and produce contention/noise in the DB. Running them on every push would slow the main feedback loop and interfere with parallel API/E2E jobs sharing the same SUT. Manual trigger = deliberate execution before releases or after perf-sensitive changes.

**Why the rate limit override matters:** At 50 VUs, the default `RATE_LIMIT_BOOKING_MAX=1000/min` would be exhausted after ~1000 booking attempts. The override raises it to 100,000 so rate-limiter 429s don't pollute the latency metrics or inflate `http_req_failed`.

**Interview line:** *"I separate the rate limiter from the performance test — rate limits protect production, not benchmark runs. I authenticate once in `setup()` so the JWT is shared across all 50 VUs, same as a real user who logs in once and stays logged in. `409` under load is correct business behavior, so I exclude it from the error rate. The CI gate is a separate manual workflow — running 50 VUs on every push would slow the feedback loop and create DB contention with parallel jobs."*

### 14.5 AI testing strategy — RAG (`@ai`, `@rag`)

The recommendation endpoint uses **RAG (Retrieval-Augmented Generation)**:

1. **Knowledge base** — `src/data/specialtyKnowledge.json`: specialty → symptom descriptions
2. **Retrieval layer** — `src/services/retrieval.js`: keyword overlap scoring; returns top-K specialties for given symptoms
3. **Generation** — Claude API called with retrieved context injected into prompt; constrained to respond with `{ "specialty": "<from list>", "reasoning": "<one sentence>" }`

**Why RAG over vanilla LLM call:** Without retrieval, Claude can hallucinate specialties not in our system. With retrieval, the prompt contains only specialties we actually have doctors for — the model is grounded to our context.

**How retrieval scoring works (`retrieval.js`):**

1. Patient symptoms are split into words: `"chest pain"` → `["chest", "pain"]`
2. Each knowledge-base entry is scored by how many of its keywords match any symptom word — match is bidirectional: a word matches a keyword if either contains the other (`w.includes(kw) || kw.includes(w)`)
3. Entries with score > 0 are sorted descending; top-K returned
4. Top-1 result is used as the recommended specialty in mock mode

Example: `"chest pain and palpitations"` → Cardiologist scores 3 (matches `chest`, `pain` via `back pain` partial, `palpitation`), all others score 0–1.

**Test cases — no API key needed:**

| Case | How |
|---|---|
| Feature flag `false` → `503 FEATURE_DISABLED` | `@ai` — already works |
| `400` on empty symptoms | `@ai` — already works |
| `429` rate limit | `@ai` — already works |
| Full route with mock response (`AI_MOCK_RESPONSE=true`) | `@ai` — SUT returns deterministic JSON, no API call |

**Unit tests — no SUT, no API key (`@unit`, `tests/unit/ai.retrieval.test.ts`):**

| Case | What it verifies |
|---|---|
| `retrieve("chest pain...")` → Cardiologist ranked first | Retrieval scoring correct for cardiac symptoms |
| `retrieve("skin rash...")` → Dermatologist ranked first | Retrieval scoring correct for skin symptoms |
| `retrieve("xyzzy gibberish")` → empty result | Unknown symptoms produce no match |
| `buildPrompt(symptoms, retrieved)` contains retrieved specialty + description | Retrieved context actually reaches the Claude prompt |

**Test cases — `ANTHROPIC_API_KEY` required (tagged `@rag`, skip guard):**

| Case | What it verifies |
|---|---|
| `200` response always has `{ specialty, reasoning }` | Schema contract — non-determinism handled |
| `specialty` is always one of our knowledge-base entries | Context grounding — model doesn't hallucinate |
| LLM judge: `reasoning` is semantically valid for the specialty | Second Claude evaluates if reasoning logically justifies the recommendation |
| RAG completeness: retrieved specialty names appear in `reasoning` | Calls `retrieve()` locally, counts how many retrieved specialties are mentioned in response; asserts recommended specialty present + coverage ≥ 50% |
| Prompt injection in symptoms (`"Ignore instructions..."`) → no system compromise | AI security boundary |
| Wrong API key / Claude unreachable → `503` graceful error | Degradation path |
| Claude returns malformed JSON → `422 UNKNOWN_SPECIALTY` | Parse failure handled |
| E2E: patient types symptoms → reasoning appears in UI | Full user journey `@e2e @rag` |
| **Bias: same condition rephrased differently → consistent specialty ≥3/4** | Rephrasing invariance — model doesn't depend on exact wording |
| **Bias: demographic context (age/gender) doesn't shift specialty ≥3/4** | Demographic neutrality — irrelevant context doesn't alter core recommendation (adult demographics only) |
| **Bias: child demographic appropriately shifts recommendation to Pediatrician ≥3/4** | Clinically relevant demographic — child/infant/toddler context should shift to Pediatrician; tests the boundary between neutral and meaningful demographic signals |

**Env vars:**
```
ENABLE_AI_RECOMMENDATION=true
ANTHROPIC_API_KEY=<key>
AI_MOCK_RESPONSE=true   # skip real API call, return deterministic mock (for CI)
```

**Run locally:**

```bash
# Mock mode (no API cost)
AI_MOCK_RESPONSE=true node src/server.js
AI_MOCK_RESPONSE=true npx playwright test tests/api/ai.recommend.test.ts

# Real Claude
ANTHROPIC_API_KEY=<key> node src/server.js
ANTHROPIC_API_KEY=<key> npx playwright test tests/api/ai.recommend.test.ts
```

All AI tests skip automatically if neither `AI_MOCK_RESPONSE=true` nor `ANTHROPIC_API_KEY` is set.

**Interview line:** *"I upgraded the recommendation endpoint to RAG and wrote tests covering nine patterns: schema validation and invariant assertions for non-determinism, an LLM eval golden dataset, an LLM-as-a-judge test where a second Claude evaluates whether the reasoning logically justifies the recommendation, RAG completeness metrics that measure how many retrieved specialties appear in the model's reasoning, prompt injection resilience, graceful degradation, and three bias validation tests — rephrasing invariance, demographic neutrality for adult patients, and a third test that verifies child demographic correctly shifts the recommendation to Pediatrician. That third test came from recognising that 'demographic neutrality' isn't a universal rule in a medical system — the boundary is domain-specific. I also have pure unit tests for the retrieval layer itself — retrieval scoring and prompt construction tested in isolation, no HTTP, no API key. RAG tests skip automatically without `ANTHROPIC_API_KEY`."*

---

## 15. Test design techniques

### 15.1 Invariant-based testing

Tests are written around **system invariants** — properties that must always be true — not just around HTTP responses. This mirrors the approach used for non-deterministic and AI systems: when the exact output can vary, assert what must always hold.

Examples in this suite:

| Invariant | What always must be true | Where asserted |
|---|---|---|
| No double-booking | `slot.isAvailable = 0` while appointment is active; second booking → `409 SLOT_TAKEN` | `appointments.booking.conflict.test.ts` + DB check |
| Cancel frees the slot atomically | After cancel, `slot.isAvailable = 1` AND `appointment.status = 'cancelled'` in the same transaction | `appointments.cancel.patient.test.ts` (DB check) |
| Waitlist promotion is exactly-once | Under concurrent cancels, one waitlist patient promoted exactly once — never zero, never twice | `appointments.concurrency.test.ts` |
| State machine never accepts illegal transitions | No `(from, to)` combination outside the allowed set ever returns `200` | `appointments.invalid-transition.test.ts` |
| Auth guard always active | Any protected route without a valid token → `401`; with wrong role → `403` | `appointments.rbac.*.test.js`, `security.test.ts` |

**Interview line:** *"I write tests around invariants, not just happy paths. A double-booking test isn't interesting because it returns 409 — it's interesting because it proves the system never sells one slot twice, regardless of how many concurrent requests arrive."*

### 15.2 Boundary value analysis

Boundaries are tested explicitly, not assumed. Current examples:

| Boundary | Test |
|---|---|
| Empty symptoms string → `400 VALIDATION_ERROR` | `ai.recommend.test.ts` |
| Unknown specialty (unmappable symptoms) → `422 UNKNOWN_SPECIALTY` | `ai.recommend.test.ts` |
| `doctorRecordId` that doesn't exist → `404 DOCTOR_NOT_FOUND` | `auth.register.test.ts` |
| Duplicate waitlist join → `409 WAITLIST_DUPLICATE` | `appointments.waitlist.test.ts` |
| Invalid state transition (cancelled → confirmed) → `422 INVALID_TRANSITION` | `appointments.invalid-transition.test.ts` |


### 15.3 Property-based testing ✅

**What:** Instead of enumerating specific test cases, generate all possible inputs automatically and assert that a property holds for every one.

**Target:** `src/utils/appointmentStateMachine.js` — the `isValidTransition(from, to)` function.

**Tool:** `fast-check` (installed in SUT — `src/utils/__tests__/appointmentStateMachine.test.js`)

```js
// Asserts: for every (from, to) combination drawn from all status values,
// isValidTransition() never throws and always returns a boolean
fc.assert(fc.property(
  fc.constantFrom("pending", "confirmed", "rejected", "cancelled"),
  fc.constantFrom("pending", "confirmed", "rejected", "cancelled"),
  (from, to) => typeof isValidTransition(from, to) === "boolean"
));
```

**Why:** Our `invalid-transition` tests cover specific pairs we thought to write. Property-based testing covers all 16 combinations and any future status values automatically.

**Interview line:** *"I used property-based testing on the state machine. Instead of enumerating which transitions I expected to be invalid, I generated all possible pairs and asserted the function never throws and always returns a boolean. It caught an edge case I hadn't thought to test manually."*

### 15.4 AI-assisted test generation ✅

A documented artifact showing Claude used as a QA tool — not a replacement for judgement, but an accelerator. Full write-up: [`docs/AI_TEST_GENERATION.md`](AI_TEST_GENERATION.md).

Process: `CONTRACT_PACK.md` was fed to Claude with a prompt asking for test cases across happy path, RBAC, state transitions, and error cases. Output was reviewed critically — ~70% of suggestions accepted, the rest collapsed, discarded, or replaced with manually identified cases Claude missed.

Key finding: Claude covered the obvious contract surface but missed the IDOR on `GET /appointments/:id`, the `EMAIL_RETIRED` second-409 edge case, and the symmetric doctor-side isolation test. These were caught through manual contract review.

**Why this matters for portfolio:** Shows you control AI as a precision tool rather than accepting its output uncritically. The artifact documents exactly what was kept, what was changed, and what was missing from the AI output — a rare combination in QA portfolios.

### 15.5 AI-assisted bug reporting (added 2026-05-09) ✅

**Before:** test failures produced a Playwright error message. A developer reading the report had to mentally reconstruct the bug context from the assertion text and stack trace.

**After:** on every test failure, `utils/aiBugReporter.ts` sends the test name, file, duration, error message, and stack trace to Claude Haiku. Claude returns a structured markdown bug report: title, component, severity, steps to reproduce, actual vs expected, possible cause. The report is:
1. Attached to the Allure test result card via `testInfo.attach()` — visible as a "Bug Report" attachment inline with the test
2. Saved to `bug-reports/<sanitized-test-name>_<timestamp>.md` for archiving

**Skip guard:** if `ANTHROPIC_API_KEY` is not set, the function is a silent no-op. Tests run normally. No API key = no reports, no failure.

**Integration point:** `afterEach` hook in `fixtures/userFixture.ts`. All tests that extend the base fixture get the reporter automatically — no per-test wiring.

**Why `afterEach` in fixture, not a custom Playwright reporter:** a custom reporter class cannot inject into individual Allure test result cards. `testInfo.attach()` called inside `afterEach` is intercepted by `allure-playwright` and added to the correct test's result. This is the native integration path.

**Demo:**
```bash
DEMO_BUG_REPORTER=true ANTHROPIC_API_KEY=<key> npx playwright test bug-reporter.demo
```
Two intentionally failing tests each produce an AI-generated bug report attached to their Allure card.

**Interview line:** *"I added an AI bug reporter that fires on every test failure. It sends the test name, error, and stack to Claude Haiku and gets back a structured bug report — component, severity, steps to reproduce, actual vs expected. The report attaches to the Allure result card and saves to a file. This is AI supporting the QA process, not AI generating tests. It reduces the friction between 'test failed' and 'bug report ready to share'."*

---

**What it does NOT do:**
- It does not run the test again or read source code.
- It does not replace human judgement on severity.
- The AI output is a draft — the tester reviews before sharing.

### 15.6 AI-assisted gap analysis (added 2026-05-09) ✅

**What:** A one-shot script that sends the live OpenAPI spec + all test names to Claude Haiku and receives a structured gap analysis: endpoints with zero test coverage, documented error codes never exercised, additional scenarios implied by the spec.

**Before:** coverage gaps were found ad-hoc — during code review, Pact verification, or when a bug slipped through. No systematic view of "what does the spec say is possible, vs what do tests actually exercise."

**After:** `scripts/ai-gap-analysis.js` extracts the `paths:` block from `openapi.yaml` and all `describe()`/`test()` names from every test file, sends both to Claude, and saves the result to `docs/AI_GAP_ANALYSIS.md`. Run before each release cycle.

```bash
ANTHROPIC_API_KEY=<key> npm run ai:gap-analysis
```

**What the output contains:**
- Endpoints with no dedicated test (found 10 on first run, including the entire `/reschedule` endpoint and all slot management routes)
- Error codes in spec but never triggered in tests (~45 on first run, prioritised High/Medium/Low)
- Additional scenarios worth adding (validation boundaries, RBAC edge cases, state machine completeness)
- What is already well covered (balanced — not just a list of gaps)

**Why this is distinct from `contract.drift.test.ts`:** the drift guard checks that documented paths exist in the spec. The gap analysis checks that test cases exist for documented paths. Different direction, different question.

**Interview line:** *"I have a script that feeds the OpenAPI spec and all test names to Claude and gets back a gap analysis — endpoints with zero coverage, error codes never triggered, additional scenarios. It found 10 endpoints with no dedicated tests and ~45 undocumented error code paths on first run. It's not a replacement for a risk-based test strategy, but it's a fast way to catch blind spots before a release."*

### 15.13 Model drift detection (added 2026-05-18) ✅

**What:** A weekly scheduled CI job that re-runs the `@rag` golden dataset against the real Claude API and archives dated results. Detects if a Claude model update changed the AI recommendation behaviour.

**Why it matters:** The SUT uses Claude Haiku for AI recommendations. Model providers update models without notice — a new version may produce different outputs for the same inputs. The golden dataset is a regression test for the AI layer. Without a scheduled re-run, drift goes undetected until a user reports wrong recommendations.

**Golden dataset (in `ai.recommend.test.ts`):**

| Symptoms | Expected specialty |
|---|---|
| chest pain and shortness of breath | Cardiologist |
| skin rash and itching all over body | Dermatologist |
| severe migraine and light sensitivity | Neurologist |
| knee pain after running | Orthopedist |
| my child has high fever and cough | Pediatrician |

Threshold: ≥ 4/5 correct. If the model consistently gets fewer right, the weekly job fails.

**Schedule:** every Monday at 09:00 UTC (`cron: "0 9 * * 1"`). Also has `workflow_dispatch` for on-demand checks.

**Artifact:** `rag-drift-<run_id>/results-YYYY-MM-DD.json` + `summary-YYYY-MM-DD.md`. Retained 90 days. Comparing weekly artifacts shows when drift started — e.g. "results changed between 2026-06-09 and 2026-06-16, that week Anthropic updated haiku".

**No ANTHROPIC_API_KEY:** job prints a clear skip message and exits 0 — never fails because a secret isn't set.

**Relationship to regular @rag tests:** `api-tests.yml` runs with `AI_MOCK_RESPONSE=true` — no real Claude calls, fast, deterministic. Drift detection is the only place real Claude calls run on a schedule.

**Interview line:** *"AI recommendations are non-deterministic, and model providers update models without notice. I have a weekly job that re-runs the golden dataset against the real API and saves dated results. If Anthropic updates Claude Haiku and the Cardiologist/Neurologist distinction shifts, the next Monday run fails and I have dated artifacts showing exactly when the drift started."*

---

### 15.11 AI-generated CI run summary (added 2026-05-18) ✅

**What:** A post-CI script that reads the Playwright JSON report, sends failure data to Claude Haiku, and saves a human-readable markdown summary as a CI artifact.

**Before:** CI run result = GitHub Actions job status (green/red) + raw Playwright HTML report. Identifying failure patterns required opening the report and reading individual test titles. No aggregated view of what failed and why.

**After:** `scripts/ai-ci-summary.js` runs after every API and E2E job (even on failure). It reads `test-results.json`, extracts stats and failure titles + first-line errors, and sends them to Claude. Output: `ci-summary/summary.md` with three sections:

```
## Status
## Failures   ← grouped by pattern, not just listed
## Recommendation   ← what to investigate first, safe to merge?
```

**Skip guard:** if `ANTHROPIC_API_KEY` is absent or balance is zero, the script writes a plain stats summary instead and exits 0 — CI never fails because of this step.

**CI integration:**
```yaml
- name: Generate AI CI summary
  if: always()
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: node scripts/ai-ci-summary.js

- name: Upload CI summary
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: ci-summary-api
    path: ci-summary/
```

**Requires:** `["json", { outputFile: "test-results.json" }]` reporter in `playwright.config.ts` CI config — added alongside the existing `html` and `allure-playwright` reporters.

**Local usage:**
```bash
CI=true npx playwright test tests/api   # generates test-results.json
npm run ci:summary                       # writes ci-summary/summary.md
```

**Why this matters:** Transforms "42 tests failed" into "3 auth tests failing — likely SUT startup issue; 1 pagination test with off-by-one — isolated". Different output for all-green runs vs. failure patterns. The grouping is the AI's contribution — a plain stats summary can be generated without a key.

**Interview line:** *"After every CI run, a script reads the Playwright JSON report and asks Claude to group the failures by pattern and give a recommendation — is this safe to merge, or is there a systemic issue? It runs even when tests fail, costs nothing when the key is missing, and produces a one-page summary instead of 'open the HTML report and read 40 test titles'."*

---

### 15.12 Impact Analysis — AI-targeted test selection (added 2026-05-18) ✅

**What:** On every PR, Claude reads the list of changed files and selects the minimum relevant subset of test files to run. Results post as a PR comment with an AI-generated summary.

**Before:** every PR triggered the full test suite (55+ files, ~3–5 min). No connection between "what changed" and "what to test" — always run everything.

**After:** `scripts/impact-analysis.js` + `.github/workflows/impact-analysis.yml`:

1. `git diff --name-only origin/$BASE...HEAD` → `changed-files.txt`
2. Claude Haiku receives: changed files + full test file list + project structure rules
3. Claude returns a JSON array of test paths → `impact-tests.txt`
4. Only those tests run in the `impact` job
5. `ai-ci-summary.js` generates `ci-summary/summary.md` from results
6. A PR comment is posted with: selected tests list + AI summary

**Fallback:** no `ANTHROPIC_API_KEY` → `impact-tests.txt` = all test files (safe, runs everything). Claude response with non-existent paths is validated against the real file list before running.

**Relationship to full suite:** impact analysis runs in parallel with `api-tests.yml` (full suite). Not a replacement — a fast early signal. If impact analysis passes, the developer gets targeted feedback in seconds; the full gate continues in the background.

**Docs-only changes:** if only `*.md` / `scripts/` / `docs/` changed, Claude returns `[]` → no tests run → comment says "no impacted test files".

**Interview line:** *"On every PR, a script gets the diff and sends it to Claude: 'here are the changed files, here are all the test files, pick the relevant ones.' Claude returns a subset — usually 3–8 files instead of 55. Those run immediately and post back to the PR as a comment with an AI summary. The full suite still runs in parallel as the merge gate. This is AI reducing feedback time from 5 minutes to under 1."*

---

### 15.14 AI service extraction — microservice split + Pact redesign (added 2026-05-18) ✅

**What:** Extracted the AI recommendation logic from the SUT monolith into a standalone Express microservice (`sut/ai-service/`). The SUT now proxies POST `/api/v1/ai/recommend-doctor` → ai-service POST `/recommend`. Added a second Pact contract layer to verify the new service boundary.

**Before (monolith):**
```
tests → POST /api/v1/ai/recommend-doctor → SUT → (inline Claude call) → doctors DB → response
```
- SUT contained retrieval logic, Claude API call, specialty validation, and doctor lookup.
- Pact had one contract: consumer="clinic-booking-api-tests" ↔ provider="clinic-booking-api" (tests→SUT).
- Both sides of the Pact lived in the same repo — not a real inter-service boundary.

**After (microservice):**
```
tests → POST /api/v1/ai/recommend-doctor → SUT → POST /recommend → ai-service → Claude
                                              ↓ getBySpecialty() ↓
                                             doctors DB
```
- `sut/ai-service/`: standalone Node.js service on port 3001. Handles retrieval, Claude call, specialty validation. Returns `{ ok, specialty, reasoning }` — stateless, no DB access.
- `sut/src/routes/aiRoutes.js`: now a proxy. Validates input, calls ai-service, enriches with `doctorsRepository.getBySpecialty(body.specialty)`, returns final response.
- Two new error codes: `AI_SERVICE_UNAVAILABLE` (network timeout to ai-service) and `CLAUDE_UNAVAILABLE` (ai-service reports Claude API down).

**Two Pact contract layers:**

| Contract | Consumer | Provider | File |
|---|---|---|---|
| Old (tests→SUT) | clinic-booking-api-tests | clinic-booking-api | `ai.recommend.pact.consumer.test.ts` |
| New (SUT→ai-service) | clinic-booking-api | ai-service | `ai.service.pact.consumer.test.ts` |

The new consumer test documents exactly what the SUT sends to ai-service and what shape it expects back. The provider test verifies the real ai-service satisfies it.

**AI_SERVICE_DEGRADE test:** SUT started with `AI_SERVICE_DEGRADE=true` points to port 9999 (guaranteed unreachable). Test verifies `503 AI_SERVICE_UNAVAILABLE` — degradation path for total ai-service loss.

**Docker Compose:**
- `docker-compose.yml`: `ai-service` service with healthcheck; `api` depends on `ai-service`; `ANTHROPIC_API_KEY` passed via env.
- `docker-compose.test.yml`: `ai-service` with `AI_MOCK_RESPONSE=true`; `sut` sets `AI_SERVICE_URL=http://ai-service:3001`.

**Why this matters:**
1. Real service boundary → Pact is now a genuine inter-service contract (not same-repo theatre).
2. Stateless ai-service → can be scaled independently, replaced, versioned.
3. Two failure modes tested separately: ai-service unreachable (network) vs. Claude API down (upstream). Different error codes, different alerting strategies.

**Interview line:** *"I extracted the AI logic into a separate microservice and redesigned the Pact contracts to reflect the real boundary. Before, we had one Pact between the test suite and the monolith — same repo, same team, not a real contract. After extraction, there's a new SUT→ai-service Pact that lives on a genuine service boundary. I also added two separate degradation error codes: AI_SERVICE_UNAVAILABLE when the microservice is unreachable, and CLAUDE_UNAVAILABLE when the microservice itself can't reach Claude. Different errors, different alerting, different on-call response."*

---

### 15.7 Observability-driven testing ✅

**What:** Instead of only asserting the HTTP response, assert that the system correctly emitted a structured log event to the internal observability infrastructure (Loki). This tests a different layer — not "did the API return 201" but "did the system correctly record that the booking happened, with the right identifiers."

**Tool:** Loki query API (`/loki/api/v1/query_range`) queried directly from tests. Stack: Loki + Promtail + Grafana via `docker-compose.observability.yml` in the SUT repo.

**Implemented in:** `tests/api/observability.loki.test.ts` (`@observability`, skip guard: `LOKI_ENABLED=true`)

```js
// After booking, poll Loki until the log entry appears (up to 15s)
const entry = await waitForLokiLog({ requestId, timeout: 15000 });
expect(entry).toMatchObject({
  event: "appointment.booked",
  patientId: String(user.id),
  appointmentId: String(appointmentId),
});
```

**Why this is a distinct technique:**
- HTTP response tests verify the contract surface.
- Observability tests verify the internal event model — the part that drives alerting, audit, and incident response.
- A system can return `201` and still silently fail to log. These two layers fail independently.

**Interview line:** *"I have a test that books an appointment and then queries Loki to assert the structured log entry appeared with the correct requestId, patientId, and event type. It tests a layer that HTTP assertions can't reach — the internal observability model. The two layers fail independently, so you need both."*

### 15.10 AI-generated content stress testing (added 2026-05-18) ✅

**What:** A hybrid approach to content stress testing: static edge cases always run in CI; a separate `@ai-data` test calls Claude Haiku at test time to generate additional cases a human might not anticipate.

**Before:** Registration tests only covered `test_<timestamp>@example.com` — ASCII email, generic name. No coverage of international scripts, special characters, or long inputs.

**After:** `tests/api/content.stress.test.ts` — 11 tests across two describe blocks.

**Static block (always runs, no API key required):**
Covers known content edge cases and boundary conditions:

| Test | Edge case |
|---|---|
| O'Brien | apostrophe in name |
| Zöe Müller | diacritics / umlauts |
| 李明 | CJK unicode script |
| Mary-Jane Watson | hyphen in name |
| José García | accented Latin characters |
| 82-char email | long but valid email (limit: 254) |
| John-François O'Neill | hyphen + apostrophe + diacritic combined |
| 119-char name | boundary — just under 120-char limit |
| 121-char name | over limit → `400 VALIDATION_ERROR` |
| 256-char email | over limit → `400 VALIDATION_ERROR` |

Each success case registers the user, then asserts that `GET /auth/me` returns the exact name (no truncation, no corruption) before cleanup.

**AI-generated block (`@ai-data`, skipped without key):**
`generateEdgeCaseUsers()` in `utils/aiTestDataGenerator.ts` calls Claude Haiku with a prompt asking for 8 diverse edge-case names covering scripts and combinations the static list might miss. On any API error or missing key, returns the static fallback list — test remains green.

**Why this matters:** Shows AI augmenting test data design, not replacing it. The static tests cover known categories; Claude is asked to think of cases beyond the obvious list. The graceful degradation pattern (`try/catch → static fallback`) means the suite stays green in CI without a key, while a richer set of cases runs when one is available.

**Interview line:** *"I have a content stress test suite with two layers. Static tests cover known categories — apostrophes, diacritics, unicode scripts, boundary lengths. A separate `@ai-data` test calls Claude to generate additional cases I might not have thought of. If there's no API key or no balance, it falls back to the static list silently — CI always stays green. Every success case checks not just the 201, but that `GET /auth/me` returns the exact name — so a storage or encoding bug would surface here."*

---

### 15.6 Contract drift guard ✅

**What:** Two-layer guard against interface drift. Layer 1 fetches the live OpenAPI spec (`/api/openapi.yaml`) and asserts that all expected paths, error codes, and schema names are documented. Layer 2 calls key endpoints directly and validates that actual response bodies match the defined JSON schemas — catching cases where a refactor silently changes the response shape without updating the spec.

**Implemented in:** `tests/api/contract.drift.test.ts` (9 tests, `@api`, no skip guard)

What it catches:
- Endpoint added to SUT, missing from spec
- Error code renamed in one place but not the other
- Spec file broken or unreachable
- Swagger UI down
- Response shape changed by AI refactoring (field renamed, type changed, required field dropped) — caught by live shape assertions before downstream tests fail with misleading symptoms

**Layer 2 — live shape assertions (added 2026-06-07):**
| Endpoint | Schema |
|----------|--------|
| `POST /api/v1/auth/login` | `TokenResponse` — token, refreshToken, user object |
| `GET /api/v1/doctors` | `DoctorsList` — array of id, name, specialty |
| `POST /api/v1/appointments` | `Appointment` — id, slotId, patientId, status, createdAt |
| `GET /api/v1/appointments/my` | `AppointmentList` — array of appointment objects |

**Why:** AI-assisted refactoring can silently rename fields or change response structure. Without layer 2, the first signal is a failing downstream test with a symptom that points to the wrong place. Layer 2 fails at the source.

**Interview line:** *"The drift guard has two layers. The first fetches the live OpenAPI spec and asserts every path, error code, and schema name is documented — catches spec/code divergence. The second actually calls the key endpoints and validates response shapes against defined schemas — catches AI refactoring that silently renames a field. Without the second layer, you see the symptom in a downstream test, not at the source."*

---

### 15.8 API fuzzing — Schemathesis (added 2026-05-12) ✅

**What:** CLI tool that reads the live OpenAPI spec and auto-generates test cases — boundary values, special characters, null, wrong types, malformed headers. No test code written; the spec is the test definition.

**Before:** API contract was validated by manually written tests. Gaps existed wherever a developer hadn't thought to test a specific input combination.

**After:** `schemathesis run http://localhost:3000/api/openapi.yaml --checks all` generates 400+ scenarios from 35 operations and finds cases the manual test suite never covered.

**Run locally:**
```bash
pip install schemathesis
schemathesis run http://localhost:3000/api/openapi.yaml --checks all
# With auth token:
schemathesis run http://localhost:3000/api/openapi.yaml --checks all \
  --header "Authorization: Bearer <token>"
```

**What it found on first run (2026-05-12):**
- **Malformed JWT → `400 <EMPTY>`** — error contract violation. When Authorization header contains invalid-format bytes, middleware returns 400 with no body. All existing security tests only test missing or unauthorized tokens — never a malformed one.
- **TRACE → 404 not 405** — HTTP compliance gap, systemic across all 35 endpoints.
- **`401` undocumented in spec** for several auth-required endpoints.

Full findings: `SYSTEM_WEAKNESS_REPORT.md` §5.

**Why this matters:** The malformed JWT bug exists in the middleware layer, before the route handler runs. It can only be found by sending garbage that no developer would think to test manually. Fuzzing covers the input space that manual test design misses.

**Interview line:** *"I added Schemathesis — it reads the OpenAPI spec and generates test cases automatically. On first run it found a bug my 80+ manual tests missed: a malformed Authorization header causes the middleware to return 400 with an empty body, breaking the error contract that every error response must contain errorCode, message, and requestId. The bug lives in the middleware layer, before the route handler even runs. No developer thinks to test that input — but a fuzzer always will."*

---

### 15.9 OWASP ZAP security scan (added 2026-05-12) ✅

**What:** Docker-based OWASP ZAP baseline scan runs against the SUT and checks for OWASP Top 10 vulnerabilities, missing security headers, information disclosure, and known misconfigurations.

**Before:** `security.test.ts` covers known scenarios (IDOR, BOLA, JWT tamper). Known attack patterns, written by a human who decides what to test.

**After:** ZAP searches independently — it doesn't know the business logic or what was intentionally tested. Different class of security coverage.

**What ZAP checks (baseline scan):**
- Missing security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`)
- Information disclosure in headers or error messages
- CORS misconfigurations
- Known CVEs in server-side libraries

**CI:** `security-scan.yml` — manual trigger only (`workflow_dispatch`). Produces HTML + JSON report saved as artifact. `-I` flag: only fails on HIGH alerts, not warnings.

**Why manual trigger:** ZAP scans the full surface (not just documented endpoints). Running on every push would produce noise from expected 401s on auth-required routes and slow the feedback loop. Deliberate execution before releases.

**Interview line:** *"I have two layers of security testing. `security.test.ts` tests known scenarios — IDOR, BOLA, JWT tamper. OWASP ZAP searches independently — it doesn't know what I tested, so it covers gaps I didn't think of: missing security headers, CORS issues, information disclosure. Different tools answering different questions."*

---

## 16. Narrative & depth layer — backlog (agreed 2026-04-30)

These four items add the "system thinking" layer on top of the existing framework. Planned in order.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | **`docs/SYSTEM_WEAKNESS_REPORT.md`** | ✅ done | Concurrency, state gaps, security, operational risks mapped to test coverage |
| 2 | **Concurrency test suite** | ✅ done | `tests/api/concurrency/appointments.concurrency.test.ts` — double-cancel + concurrent waitlist promotion (exactly-once assert) |
| 3 | **Failure detection model** | ✅ done | Section in README: "How this suite knows the system broke" — signals table + invalid states |
| 4 | **Portfolio narrative** | ✅ done | `docs/PORTFOLIO_NARRATIVE.md` — 2-min story, what to show, 7 interview Q&As |
| 5 | **Test orthogonality map** | ✅ done | §17 — every test file mapped to its unique risk dimension |
| 6 | **Risk-based CI prioritization rationale** | ✅ done | §13 — local-only suites table with cost rationale and unblocking conditions |

---

## 17. Test orthogonality map

Each test file covers a **unique risk dimension**. No two files test the same thing. This table is the systems-thinking view of the suite — coverage is designed, not accidental.

### API layer

| File | Unique risk dimension |
|---|---|
| `auth.login.test.ts` | Authentication correctness — valid credentials accepted, invalid rejected, token structure valid |
| `auth.register.test.ts` | Registration boundary — duplicate email rejected, weak password rejected, `doctorRecordId` existence enforced |
| `content.stress.test.ts` | Content stress — international scripts (CJK, Arabic, Cyrillic, diacritics), special chars (apostrophe, hyphen), long inputs, boundary rejection; AI-generated additional cases via `@ai-data` tag |
| `appointments.mini.j1.test.ts` | **J1 journey** — booking happy path + slot lock invariant (slot unavailable after booking) |
| `appointments.reject.j2.test.ts` | **J2 journey** — reject flow + slot release (slot available again after rejection) |
| `appointments.confirm.j3.test.ts` | **J3 journey** — confirm flow + post-confirm slot and diary invariants |
| `appointments.cancel.patient.test.ts` | Patient cancellation + waitlist auto-promotion trigger |
| `appointments.booking.conflict.test.ts` | Double-booking prevention — same slot cannot be booked twice |
| `appointments.invalid-transition.test.ts` | State machine guard — invalid transitions (`cancelled → confirmed`, etc.) rejected with correct error |
| `appointments.waitlist.test.ts` | Waitlist boundary conditions — join, leave, duplicate join rejected |
| `appointments.waitlist.promotion.test.ts` | Auto-promotion correctness — exactly one patient promoted after cancellation |
| `appointments.waitlist.offers.test.ts` | Waitlist offer manual confirmation — accept swaps bookings, decline frees slot + patient stays on list, 409 on duplicate resolve |
| `appointments.rbac.patient.test.ts` | RBAC: patient forbidden on doctor-only actions (confirm, reject); doctor forbidden on patient-only route |
| `appointments.rbac.cross-doctor.test.ts` | RBAC: cross-doctor data isolation — doctor cannot access another doctor's appointments (IDOR) |
| `appointments.booking.rate-limit.test.ts` | Rate limiting — booking endpoint enforces per-token request window *(local only — requires env override)* |
| `appointments.reschedule.test.ts` | Reschedule correctness — pending→new slot, confirmed→resets to pending, 409 SLOT_TAKEN, 422 DOCTOR_MISMATCH/SAME_SLOT, 403 FORBIDDEN, waitlist cascade on reschedule |
| `appointments.pagination.test.ts` | Pagination contract — envelope shape `{data,total,page,limit,totalPages}`, offset correctness, invalid param rejection (page=0, limit=0, NaN) |
| `appointments.recurring.test.ts` | Recurring series — 201 all slots booked + seriesId on each, 201 partial booking, 404 SLOT_NOT_FOUND, 400 VALIDATION_ERROR, count boundaries (1/13), 401, 200 cancel series, 404 SERIES_NOT_FOUND |
| `appointments.notes.test.ts` | Appointment notes — 201 create note, 200 list notes, 401/403/400/404/422 error paths; XSS payload rejected (UNSAFE_CONTENT), IDOR protection on GET, state machine: notes only on confirmed/completed |
| `appointments.ratings.test.ts` | Doctor ratings — 201 rate completed appointment, 200 aggregate (average+count), 401/403/400/404/422/409 error paths; aggregate does not expose individual rater identities |
| `auth.delete.test.ts` | Account soft delete — 204 close account; access token revoked (401 AUTH_INVALID); refresh token revoked; login blocked; EMAIL_RETIRED on re-register; DB preserves record with deletedAt; other accounts unaffected |
| `appointments.filter.test.ts` | Appointment filtering — status/doctorId/from/to filters; exclusion boundaries for date range; combined filters; empty result set; filtered total matches data count (count query integrity); 400 validation on invalid status/doctorId/date |
| `appointments.kafka.test.ts` | Kafka event contract — booked/cancelled/confirmed/rejected/rescheduled/completed/recurring_booked/series_cancelled topics; payload field assertions; graceful degradation when broker absent; skip guard if `KAFKA_BROKER` not set |
| `doctors.schedule.test.ts` | Doctor schedule management — PUT/GET working hours, slot creation blocked outside schedule, boundary start/end times, timezone offset |
| `doctors.list.test.ts` | Doctor listing — availability data integrity, correct shape |
| `ai.recommend.test.ts` | AI feature contract — feature flag, error codes, response schema, rate limit; `reasoning` field present, specialty-invariant (never hallucinates outside `ALLOWED_SPECIALTIES`); bias validation: rephrasing invariance + demographic neutrality *(tests skip unless `AI_MOCK_RESPONSE=true` or `ANTHROPIC_API_KEY` set)* |
| `pact/ai.recommend.pact.consumer.test.ts` | Consumer-driven contract (tests→SUT) — shape of 200/400/422 responses from `/api/v1/ai/recommend-doctor` formalized as a pact; runs against Pact mock server (no SUT needed) |
| `pact/ai.recommend.pact.provider.test.ts` | Provider contract verification (SUT) — SUT satisfies all consumer interactions in `pacts/` JSON; skip guard: requires `AI_MOCK_RESPONSE=true` or `ANTHROPIC_API_KEY` |
| `pact/ai.service.pact.consumer.test.ts` | Consumer-driven contract (SUT→ai-service) — shape of 200/422/400 from `/recommend`; consumer="clinic-booking-api", provider="ai-service"; genuine service-to-service boundary |
| `pact/ai.service.pact.provider.test.ts` | Provider contract verification (ai-service) — ai-service satisfies SUT's expectations; requires ai-service on `AI_SERVICE_URL` with `AI_MOCK_RESPONSE=true` |
| `contract.drift.test.ts` | Two-layer drift guard — (1) OpenAPI spec: paths/error codes/schemas documented, Swagger UI reachable; (2) live shape assertions: 4 key endpoints validated against JSON schemas to catch AI-refactoring-induced field drift |
| `security.test.ts` | Security boundary — IDOR on appointment access, JWT tampering rejected |
| `infrastructure.test.ts` | Infrastructure contract — health endpoint, error response format consistency |
| `chaos.test.ts` | Fault tolerance — 503 contract under chaos mode, health endpoint exempt, latency injection *(manual workflow)* |
| `concurrency/appointments.concurrency.test.ts` | Race conditions — double-cancel exactly once, concurrent waitlist promotion produces exactly one booking |
| `notifications.webhook.test.ts` | Webhook delivery contract — payload shape, fire-and-forget (webhook failure doesn't affect transaction) |
| `notifications.ws.test.ts` | WebSocket notification — JWT auth on connect, event delivery after booking/cancellation |
| `consultations.payment.test.ts` | Payment flow — idempotency key, 402 on failure, no consultation created on payment failure |
| `observability.loki.test.ts` | Internal observability — structured log emitted to Loki with correct `requestId`, `event`, `patientId` *(local only — requires Loki stack)* |

### Unit layer

| File | Unique risk dimension |
|---|---|
| `unit/ai.retrieval.test.ts` | RAG retrieval correctness — scoring returns right specialty for known symptoms, unknown symptoms produce empty result; prompt builder includes retrieved specialty + description (context injection verified without a live SUT) |

### E2E layer

| File | Unique risk dimension |
|---|---|
| `booking.cross-layer.test.ts` | Booking flow consistency — UI action reflected in API state and DB |
| `confirm.cross-layer.test.ts` | Confirm flow cross-layer — doctor confirm visible to patient across all layers |
| `booking-conflict.e2e.test.ts` | Double-booking in real user flow — conflict error surfaced correctly in UI; DB check: exactly one active appointment for the slot |
| `doctor-confirm.e2e.test.ts` | Doctor confirmation from UI — full interaction from doctor login to confirm |
| `waitlist.cross-layer.test.ts` | Waitlist promotion visible across layers — cancellation triggers promotion visible in UI and API |
| `offers.cross-layer.test.ts` | Offer accept cross-layer — UI renders pending offer, patient accepts, booking swap reflected in API state |
| `consultations.cross-layer.test.ts` | Payment + consultation cross-layer — payment result visible in UI and consultation record created |
| `patient-notifications.e2e.test.ts` | Patient notification receipt — notification appears in UI after booking event |
| `doctor-notifications.e2e.test.ts` | Doctor real-time UI — booking/cancellation toast appears in doctor browser without page reload; also caught real SUT bug (`window.ClinicCore` undefined — WS never connected before fix) |
| `doctor.schedule.cross-layer.test.ts` | Doctor schedule cross-layer — schedule set via UI, verified via API + DB; slot creation respects working hours |
| `appointments.recurring.e2e.test.ts` | Recurring series cross-layer — book via API → both appointments visible in UI with series tag + DB seriesId confirmed; cancel series via UI → API status + DB status both cancelled |

### UI layer

| File | Unique risk dimension |
|---|---|
| `login.test.ts` | Login page behaviour — form validation, error states, successful redirect |
| `register-patient.test.ts` | Registration page — form validation, duplicate handling, successful flow |
| `visual.test.ts` | Visual regression — pixel-level baseline comparison for login (empty + error) and register pages across Chromium and mobile-chrome; catches CSS/layout regressions invisible to behavioural tests |
| `guest-gates.test.ts` | Auth guard — unauthenticated users cannot access protected pages (booking, consultations, notifications) |
| `accessibility.test.ts` | WCAG compliance — axe-core audit on login, register, booking pages |
| `api-error-states.test.ts` | Error display routing — server 500 and network abort surface to correct UI zones (booking form message vs appointment banner); `page.route()` mocking without SUT changes |
| `doctor.schedule.ui.test.ts` | Doctor schedule form — 7 day checkboxes, checkbox enables inputs, save shows toast, saved data loads on revisit, OUTSIDE_WORKING_HOURS shown when booking outside schedule |
| `reschedule.ui.test.ts` | Reschedule button visibility — shown for pending/confirmed only; reschedule flow refreshes list to pending + shows toast |
| `patient-appointments.pagination.test.ts` | Patient pagination controls — hidden when single page, page info correct, prev disabled on page 1, next requests page=2, page size resets to page=1 |
| `doctor-appointments.pagination.test.ts` | Doctor pagination controls — same coverage for doctor workspace |
| `appointments.recurring.ui.test.ts` | Recurring series UI — series tag visible when seriesId present; cancel-series button shown for pending/confirmed+seriesId only; cancel flow: confirm dialog → list reloads → toast "Series cancelled."; API error → inline notice |
| `ui-disabled-states.test.ts` | Form disabled state cascade — doctor select disabled until specialty chosen; offer accept button re-enabled after API error (not stuck in disabled state) |
| `ui-states.test.ts` | Full UI state matrix — patient empty state (no appointments), filter no-results, cancel toast; booking wizard: empty doctors list, empty slots (step 3), success flow (full walkWizard), slot pickers + time enabled; doctor empty state, doctor error banner; updated to wizard flow |
| `booking.wizard.test.ts` | Booking wizard UI — step label, Next disabled until selection, URL-skip clamp, back preserves specialty, step 3 Next gating, 409 slot-taken message + back button, progress dots; 7 tests via `page.route()` mocking |
| `booking.wizard.e2e.test.ts` | Wizard happy path E2E — full 4-step walk creates appointment; success msg visible; button hidden; API + DB cross-check |
| `booking-conflict.e2e.test.ts` | Race condition E2E — user2 walks wizard to step 4; user1 books same slot via API; user2 submit → 409 slot-taken error; DB: exactly 1 active appointment belongs to user1 |

## 18. Architecture decisions — было / стало / почему

### 18.1 Page Object instantiation → fixture injection (слой — май 2026, тесты переведены — 11 августа 2026)

**Before:** каждый тест вручную создавал page objects:
```ts
const loginPage = new LoginPage(page)
const appointmentsPage = new AppointmentsPage(page)
```
При 100+ тестах — повторяющийся boilerplate в каждом файле. При переименовании класса — правки во всех тестах.

**After:** все page objects вынесены в `fixtures/pages.ts` через `base.extend<Pages>()`:
```ts
export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  appointmentsPage: async ({ page }, use) => use(new AppointmentsPage(page)),
  // ...все 7 страниц
});
```
Тесты просто деструктурируют нужное: `{ loginPage, appointmentsPage }`. Никаких `new()` в тест-файлах.

**Хронология — разошлась с документацией, исправлено 11 августа 2026.** Слой `fixtures/pages.ts` написан в мае 2026 во время TypeScript-миграции, и этот раздел был написан тогда же. Но подключён слой не был: `fixtures/index.ts` экспортировал только `slotFixture`, и 23 из 27 UI/E2E файлов продолжали инстанцировать page objects вручную — 121 вызов `new XPage(page)`. То есть три месяца документация описывала намерение как факт.

Что сделано 11 августа 2026:
- `fixtures/pages.ts` теперь расширяет конец цепочки (`userFixture → slotFixture → twoUsersFixture`), поэтому один импорт `test` даёт и данные, и страницы; фикстуры ленивые, ничего не создаётся без деструктуризации
- `fixtures/index.ts` экспортирует `pages` + типы из `slotFixture`
- 27 файлов переписаны: 121 `new XPage(page)` убран, неиспользуемые импорты классов удалены, импорты приведены к `../../fixtures`
- проверка: `npx tsc --noEmit` без ошибок, UI 130/130, E2E 13 passed + 2 skipped по env-флагам

**Why:** POM отвечает за domain clarity (локаторы + методы), fixtures отвечают за DX (wiring). Используются вместе, не вместо.

**Interview line:** *"Moved all page object instantiation into a pages fixture using base.extend(). Specs just destructure what they need — zero new() calls in test files. POM for domain clarity, fixtures for DX."*

**Why this matters:** every file answers a question that no other file asks. Adding a new test file should cover a new risk dimension — if it doesn't, it's either a duplicate or it belongs in an existing file.

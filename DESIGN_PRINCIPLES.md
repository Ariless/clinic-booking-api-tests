# Design principles — test framework & tests

This file **fixes** the engineering habits for **clinic-booking-api-tests**. It distills what worked in earlier projects (Playwright UI + API framework, CLAUDE / README playbooks). **README.md** stays the entry point; this document is the **normative** checklist for code and structure.

Beyond “clean code” checks, these rules describe **how we design test systems** against a real SUT — closer to an internal **QA engineering charter** than a style guide alone.

**Concrete journey scenarios (golden / negative / state machine / cross-layer)** live in **`E2E_TEST_PLAN.md`** — this file stays about *how* we build; that file is about *what* we run.

---

## Test strategy (pyramid mindset)

**Risk map, smoke vs deeper API tags, J1/J2/J3 file ownership, and planned high-impact cases:** **`docs/TEST_STRATEGY.md`** + **`docs/RISK_ANALYSIS.md`** (portfolio / interview spine; keep pyramid rules here as normative).

- **`tests/api`** — **primary layer**: fast feedback, contract and state rules, RBAC, errors (`errorCode`), rate limits. Most business rules should be proven here first.
- **`tests/e2e`** — **thin, high-value layer**: a few **critical user journeys** (book → visible → cancel, doctor confirm path, …). Low volume; each flow must justify its maintenance cost. **Do not** re-run a **full** journey already proven in **`tests/api`** — see **`E2E_TEST_PLAN.md`** → *API vs e2e — avoid duplicate full J1* (e2e = short UI + **CROSS**, not a second copy of **`@api`** lifecycle).
- **`tests/ui`** — **experience layer**: real browser behaviour (forms, nav, guest gates, `data-qa` visibility). **Not** a second place to re-test every rule already covered in API.

**Rule:** **business logic is never validated only through the UI.** If a rule exists in `CONTRACT_PACK.md`, there should be an API-level check (or an explicit exception documented here / in the test file with reason).

---

## Deterministic execution

A test must be able to pass **reliably** in any supported environment: **local**, **CI**, and **parallel** workers (subject to SUT SQLite constraints — see SUT `TESTING_AGAINST_THIS_SUT.md`).

This implies:

- **No shared mutable state** between tests (no “user 42” left over from the previous file).
- **No time-dependent assertions** without controlling inputs (e.g. fixed slot ids from seed, or data created in the same test). If you assert on “now”, freeze or inject the boundary via API/SUT capabilities.
- **No ordering assumptions** — no “run `auth` before `booking`” across files; each test declares its own setup/teardown.

*(Uniqueness of emails / users complements this — see **Test data & lifecycle**.)*

---

## State ownership

The framework **never assumes** server state after an action — it **verifies** it.

Any material state change should be backed by at least one of:

- **API response** body (e.g. `201`, expected JSON shape), or  
- **Follow-up GET** (appointments list, slots, me), or  
- **Cross-layer reconciliation** after a UI step (UI did X → GET proves Y).

**The UI is not the source of truth** for “did the booking land?” — the API / contract is.

---

## Test design — one observable behaviour

Each test should prove **exactly one** primary outcome (or one tight contract rule):

**Allowed focal points:**

- one **business outcome** (“pending visit appears after book”), or  
- one **contract rule** (`409 SLOT_TAKEN` on double book), or  
- one **state transition** (`pending → confirmed` with allowed preconditions).

**Avoid:** one long test that asserts many **unrelated** behaviours (login + search + book + cancel) unless that is explicitly a **single named journey** in `tests/e2e` and failures are still easy to localise.

---

## Failure transparency

When a test fails, a reviewer (or you, six months later) should see **what was attempted**, **what was expected**, and **what was observed** — without spelunking through five layers of magic.

- Prefer **clear test titles** and **small steps** with meaningful variable names (`createdAppointmentId`, not `x`).
- **Avoid** deep abstraction stacks that hide the failing assertion; a little duplication in the spec is better than opaque helpers.
- Use Playwright **reports + traces on retry** to capture evidence; then **fix the product or the test**, not the visibility.

---

## Minimalism

Add a helper, wrapper, or directory **only** when it **removes duplication** or **sharpens clarity**. If it only “might be useful later”, **do not add it yet**.

Framework complexity should grow with **proven** pain (e.g. third copy of the same login sequence → fixture), not ahead of need.

---

## SOLID-flavoured habits

### Single Responsibility (SRP)

| Responsibility | Lives in | Must not |
| --- | --- | --- |
| Locators + actions on one screen | `pages/*Page.js` | Call raw API from Page Objects for business setup (use fixtures/clients) |
| HTTP shape + URLs + auth header | `api/*Client.js` | Assert UI text or Playwright expectations |
| Orchestration of a scenario | `tests/**/*.spec.js` | Hide 50 lines of setup — move to **fixtures** or **helpers** |
| Pure helpers (parse, random email, wait helpers) | `utils/` | Know about a specific page’s DOM |
| Constants, route fragments, shared payloads | `data/` | Contain test flow logic |

### Open for extension

- New SUT endpoint → extend or add a **client method**, not copy-paste `request.post` across specs.
- New screen → new **Page Object** extending **BasePage**; reuse shared navigation / cookie / auth bar if needed.

---

## DRY — do not repeat yourself

- **No duplicated selectors** — one locator per concept in the Page Object; tests use page methods or exposed locators only if needed for `expect`.
- **No duplicated API paths / JSON keys** — centralise in `data/` + `api/*Client.js`.
- **No duplicated user-creation flows** — use **`user`** + **`UserClient`** (`fixtures/userFixture.js`, `utils/userUtils.js`) or one factory in `utils/` + the same teardown rules.
- **No duplicated “wait for API after click”** — helper or BasePage method, not copy-paste in every test.

---

## Page Object Model (POM)

- **One page (or cohesive fragment) → one class** under `pages/`.
- **BasePage** holds: `navigate`, `dismissCookies` (no-op for clinic demo unless a banner appears), `getTitle` / `open` — same responsibilities as the legacy shop framework’s `BasePage`; **not** business assertions.
- **LoginPage** extends `BasePage`: **locators in the constructor** (`getByTestId` aligned with SUT `data-qa`), actions as methods — mirrors the older `LoginPage` style, selectors differ per SUT.
- **Tests** call page methods (`loginPage.submit()`), not chains of ten locators in the spec file.

### PageFactory — intentionally omitted

A class that only does `new LoginPage(page)` adds indirection without Playwright-specific benefit. **Instantiate** page objects in fixtures or `test.beforeEach` when the count of pages stays readable.

---

## API client layer

- **`api/*Client.js`** — wraps `request` from Playwright (or a thin fetch): base path, JSON body, `Authorization`, parsing `errorCode` / status.
- **Tests** assert outcomes and invariants; they **do not** hardcode full URLs or duplicate body shapes.
- Prefer **Playwright `request`** over extra HTTP libraries so traces and timeouts stay unified.

---

## Test data & lifecycle

- **No hardcoded credentials** in specs — `.env`, CI secrets, or factory-generated users.
- **Deterministic uniqueness** — e.g. `Date.now()` / UUID in email so parallel runs do not collide (SUT: mind SQLite + parallel; see SUT testing doc).
- **Atomic tests** — each test prepares what it needs and cleans up (API delete, or isolated user); **no order dependency** between files.
- **Hybrid setup** — **create user / slot state via API** where possible; **UI** validates what the user sees; **optional GET** after UI step to reconcile server state.

### Clinic SUT — default API isolation pattern

1. **Patient-heavy flows** — prefer fixture **`user`** (`fixtures/userFixture.js`), same shape as the legacy shop framework:
   - **`generateUser()`** in `utils/userUtils.js` — unique email each run (`Date.now()` + random suffix); password from **`TEST_USER_PASSWORD`** in `.env` (default **`password`** to match SUT seed convention).
   - **`UserClient.create` / `UserClient.delete`** — register via API; fixture passes **`token`** (and related fields) into `use` for assertions; teardown **`DELETE /api/v1/auth/me`** via `delete` (re-login for token).
   - Import **`{ test, expect }` from `fixtures/userFixture.js`** when you need `user` / `loggedInPage` (same `test`/`expect` API as Playwright when those fixtures are unused).

2. **Doctor + slots** — usually **no new doctor user**:
   - log in a **seed doctor** (`doctor@example.com`, **`doctor2@example.com`**, **`doctor3@example.com`** — see SUT **`API_ENDPOINTS.md`** *Demo seed* and **`data/seedAccounts.js`** here; password **`password`** unless you document otherwise);
   - create an **exclusive slot** per test via **`POST /api/v1/doctors/me/slots`** with a **non-overlapping time window** (avoids fighting over seed slot ids and `SLOT_TAKEN` across parallel tests).

3. **Seed-only** accounts are for **non-patient** shortcuts where agreed (e.g. **seed doctor** + own slot). **Patient** flows that hit auth or bookings should use the **`user`** fixture (create + delete), not hardcoded `patient@example.com`, so tests do not share mutable patient rows.

---

## Assertions & contracts

- **No `sleep` / fixed timeouts** — `expect`, auto-waiting locators, `waitForResponse` on specific routes when needed.
- **API responses** — assert status + body shape; validate **required** fields with AJV (see below); **tolerate extra fields** (`additionalProperties: true`) so non-breaking API additions don't break the suite.
- **Schema validation (AJV)** — shared instance in `utils/schemaValidator.js`; compiled validators in `data/schemas/` (`errorSchema`, `authSchemas`, `appointmentSchemas`, `doctorsSchemas`). Pattern: `assertSchema(body, validateXxx)` for shape, then a targeted `expect(body.field).toBe(value)` for the specific assertion that matters in that test.
- **Cross-layer** — after booking in UI, `GET /api/v1/appointments/my` (or equivalent) to assert persistence.
- **Errors** — assert SUT contract with `assertSchema(body, validateError)` (validates `errorCode`, `message`, `requestId` are present and non-empty); then `expect(body.errorCode).toBe("SPECIFIC_CODE")` for the case-specific check.

---

## Selectors & UI stability

- **Primary:** `data-qa` — matches SUT `quality-strategy.md`; Playwright `testIdAttribute: 'data-qa'`.
- **Fallback:** accessible roles / text only where `data-qa` is missing (prefer extending the SUT with a new `data-qa` over fragile XPath).

---

## Organisation & naming

- **Folders:** `tests/api`, `tests/ui`, `tests/e2e` — by intent, not by file type only.
- **Tags:** `@smoke`, `@api`, `@ui`, `@e2e` (extend: `@negative`, `@ai`, …) — run subsets with `--grep`.
- **Names** — files and `test.describe` titles read as **behaviour**, not implementation (`"rejects duplicate registration"` not `"POST register twice"`).

---

## Flakes & CI

- **Retries** — e.g. `1` in CI for **infrastructure** noise only; do not use retries to hide real bugs.
- **Artifacts** — trace on first retry, screenshot/video on failure when enabled — inspect before loosening assertions.
- **Parallel** — only when data is isolated (separate users / DB strategy per SUT doc).

---

## Reporting (when enabled)

- **HTML + traces** first; **Allure** as an optional second channel — same events, richer dashboards for portfolio.

---

## Explicit non-goals (unless SUT gains the feature)

- Do not invent **Cart API**-style helpers if the SUT has no such API.
- Do not claim **chaos/bug modes** in assertions until the SUT exposes them.
- Avoid **visual / a11y / performance** suites until there is a clear story and stable baselines.

---

## Review checklist (before PR)

- [ ] New logic has a **single home** (page vs client vs util vs fixture).
- [ ] No copy-pasted **URL / payload / selector** without a central definition.
- [ ] No **`waitForTimeout`**.
- [ ] **Tags** updated if the suite’s run matrix changes.
- [ ] **README** or this file updated if a **global convention** changes.
- [ ] Test has **one clear observable / contract focus** (see *Test design — one observable behaviour*); critical journeys in `e2e` are the **exception**, and named as such.
- [ ] Important state changes have **API or GET proof**, not UI-only inference (see *State ownership*).
- [ ] A failing run would still explain **action → expected vs actual** without reading private helpers (see *Failure transparency*).

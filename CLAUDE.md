# clinic-booking-api-tests — agent conventions

## What this is

Playwright test suite for a clinic booking API (SUT). Three layers: `tests/api` (fast contract + RBAC), `tests/e2e` (thin cross-layer journeys), `tests/ui` (browser behaviour). TypeScript migration in progress — new files go in `.ts`.

## Skills index

Skills live in `.claude/skills/`. Load the matching skill before writing code — load every skill that applies, not just one. Do not load all skills at once.

| Skill | Load when |
|-------|-----------|
| `explore-before-write` | before writing any new selector, client method, or test for an unfamiliar endpoint |
| `test-standards` | naming a test or describe block; adding tags; unsure how a test file is structured |
| `api-client` | writing or editing methods in `api/*Client.ts`; adding an endpoint |
| `fixtures` | test data setup — user accounts, slots, page objects |
| `selectors` | writing locators in page objects or UI tests; fixing a broken selector |
| `ui-test-scope` | deciding whether a test belongs in `tests/ui/`; asserting browser behaviour |
| `e2e-cross-layer` | writing a test that spans UI + API + DB |
| `typing` | new `.ts` files; fixing type errors; DB results and fixture types |
| `common-tasks` | DB assertions, schema validation, error contract, auth headers |
| `data-strategy` | choosing between seed accounts, Faker data, and fixtures |
| `enums` | endpoints, error codes, allowed values — anything that should not be a literal |
| `helpers` | shared utilities that are not fixtures — validators, DB helpers, assertion wrappers |
| `config` | environment variables, baseUrl, configuration access |
| `refactor-values` | refactoring tests without losing coverage — extract, deduplicate, rename |
| `subagent-workflow` | large multi-file tasks; parallel work; coverage gap analysis |

Skills with a `references/` folder keep long examples and troubleshooting tables there. Open a reference only when the task needs it.

## Running tests

```bash
npm test                          # all tests
npm run test:smoke                # @smoke only
npm run test:api                  # API layer
npm run test:e2e                  # E2E layer
npm run test:ui                   # UI layer
npx playwright test <file>        # single file
npx tsc --noEmit                  # type-check (run after any TS change)
```

SUT must be running: `cd ../sut && npm run dev` (port 3000).

## File layout

```
api/          HTTP clients — one per resource (AppointmentsClient, AuthClient, …)
config/       env.ts — baseUrl from process.env.BASE_URL
data/         testData.ts (endpoints), seedAccounts.ts, schemas/
fixtures/     Playwright fixtures — userFixture, slotFixture, twoUsersFixture, index
flows/        multi-step API sequences reused across tests
pages/        Page Objects — one class per screen, extends BasePage
utils/        dbClient, schemaValidator, slotAssertion, webhookTestServer, userUtils
tests/api/    API tests
tests/e2e/    E2E cross-layer tests
tests/ui/     UI browser tests
```

## Test naming

| Layer | Pattern |
|-------|---------|
| API   | `METHOD /path — STATUS description @tag` |
| UI    | `page — description @ui` |
| E2E   | `subject — cross-layer result @e2e` |

Tags: `@smoke`, `@api`, `@ui`, `@e2e`, `@webhook`, `@ws`, `@chaos`, `@payment`, `@pact`, `@rag`, `@security`, `@concurrency`, `@observability`, `@rate-limit`.

## Key conventions

**Imports** — always import from TS sources (`../../fixtures`, `../../api/AppointmentsClient`), never from node_modules paths.

**Fixtures** — use `user` fixture for patient flows (creates + deletes user automatically). Use `slot` fixture for doctor + slot. Use `twoUsersFixture` when two patients are needed.

**Page Objects** — all 7 page objects are wired via `fixtures/pages.ts` using `base.extend()`. Never instantiate page objects with `new PageClass(page)` in test files — destructure from the fixture instead. POM handles domain clarity (locators + methods), fixture handles wiring.

**BasePage** — all page objects extend `BasePage`. Shared navigation logic (navigate, common waits) belongs in `BasePage`, not in individual page objects.

**API clients** — all HTTP goes through `api/*Client.ts`. Never call `request.post` with raw URLs in test files — use a client method.

**Schema validation** — `assertSchema(body, validateXxx)` for shape, then targeted `expect(body.field).toBe(value)`. Schemas live in `data/schemas/`.

**DB assertions** — `dbClient` from `utils/dbClient.ts`. Returns `T | undefined` — use `!` after a toBeDefined/toBeTruthy check, or check existence first.

**No shared state** — each test creates and cleans up its own data. No hardcoded `patient@example.com` in tests that mutate state.

**No `waitForTimeout`** — use Playwright auto-waiting or `waitForResponse`.

**Error contract** — always `assertSchema(body, validateError)` + `expect(body.errorCode).toBe("CODE")` for error cases.

## TypeScript rules

- `strict: true`, `allowJs: true` — old JS files coexist with new TS files
- Helper functions in tests need typed parameters
- DB results are `T | undefined` — handle with `!` or guard
- Run `npx tsc --noEmit` after changes — zero errors is the bar

## UI and E2E scope

UI and E2E tests exist only to cover what API tests physically cannot.

**UI tests cover:** rendering data in the browser, UI behaviour on API errors (`page.route()`), interactivity (click → correct request → correct result on screen), visual states, accessibility.

**E2E tests cover:** cross-layer invariants — action via UI → DB or API assertion (or reverse); scenarios that need a live browser + real server together.

**Never duplicate:** do not assert status codes, errorCodes, or server business logic in a UI test — that belongs in the API layer. Do not write an E2E test if the scenario is fully covered by an API test without a browser.

Before writing a UI/E2E test ask: "can this be verified with an API test?" If yes — don't write UI/E2E. If no (browser required, DB check after UI action) — write it.

## Risk-based test evaluation

Before writing any test ask: "what does the user or business lose if this fails in production?" If the answer is not concrete — don't write the test.

**Write tests that catch:** wrong data returned silently, security/RBAC failures (IDOR, privilege escalation), state machine violations, shape contract breaks, boundary values where real bugs live.

**Don't write tests for:** API design choices (empty array vs 404 — both valid), theoretical edge cases with mathematically guaranteed logic, paths already covered by another test in the same describe block, implementation details rather than observable behaviour.

## DRY and Single Responsibility

**DRY** — if the same sequence appears in two tests, it belongs in a fixture or a flow. Test files contain assertions, not setup logic.

**Single Responsibility** — each fixture does one thing. Each client method does one thing. Each test verifies one behaviour. If a test needs a long comment to explain what it is checking, split it.

## What NOT to do

- Don't add a new API client method if one already exists
- Don't duplicate test logic that belongs in a fixture or flow
- Don't write UI-only assertions for server-side business rules
- Don't create new JS files — new code goes in TS
- Don't commit — show the commands, user runs them


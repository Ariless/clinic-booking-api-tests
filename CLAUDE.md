# clinic-booking-api-tests — agent conventions

## What this is

Playwright test suite for a clinic booking API (SUT). Three layers: `tests/api` (fast contract + RBAC), `tests/e2e` (thin cross-layer journeys), `tests/ui` (browser behaviour). TypeScript migration in progress — new files go in `.ts`.

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
utils/        dbClient, schemaValidator, slotAssertion, webhookTestServer, aiBugReporter, userUtils
tests/api/    API tests
tests/e2e/    E2E cross-layer tests
tests/ui/     UI browser tests
tests/unit/   Unit tests (ai.retrieval, bug-reporter.demo)
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

## What NOT to do

- Don't add a new API client method if one already exists
- Don't duplicate test logic that belongs in a fixture or flow
- Don't write UI-only assertions for server-side business rules
- Don't create new JS files — new code goes in TS
- Don't commit — show the commands, user runs them

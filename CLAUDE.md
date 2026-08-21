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

## SUT surface map

`docs/SURFACEMAP.md` — compact index of all API endpoints, UI pages, data-qa attributes, error codes, and seed accounts. Read it before exploring the DOM or SUT source code.

---

## Agent rules — MUST / SHOULD / WON'T

### MUST
- Load the matching skill from `.claude/skills/` before starting any task — see Skills index below; load every skill that applies, not just one
- TypeScript for all new files — never create `.js`
- All HTTP through `api/*Client.ts` — never `request.post()` with raw URLs in test files
- Error responses: `assertSchema(body, validateError)` + `expect(body.errorCode).toBe(...)` — never status code alone
- Auth from fixture: `{ headers: user.auth }` — never hardcoded Bearer token
- After any TS change: `npx tsc --noEmit` — zero errors before reporting done

### SHOULD
- DB assertions for create/update/delete: `dbClient.getX(id)` + field checks — don't trust API response alone
- `assertSchema` before field-level assertions — shape first, then specifics
- `import type` when importing only for type annotations

### WON'T
- `new PageClass(page)` in test files — only destructure from fixture
- `any` type — use `unknown` + type guard or explicit type
- Hardcoded credentials or Bearer tokens
- CSS class selectors, XPath, or positional selectors
- `waitForTimeout` — use Playwright auto-waiting or `waitForResponse`
- New `.js` files — only `.ts`
- Commit — show commands, user runs them

---

## Task rhythm

For every non-trivial task, follow these phases in order:

1. **Read** — read all relevant files before writing anything
2. **Scope** — list exactly which files will change and why; wait for confirmation if scope is unclear
3. **Skills** — load the matching skill from `.claude/skills/`
4. **Write** — implement the change
5. **Verify** — `npx tsc --noEmit`; zero errors
6. **Report** — show git commands; state what changed and what's next

---

## Audit-then-edit

When a task touches multiple files or has unclear scope:
1. Read all affected files first
2. Propose the full list of changes (file → what changes, why)
3. Wait for confirmation before editing
4. Apply all changes
5. Report: what changed, what was skipped, what's next

---

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

## Skills index

Load the relevant skill file before starting a task. Do not load all skills at once.

| Skill | Load when |
|-------|-----------|
| `.claude/skills/api-client/SKILL.md` | writing or editing tests that call the API; adding client methods; any task touching `api/*Client.ts` |
| `.claude/skills/ui-test-scope/SKILL.md` | writing any UI test; adding assertions to `tests/ui/` |
| `.claude/skills/e2e-cross-layer/SKILL.md` | writing any E2E test; any test that crosses UI + API or UI + DB |
| `.claude/skills/selectors/SKILL.md` | choosing or fixing a locator in any page object or UI test; any task touching `pages/*.ts` |
| `.claude/skills/fixtures/SKILL.md` | adding test data setup; creating a new fixture; debugging dirty-state failures |
| `.claude/skills/common-tasks/SKILL.md` | adding DB assertions, schema checks, error contract assertions, or auth headers |
| `.claude/skills/typing/SKILL.md` | writing new TS files; fixing type errors; migrating JS → TS; working with DB results or fixture types |
| `.claude/skills/explore-before-write/SKILL.md` | before writing any new locator, client method, or step — verify real DOM/API/existing code first |
| `.claude/skills/subagent-workflow/SKILL.md` | task requires reading many files before writing; parallel independent audits; research-then-write pattern |
| `.claude/skills/test-standards/SKILL.md` | naming a test; choosing tags; structuring a new describe block; reviewing test naming |
| `.claude/skills/data-strategy/SKILL.md` | deciding what test data to use; choosing between seed accounts, Faker, and fixtures |
| `.claude/skills/enums/SKILL.md` | using an endpoint path or error code; adding a new endpoint or error code to enums/ |
| `.claude/skills/config/SKILL.md` | changing base URL; adding env vars; running against non-default environment |
| `.claude/skills/helpers/SKILL.md` | adding shared stateless logic; deciding where utility code belongs |
| `.claude/skills/refactor-values/SKILL.md` | extracting repeated logic; renaming fixtures or helpers; deduplicating test setup |

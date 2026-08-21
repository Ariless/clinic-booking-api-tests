---
name: fixtures
description: Test data setup — user accounts, slots, page objects — via Playwright fixtures. Use when: writing a test that needs user accounts, slots, or page objects; adding a new fixture to fixtures/.
triggers:
  - writing a test that needs user accounts, slots, or page objects
  - adding a new fixture to fixtures/
  - debugging a test that leaves dirty data or fails in CI
---

# Skill: Fixtures

## WHEN to load this skill

Load when the task involves:
- Writing a test that needs user accounts, slots, or page objects
- Adding a new fixture to `fixtures/`
- Debugging a test that leaves dirty data or fails in CI
- Any task that asks "how do I set up test data?"

---

## WHY

Fixtures are the only correct place for test data setup and teardown. Tests that create data inline cannot guarantee cleanup on failure — dirty data from one run bleeds into the next, causing order-dependent failures that are invisible locally but break CI.

The second violation: instantiating page objects with `new PageClass(page)` in test files. This bypasses the fixture wiring, breaks dependency injection, and means the page object's teardown (if any) never runs.

---

## HOW

### Phase 1 — Use the right existing fixture

| Need | Fixture | What it gives you |
|------|---------|-------------------|
| One patient | `user` | creates patient, deletes on teardown |
| Doctor + slot | `slot` | creates doctor + available slot, deletes on teardown |
| Two patients | `twoUsersFixture` | two independent patients, both cleaned up |
| Page objects | `pages.ts` fixtures | all 7 POs wired, page opened automatically |

```typescript
// CORRECT
import { test } from "../../fixtures";

test("POST /bookings — 201 created @api", async ({ user, slot, appointments }) => {
    const { status, body } = await appointments.book(slot.id, { headers: user.auth });
    expect(status).toBe(201);
});
```

### Phase 2 — Adding a new fixture

Extend from the base fixture. Always include teardown.

```typescript
// fixtures/myFixture.ts
export const myFixture = base.extend<{ myThing: MyThing }>({
    myThing: async ({ request }, use) => {
        const thing = await createThing(request);
        await use(thing);
        await deleteThing(request, thing.id); // always runs, even on test failure
    },
});
```

### Phase 3 — Page objects via fixtures only

```typescript
// CORRECT — destructure from fixture
import { test } from "../../fixtures/pages";

test("login page — shows error on wrong password @ui", async ({ loginPage }) => {
    await loginPage.submitForm("x@x.com", "wrong");
    await expect(loginPage.errorMessage).toBeVisible();
});

// WRONG — direct instantiation
const loginPage = new LoginPage(page); // never in a test file
```

### Phase 4 — When NOT to use a fixture

Use a fixture when: data must exist before the test AND must be cleaned up after.

Use `beforeEach` only for: navigation, state resets, mocks (`page.route()`). Not for data creation.

Do not create a fixture for: data that the test itself creates as part of the scenario being tested (that's the action, not setup).

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| Need a patient user | `{ user }` fixture | `await AuthClient.register(...)` in `beforeEach` |
| Need a page object | `{ loginPage }` from `fixtures/pages` | `new LoginPage(page)` |
| Clean up after test | teardown inside fixture `await use(thing)` | `afterEach(() => deleteUser(...))` |
| Two independent patients | `twoUsersFixture` | two `user` fixtures (won't work — same fixture name) |
| Navigate to a page | `loginPage.navigate()` in the test | fixture that navigates (page state belongs to test) |

---

## See Also

- `fixtures/index.ts` — master fixture export
- `fixtures/pages.ts` — all 7 page objects via base.extend()
- `fixtures/userFixture.ts` — reference implementation of extend pattern
- `.claude/skills/ui-test-scope/SKILL.md` — page object usage rules

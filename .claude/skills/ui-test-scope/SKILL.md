---
name: ui-test-scope
description: Deciding whether a test belongs in tests/ui/ and writing browser-behaviour tests correctly. Use when: writing a new UI test; adding assertions to an existing UI test.
triggers:
  - writing a new UI test
  - adding assertions to an existing UI test
  - reviewing whether a test belongs in tests/ui/ vs tests/api/
---

# Skill: UI Test Scope

## WHEN to load this skill

Load when the task involves:
- Writing a new UI test
- Adding assertions to an existing UI test
- Reviewing whether a test belongs in `tests/ui/`

---

## WHY

UI tests are expensive: slower, flakier, harder to debug than API tests. They are only justified when the test physically requires a browser.

The most common mistake: putting server-side assertions (status codes, business logic, errorCode checks) into UI tests. This duplicates API test coverage, makes the suite slower, and hides the real signal — when the UI test fails, you don't know if it's a UI bug or a server bug.

---

## HOW

### Phase 1 — Check if this belongs in UI at all

Ask: "Can this be verified with an API test without a browser?"

If yes → write an API test, not a UI test.

**Belongs in UI:**
- Rendering: does the data from the API appear correctly on screen?
- UI behaviour on errors: does the page show the right message when API returns 4xx/5xx? (use `page.route()` to mock)
- Interactivity: click → correct request fired → correct result rendered
- Visual states: badge colour, empty state, toast appeared, button disabled
- Accessibility

**Does NOT belong in UI:**
- Status code assertions (`expect(response.status()).toBe(200)`)
- errorCode assertions (`expect(body.errorCode).toBe("FORBIDDEN")`)
- Server business logic (slot overlap, RBAC rules, state machine transitions)
- Database state checks

### Phase 2 — Use page fixture, not `new PageClass(page)`

```typescript
// CORRECT — import from fixtures/pages
import { test, expect } from "../../fixtures/pages";

test("login page — error shown for invalid credentials @ui", async ({ loginPage }) => {
    await loginPage.submitForm("wrong@test.com", "wrongpassword");
    await expect(loginPage.errorMessage).toBeVisible();
});

// WRONG — never instantiate directly in test file
import { LoginPage } from "../../pages/LoginPage";
const loginPage = new LoginPage(page); // ← forbidden
```

### Phase 3 — Assert only what the browser shows

```typescript
// CORRECT — assert visible UI state
await expect(page.getByText("Booking confirmed")).toBeVisible();
await expect(appointmentsPage.statusBadge).toHaveText("pending");

// WRONG — asserting server response inside a UI test
const response = await request.get("/api/v1/appointments/my");
expect(response.status()).toBe(200); // ← this belongs in an API test
```

### Phase 4 — Mock API errors with page.route()

When testing UI behaviour under error conditions, mock the API — don't rely on the server returning errors.

```typescript
await page.route("**/api/v1/appointments**", route =>
    route.fulfill({ status: 500, body: JSON.stringify({ error: "Server error" }) })
);
await appointmentsPage.navigate();
await expect(appointmentsPage.errorBanner).toBeVisible();
```

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| Check that booking was created | `expect(successMessage).toBeVisible()` | `expect(response.status()).toBe(201)` |
| Test 403 on protected route | `page.route()` mock + assert UI message | Call API directly and check errorCode |
| Test empty state | Navigate to page + assert empty state element | Check API returns empty array |
| Test slot overlap | Mock API 409 response + assert UI message | Call booking API and assert 409 |

---

## See Also

- `.claude/skills/e2e-cross-layer/SKILL.md` — when you need both browser AND API/DB assertion
- `fixtures/pages.ts` — all page objects via base.extend()
- `pages/BasePage.ts` — shared navigation logic

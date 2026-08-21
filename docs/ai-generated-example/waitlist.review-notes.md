# AI-Generated Test Review — Waitlist

**Source:** `scripts/ai-test-generator.js --tag Waitlist`  
**Model:** Claude Haiku 3  
**Date:** 2026-05-26  
**Input:** `sut/openapi/openapi.yaml` (Waitlist tag section)

---

## Context

This file documents a review of the raw AI-generated output for the Waitlist endpoints.  
The generator reads the OpenAPI spec and produces a Playwright test draft.  
The output is a starting point, not a finished test file.

The goal of this review: find every place where the generated output would either **fail at runtime**, **not test what it claims**, or **need real data that was invented**.

---

## Problems found

### Problem 1 — Browser API inside an HTTP-only test (line 21)

```typescript
test.beforeAll(async ({ playwright }) => {
  const context = await playwright.chromium.launchPersistentContext('');
  const page = context.pages()[0] ?? await context.newPage();
  const authResponse = await page.request.post(`${BASE}/api/v1/auth/login`, ...);
  patientToken = authBody.token;
  await context.close();
});
```

**What's wrong:** `playwright.chromium.launchPersistentContext('')` launches a real browser. For an API test, the `{ request }` fixture already provides an HTTP client — no browser needed. Using the browser for login while the rest of the tests use `{ request }` is an inconsistency that adds startup overhead and can cause test isolation issues (`PersistentContext` persists cookies across calls).

**Correct approach:**
```typescript
test.beforeAll(async ({ request }) => {
  const authResponse = await request.post(`${BASE}/api/v1/auth/login`, {
    data: { email: PATIENT_EMAIL, password: PATIENT_PASSWORD },
  });
  patientToken = (await authResponse.json()).token;
});
```

Or: use the project's `userFixture` — it handles auth without hardcoded credentials.

---

### Problem 2 — Invented token value for 403 tests (lines 272, 362)

```typescript
// TODO: Use non-patient token (e.g., provider/admin)
const nonPatientToken = 'non-patient-token';
```

**What's wrong:** `'non-patient-token'` is not a valid JWT. The API will reject it with **401** (invalid token), not **403** (wrong role). The test asserts `expect(response.status()).toBe(403)` — this assertion **will always fail** as written.

**Why AI did this:** The spec says "403 — not a patient." The model generated a plausible-looking variable name but did not know how to obtain an actual token for a different role.

**Correct approach:** create a doctor account in `beforeAll` (or use a fixture) and get a real doctor token. Then the 403 test actually exercises the role-based guard, not the auth guard.

---

### Problem 3 — Hardcoded IDs with no setup (lines 71, 109, 128, 217, 383)

```typescript
const offerId = 1;        // accept/decline happy path
const offerId = 999;      // 403 "belongs to another patient"
const slotId = 1;         // join waitlist
const slotId = 2;         // slot still available
const waitlistId = 1;     // delete own entry
```

**What's wrong:** these IDs point to data that may not exist in the test database, may be in the wrong state, or may belong to the wrong patient. Tests that rely on magic IDs are fragile by construction — they pass locally after manual setup and fail in CI.

**Why AI did this:** the spec says "use a valid offerId" but the model has no way to derive that from the OpenAPI document alone. It fell back to incrementing integers.

**The TODO comments acknowledge this** (`// TODO: Use valid offerId from test data setup`) but the test bodies were written as if the IDs are real — the assertions will run against a 404 or wrong-user response.

**Correct approach:** create the prerequisite state in `beforeAll` or a fixture:
```typescript
// In beforeAll: create a slot, join the waitlist, get the real ID
const waitlistRes = await request.post(`${BASE}/api/v1/appointments/waitlist`, {
  headers: { Authorization: `Bearer ${patientToken}` },
  data: { slotId: realSlotId },
});
waitlistId = (await waitlistRes.json()).id;
```

---

### Problem 4 — Generic errorCode assertions (most error cases)

```typescript
expect(body).toHaveProperty('errorCode');
// no: expect(body.errorCode).toBe('...')
```

Only two tests specify the exact code:
- `expect(body.errorCode).toBe('SLOT_STILL_AVAILABLE')` (line 252)
- `expect(body.errorCode).toBe('WAITLIST_DUPLICATE')` (line 325)

All other error cases (401, 403, 400, 404, 409) assert only that `errorCode` exists.

**What's wrong:** a test that only checks `toHaveProperty('errorCode')` will pass for any error, including the wrong one. If the API returns `INVALID_TOKEN` instead of `WAITLIST_ENTRY_NOT_FOUND` for a 404, the test does not catch it.

**Why AI did this:** the two specific codes appear in the OpenAPI spec as enum values for those responses. The other responses have `errorCode` in the schema but no enum — the model correctly identified the property but had nothing to populate the value with.

**The spec has all the codes.** `CONTRACT_PACK.md` and `data/enums/` contain the full error code catalog. The generator prompt did not include that file.

---

## Summary

| Problem | Will test run? | Will test catch a bug? |
|---------|---------------|----------------------|
| Browser launch for API auth | Runs, but slower and fragile | Test itself works |
| Invented token for 403 | Assertion fails (gets 401) | No — always red |
| Hardcoded IDs without setup | May 404 or return wrong data | No — depends on DB state |
| Generic errorCode assertion | Passes for any error | Partial — misses wrong codes |

---

## What AI did well

- Covered all 5 endpoints and all HTTP methods correctly
- Generated the correct HTTP status code for each scenario
- Included both happy path and error cases for every endpoint
- Named tests in a pattern close to the project convention
- Flagged all missing setup data with `// TODO` comments
- Correctly identified the two error codes that appear as enum values in the spec

---

## Lesson

AI-generated test code reflects the quality of the input. The OpenAPI spec describes **what** the API returns — not **how to reach that state**. The gap between spec knowledge and runtime knowledge is exactly where the generated output breaks down:

- Token for a non-patient role → not in the spec
- Real IDs with the right state → not in the spec  
- Error code values beyond spec enums → not in the spec

The output is a useful checklist of cases to cover, and a correct first pass at structure and assertions. It is not a runnable test file without data setup and a review of every assumption.

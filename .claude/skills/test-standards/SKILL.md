---
name: test-standards
description: Naming conventions, tags, and structural rules for all test files in this project. Use when: writing a new test file; naming a new test or describe block; adding or reviewing tags on a test.
triggers:
  - writing a new test file
  - naming a new test or describe block
  - adding or reviewing tags on a test
  - unsure whether a test is structured correctly
---

# Skill: Test Standards

## WHEN to load this skill

Load when the task involves:
- Writing a new test file or describe block
- Naming a test — choosing the right format for API, UI, or E2E layer
- Adding tags to a test
- Reviewing test structure for correctness

---

## WHY

Consistent naming lets any engineer read the test list and know immediately: which layer, what action, what outcome. Tags gate CI pipelines — a misnamed tag silently excludes a test from a run. One assertion per test means failures point to one behaviour, not "something in the booking flow".

---

## HOW

### Test naming

| Layer | Pattern | Example |
|-------|---------|---------|
| API   | `METHOD /path — STATUS description @tag` | `POST /appointments — 201 creates appointment @smoke @api` |
| UI    | `page — description @ui` | `booking — shows error when slot is taken @ui` |
| E2E   | `subject — cross-layer result @e2e` | `patient booking — appointment visible in DB after UI submit @e2e` |

### Valid tags

```
@smoke        @api        @ui         @e2e
@webhook      @ws         @chaos      @payment
@pact         @rag        @security   @concurrency
@observability @rate-limit
```

Do not invent new tags. Tags must exist in `playwright.config.ts` or the CI matrix will silently skip them.

### One assertion per test — the rule

**Wrong:**
```ts
test('booking flow', async ({ user, slot }) => {
  const r = await client.book(slot.id, user.auth);
  expect(r.status()).toBe(201);
  const body = await r.json();
  expect(body.status).toBe('pending');
  expect(body.patientId).toBe(user.id);
  // DB check
  const row = await dbClient.getAppointment(body.id);
  expect(row).toBeDefined();
});
```

**Correct — split by assertion concern:**
```ts
test('POST /appointments — 201 returns pending status @api', async ({ user, slot }) => {
  const r = await client.book(slot.id, user.auth);
  expect(r.status()).toBe(201);
  const body = await r.json();
  assertSchema(body, validateAppointment);
  expect(body.status).toBe('pending');
});

test('POST /appointments — 201 creates row in DB @api', async ({ user, slot }) => {
  const body = await (await client.book(slot.id, user.auth)).json();
  const row = await dbClient.getAppointment(body.id);
  expect(row).toBeDefined();
  expect(row!.patient_id).toBe(user.id);
});
```

**Exception:** it is acceptable to assert schema + one field in the same test — schema check is a pre-condition, not an independent assertion.

### `describe` block structure

```ts
test.describe('POST /appointments', () => {
  test.describe('201 success', () => { … });
  test.describe('400 validation', () => { … });
  test.describe('403 RBAC', () => { … });
});
```

Group by endpoint → group by status code / concern. Never mix layers in one describe block.

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| API test name | `POST /path — 201 creates X @api` | `creates appointment`, `test booking` |
| UI test name | `page — description @ui` | `POST /appointments` in UI test name |
| Tag for CI smoke run | `@smoke` | `@Smoke`, `@SMOKE`, custom tag |
| Multiple unrelated assertions | separate tests | one long test |
| New tag not in config | discuss first, add to config | just use it and hope |

---

## See Also

- `.claude/skills/api-client/SKILL.md` — how to call the API in tests
- `.claude/skills/ui-test-scope/SKILL.md` — what belongs in tests/ui/ vs tests/api/
- `CLAUDE.md` → Test naming table

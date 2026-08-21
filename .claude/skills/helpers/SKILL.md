---
name: helpers
description: Utilities that are shared across tests but are not fixtures — schema validators, DB helpers, assertion wrappers. Use when: adding shared logic that is not test setup; writing a function used by more than one test file; deciding whether something belongs in utils/ vs fixtures/ vs a test file.
triggers:
  - adding shared logic that is not test setup
  - writing a function used by more than one test file
  - deciding whether something belongs in utils/ vs fixtures/ vs a test file
  - debugging an import from utils/
---

# Skill: Helpers

## WHEN to load this skill

Load when the task involves:
- Adding a helper function used across multiple tests
- Deciding where shared logic lives — `utils/`, `fixtures/`, or inline
- Using `dbClient`, `schemaValidator`, `slotAssertion`, or `webhookTestServer`
- Adding a new utility that doesn't fit fixture lifecycle

---

## WHY

Test files should contain only assertions. Setup belongs in fixtures. Shared, stateless logic belongs in `utils/`. The boundary matters: fixtures have lifecycle (before/after), helpers do not. Putting lifecycle logic in `utils/` leads to cleanup bugs. Putting pure logic in fixtures adds unnecessary coupling.

---

## HOW

### What lives where

| Location | What goes here | What does NOT go here |
|----------|---------------|----------------------|
| `utils/` | Stateless helpers — schema assertion, DB reads, slot math, webhook server | Anything with `beforeEach`/`afterEach` or that creates/deletes data |
| `fixtures/` | Test data with lifecycle — user creation, cleanup, page wiring | Pure functions without setup/teardown |
| `flows/` | Multi-step API sequences reused across test files | Single-step calls |
| Test file | Assertions only | Reusable logic |

### Key helpers

```ts
// Schema validation
import { assertSchema } from '../../utils/schemaValidator';
assertSchema(body, validateAppointment); // throws if shape is wrong

// DB client
import { dbClient } from '../../utils/dbClient';
const row = await dbClient.getAppointment(id); // returns T | undefined

// Slot assertion
import { assertSlotState } from '../../utils/slotAssertion';
await assertSlotState(slotId, 'booked');

// Webhook test server
import { webhookTestServer } from '../../utils/webhookTestServer';
const received = await webhookTestServer.waitForEvent('appointment.booked');

// AI bug reporter
import { aiBugReporter } from '../../utils/aiBugReporter';
// Used in test hooks, not directly in test assertions

// User utils
import { userUtils } from '../../utils/userUtils';
```

### Adding a new helper

1. Create in `utils/myHelper.ts` (TypeScript, not JS)
2. Export a named function — never a class with state
3. Import by path: `import { myHelper } from '../../utils/myHelper'`
4. Run `npx tsc --noEmit` — zero errors

### DB results are `T | undefined`

```ts
const row = await dbClient.getAppointment(id);
// WRONG: row.status — row may be undefined
// CORRECT:
expect(row).toBeDefined();
expect(row!.status).toBe('pending');
// or:
if (!row) throw new Error('appointment not in DB');
```

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| Shared assertion logic | `utils/myHelper.ts` | copy-paste into two test files |
| Multi-step booking flow | `flows/bookingFlow.ts` | repeated steps in two test files |
| Data creation + cleanup | fixture in `fixtures/` | helper in `utils/` with manual cleanup |
| DB result access | `expect(row).toBeDefined(); row!.field` | `row.field` without check |
| New helper file | `.ts` in `utils/` | `.js` — new files must be TS |

---

## See Also

- `utils/schemaValidator.ts` — `assertSchema()`
- `utils/dbClient.ts` — DB read helpers
- `.claude/skills/fixtures/SKILL.md` — when to use fixtures instead
- `.claude/skills/typing/SKILL.md` — handling `T | undefined` from DB

---
name: common-tasks
description: DB assertions, schema validation, error contract assertions, auth headers. Use when: adding a DB assertion to a test; asserting an API response shape; asserting an error response (errorCode + schema).
triggers:
  - adding a DB assertion to a test
  - asserting an API response shape
  - asserting an error response (errorCode + schema)
  - adding auth headers to a request
---

# Skill: Common Tasks

## WHEN to load this skill

Load when the task involves:
- Adding a DB assertion to a test
- Asserting an API response shape
- Asserting an error response
- Checking auth headers or token handling

---

## WHY

These patterns repeat across the test suite. Each has a specific shape that exists for a reason. Deviating from the pattern produces either false confidence (no shape check) or duplicate assertions (checking things already covered by another layer).

---

## HOW

### DB assertion

Use `dbClient` from `utils/dbClient.ts`. Result is always `T | undefined` — check existence before accessing fields.

```typescript
import { dbClient } from "../../utils/dbClient";

// CORRECT
const row = await dbClient.getAppointment(body.id);
expect(row).toBeDefined();
expect(row!.status).toBe("pending");
expect(row!.patientId).toBe(user.id);

// WRONG — trusting only the API response, not the DB
expect(body.status).toBe("pending"); // API could lie; DB is the source of truth
```

Use DB assertions when: the test verifies that a side effect actually persisted (create, update, delete). Do not use for read-only endpoints — the API response is sufficient.

### Schema assertion

Check shape first, then specific fields. Schema lives in `data/schemas/`.

```typescript
import { assertSchema } from "../../utils/schemaValidator";
import { validateAppointment } from "../../data/schemas/appointment.schema";

// CORRECT — shape + targeted field
assertSchema(body, validateAppointment);
expect(body.status).toBe("pending");
expect(body.slotId).toBe(slot.id);

// WRONG — only checking one field, shape can drift silently
expect(body.status).toBe("pending");
```

### Error contract

Every error response must assert both shape and errorCode. Never assert only the status code.

```typescript
import { validateError } from "../../data/schemas/error.schema";

// CORRECT
expect(status).toBe(403);
assertSchema(body, validateError);
expect(body.errorCode).toBe("FORBIDDEN");

// WRONG — status alone tells you nothing about the contract
expect(status).toBe(403);
```

### Auth header

Auth comes from the `user` fixture. Never hardcode tokens.

```typescript
// CORRECT
const { status } = await appointments.getMyAppointments({ headers: user.auth });

// WRONG — hardcoded token, breaks on DB reset
const { status } = await appointments.getMyAppointments({
    headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiIsIn..." }
});
```

### Checking RBAC / 403

When testing that role B cannot access role A's resource: create both resources with fixtures, make the cross-role call, assert 403 + errorCode.

```typescript
test("GET /appointments/:id — 403 FORBIDDEN for other patient @api", async ({ twoUsersFixture, slot }) => {
    const { userA, userB } = twoUsersFixture;
    const { body: booking } = await appointments.book(slot.id, { headers: userA.auth });

    const { status, body } = await appointments.getAppointment(booking.id, { headers: userB.auth });
    expect(status).toBe(403);
    assertSchema(body, validateError);
    expect(body.errorCode).toBe("FORBIDDEN");
});
```

---

## WHAT — correct vs forbidden

| Task | Correct | Forbidden |
|------|---------|-----------|
| Assert created record | `dbClient.getX(id)` + field checks | trust API response only |
| Assert response shape | `assertSchema(body, validateX)` | field-by-field manual checks |
| Assert error | status + `assertSchema` + `errorCode` | status check only |
| Auth header | `{ headers: user.auth }` | hardcoded Bearer token |
| Test 403 | `twoUsersFixture` + cross-role call | single-user test, mock auth |

---

## See Also

- `utils/dbClient.ts` — DB query helpers
- `utils/schemaValidator.ts` — `assertSchema` implementation
- `data/schemas/` — all response schemas
- `fixtures/index.ts` — `user`, `slot`, `twoUsersFixture`

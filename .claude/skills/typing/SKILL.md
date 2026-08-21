---
name: typing
description: TypeScript typing for new files, fixing type errors, and working with DB results and fixture types. Use when: adding a new TypeScript file; fixing a type error (tsc --noEmit fails); working with DB results, API responses, or fixture types.
triggers:
  - adding a new TypeScript file
  - fixing a type error (tsc --noEmit fails)
  - working with DB results, API responses, or fixture types
  - migrating a JS file to TS
---

# Skill: TypeScript Typing

## WHEN to load this skill

Load when the task involves:
- Adding a new TypeScript file
- Fixing a type error (`tsc --noEmit` fails)
- Working with DB results, API responses, or fixture types
- Migrating a `.js` file to `.ts`

---

## WHY

`strict: true` is non-negotiable. `any` silences the type checker without fixing the underlying uncertainty — it is not a shortcut, it is a lie. The most common strict-mode surprises in this codebase involve `T | undefined` returns from DB helpers and dual-namespace naming in fixtures.

Run `npx tsc --noEmit` after every change. Zero errors is the bar.

---

## HOW

### `T | undefined` from dbClient

Every `dbClient` method returns `T | undefined`. Always check existence before accessing fields.

```typescript
// CORRECT — guard first, then non-null assert
const row = await dbClient.getAppointment(id);
expect(row).toBeDefined();
expect(row!.status).toBe("pending");   // ! is safe after the guard

// ALSO CORRECT — conditional
if (!row) throw new Error(`Appointment ${id} not found in DB`);
expect(row.status).toBe("pending");

// WRONG — TS2532: Object is possibly undefined
expect(row.status).toBe("pending");    // crashes if row is undefined
```

### `any` is forbidden

```typescript
// CORRECT — type the parameter
function parseBody(body: Record<string, unknown>) { ... }

// CORRECT — unknown + type guard
function parseBody(body: unknown) {
    if (typeof body !== "object" || body === null) throw new Error("bad body");
    ...
}

// WRONG
function parseBody(body: any) { ... }  // hides every downstream error
```

### Fixture types — extend, not cast

When adding a new fixture, type it through `base.extend`, never cast the result.

```typescript
// CORRECT
export const myFixture = base.extend<{ token: string }>({
    token: async ({}, use) => {
        await use("tok-123");
    },
});

// WRONG — loses type safety
const myFixture = base.extend({
    token: async ({}, use) => {
        await use("tok-123" as any);
    },
});
```

### Import types correctly

Use `import type` when importing only for type annotations — keeps runtime bundle clean.

```typescript
// CORRECT
import type { Appointment } from "../data/types";
import { dbClient } from "../utils/dbClient";  // runtime value

// WRONG — imports runtime module just for a type
import { Appointment } from "../data/types";   // if Appointment is only a type
```

### JS + TS coexistence (`allowJs: true`)

Old `.js` files coexist with new `.ts` files. Rules:
- Never create new `.js` files — new code goes in `.ts`
- When editing a `.js` file substantially, migrate it to `.ts` in the same PR
- `ts-node` / `tsx` picks up both — no config change needed

### Running the type check

```bash
npx tsc --noEmit
```

Run this before committing any TS change. A clean compile is required — no suppressed errors, no `@ts-ignore`.

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| DB result field access | guard with `toBeDefined()` + `!` | direct access without guard |
| Unknown function parameter | `unknown` + type guard | `any` |
| New utility file | `.ts` | `.js` |
| Fixture type | `base.extend<{ name: Type }>` | `base.extend({...})` untyped |
| Import only used as type | `import type { X }` | `import { X }` |
| Type check | `npx tsc --noEmit` passes | `@ts-ignore` to silence errors |

---

## See Also

- `tsconfig.json` — `strict: true`, `allowJs: true`
- `utils/dbClient.ts` — returns `T | undefined` on all get methods
- `fixtures/userFixture.ts` — reference implementation of typed fixture

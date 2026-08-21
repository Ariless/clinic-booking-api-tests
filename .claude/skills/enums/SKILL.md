---
name: enums
description: When and how to use enums/ constants — endpoints, error codes, allowed values. Use when: writing a test that uses an API endpoint path; asserting an error code from the API; adding a new endpoint or error code to the project.
triggers:
  - writing a test that uses an API endpoint path
  - asserting an error code from the API
  - adding a new endpoint or error code to the project
  - unsure whether to use a string literal or an enum constant
---

# Skill: Enums

## WHEN to load this skill

Load when the task involves:
- Using an API endpoint path in a test or client method
- Asserting an `errorCode` value from an API error response
- Adding a new endpoint or error code to the project
- Deciding between a string literal and a named constant

---

## WHY

String literals for endpoint paths and error codes scatter across many files. When the API changes a path or renames an error code, every test that hardcodes the string breaks silently — the test still runs but asserts the old value.

Named constants in `enums/` give one source of truth. Change the constant, everything using it updates.

---

## HOW

### File layout

```
enums/
  auth/index.ts          — AuthEndpoints, AuthErrors
  appointments/index.ts  — AppointmentEndpoints, AppointmentErrors
  doctors/index.ts       — DoctorEndpoints, DoctorErrors
  ai/index.ts            — AiEndpoints, AiErrors, ALLOWED_SPECIALTIES
  consultations/index.ts — ConsultationEndpoints, ConsultationErrors
  index.ts               — barrel: export * from each area
```

### Import pattern

```ts
// Always import from the barrel
import { AuthEndpoints, AppointmentErrors } from '../../enums';

// Use in client method
async login(email: string, password: string) {
  return this.request.post(AuthEndpoints.LOGIN, { data: { email, password } });
}

// Use in assertion
expect(body.errorCode).toBe(AppointmentErrors.SLOT_TAKEN);
```

### Adding a new endpoint

1. Open the relevant `enums/{area}/index.ts`
2. Add to the `Endpoints` const object: `NEW_ROUTE: '/path/to/resource'`
3. Export type: `export type NewEndpoint = typeof NewEndpoints[keyof typeof NewEndpoints]`
4. Re-run `npx tsc --noEmit` — zero errors

### Adding a new error code

Same flow as endpoint, but in the `Errors` object:

```ts
export const AuthErrors = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  NEW_CODE: 'NEW_CODE',         // ← add here
} as const;
```

### Backward compatibility

`data/testData.ts` re-exports all enums for existing tests that import `endpoints`:

```ts
export { AuthEndpoints, AuthErrors } from '../enums/auth';
```

Do not remove or change re-exports in `testData.ts` — old tests still import from there.

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| API path in client method | `AuthEndpoints.LOGIN` | `'/auth/login'` |
| Error code assertion | `AppointmentErrors.SLOT_TAKEN` | `'SLOT_TAKEN'` |
| New path not in enums | add to enums/ first | inline string in test |
| Import path | `import … from '../../enums'` | `import … from '../../enums/auth/index'` |

---

## See Also

- `enums/index.ts` — barrel with all exports
- `data/testData.ts` — re-exports for backward compatibility
- `.claude/skills/api-client/SKILL.md` — how client methods use enums

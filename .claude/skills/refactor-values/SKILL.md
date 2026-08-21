---
name: refactor-values
description: How to refactor tests without losing coverage — extract, deduplicate, rename safely. Use when: extracting repeated logic into a fixture or helper; renaming a test, fixture, or client method; deduplicating test setup across multiple files.
triggers:
  - extracting repeated logic into a fixture or helper
  - renaming a test, fixture, or client method
  - deduplicating test setup across multiple files
  - reducing copy-paste without changing test behaviour
---

# Skill: Refactor Values

## WHEN to load this skill

Load when the task involves:
- Extracting repeated setup into a fixture or flow
- Renaming a fixture, helper, or client method across all usages
- Deduplicating test logic without removing coverage
- Any refactor that must not change what is being tested

---

## WHY

Refactoring tests is riskier than refactoring source code: a test that compiles and runs can still silently lose coverage if an assertion is accidentally removed or a precondition quietly stops firing.

The rule: **refactor must not change the observable contract of any test.** Coverage is preserved when every assertion that existed before exists after, and every test that ran before still runs.

---

## HOW

### Safe refactor checklist

Before starting any refactor:

1. **Confirm tests pass** — `npm test` green before you touch anything
2. **List what you're extracting** — write down the assertions and setup you're moving
3. **Move, don't rewrite** — copy the logic first, then delete the original
4. **Confirm tests still pass** — `npm test` green after
5. **Check test count** — `grep -c "test(" tests/**/*.ts` before and after; count must not drop

### Extracting repeated setup into a fixture

**Before:**
```ts
// test-a.ts
test('...', async ({ request }) => {
  const reg = await request.post('/auth/register', { data: { email, password, name, role: 'patient' } });
  const login = await request.post('/auth/login', { data: { email, password } });
  const { token } = await login.json();
  // ... actual assertions
});
```

**After:** use `user` fixture — it already handles registration + login + cleanup.

```ts
test('...', async ({ user }) => {
  // user.auth is ready; cleanup happens automatically
});
```

**Check:** the assertions from the test body are still there. Only the setup moved to the fixture.

### Extracting repeated multi-step flow

If the same 3-step API sequence appears in two tests, move it to `flows/`:

```ts
// flows/bookingFlow.ts
export async function bookAndConfirm(client: AppointmentsClient, slotId: number, auth: Auth) {
  const booking = await client.book(slotId, auth);
  const body = await booking.json();
  const confirm = await client.confirm(body.id, doctorAuth);
  return { booking: body, confirmed: await confirm.json() };
}
```

Import in both tests. The assertions stay in the test — only the navigation sequence moves.

### Renaming a fixture or helper

1. Rename in the source file
2. `grep -r "oldName" tests/ fixtures/ flows/ utils/` — find all usages
3. Update all usages
4. `npx tsc --noEmit` — zero errors
5. `npm test` — all tests pass

Do not rename and refactor in the same commit. Rename first, verify, then refactor.

### What must never change during a refactor

- Test names (changing names changes what CI reports)
- Tags (changing tags changes which CI gates include the test)
- The assertion values — `expect(body.status).toBe('pending')` must stay identical
- Test count — if it drops, an assertion was accidentally deleted

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| Extract setup | move to fixture, keep assertions in test | move assertions into helper |
| Rename method | rename + grep + tsc + run | rename + hope for the best |
| Deduplicate test | extract shared setup to fixture | merge two tests into one |
| Simplify assertion | keep the same value, just cleaner code | weaken assertion (`.toContain` instead of `.toBe`) |
| Verify refactor | run full suite, check test count | run only the changed file |

---

## See Also

- `.claude/skills/fixtures/SKILL.md` — how to add or change fixtures
- `.claude/skills/helpers/SKILL.md` — when shared logic belongs in utils/ vs fixtures/
- `CLAUDE.md` → DRY and Single Responsibility

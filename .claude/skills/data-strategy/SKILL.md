---
name: data-strategy
description: When to use static seed accounts vs dynamic Faker data vs fixtures for test data. Use when: deciding what test data to use in a new test; adding user accounts or appointment data to a test; choosing between hardcoded data and generated data.
triggers:
  - deciding what test data to use in a new test
  - adding user accounts or appointment data to a test
  - choosing between hardcoded data and generated data
  - debugging flaky tests caused by shared state
---

# Skill: Data Strategy

## WHEN to load this skill

Load when the task involves:
- Deciding what test data to use in a new test
- Adding user accounts or appointment data
- Choosing between static JSON, seed accounts, Faker, or fixtures
- Debugging tests that fail because of shared or leftover data

---

## WHY

Static shared data → tests collide. Hardcoded IDs → tests break when DB is reset. Dynamic data → tests are independent and can run in any order.

The wrong strategy is invisible in a single run and catastrophic in parallel CI.

---

## HOW

### Three data categories

| Category | What | When to use |
|----------|------|-------------|
| **Seed accounts** | `data/seedAccounts.ts` — fixed patient@/doctor@/admin@ | Read-only tests: RBAC checks, login flows — never modify seed account state |
| **Dynamic fixture data** | `user` / `slot` fixtures — create + auto-delete | Any test that creates, mutates, or deletes data |
| **Static inline** | Hardcoded values in the test | Only for constants that can never conflict (e.g., a known error message) |

### Never use seed accounts for write operations

```ts
// WRONG — poisons shared state
test('cancel appointment', async ({ request }) => {
  const auth = { headers: { Authorization: `Bearer ${seedAccounts.patient.token}` } };
  const appt = await client.book(seedAccounts.slot.id, auth);
  await client.cancel(appt.id, auth);
});

// CORRECT — fixture creates and cleans up
test('cancel appointment', async ({ user, slot }) => {
  const appt = await client.book(slot.id, user.auth);
  await client.cancel(appt.body.id, user.auth);
});
```

### Dynamic data via fixtures — the default

```ts
// fixtures/index.ts already provides: user, slot, twoUsersFixture, pages.*
// Use destructuring in test signature:
test('...', async ({ user, slot, appointmentsPage }) => { … });
```

For new data shapes not covered by existing fixtures, add to `fixtures/` — not inline in the test.

### Faker — for string content only

Use `@faker-js/faker` only for string values where content doesn't matter but format does: names, emails for uniqueness, reason strings.

```ts
import { faker } from '@faker-js/faker';

const reason = faker.lorem.sentence(); // fine
const userId = faker.number.int();     // WRONG — use fixture, not random int
```

Never generate IDs, status values, or role strings with Faker — use real DB-created values via fixtures.

### `data/seedAccounts.ts` — read the file, don't guess

Seed accounts have fixed credentials. Always import from `data/seedAccounts.ts`:

```ts
import { seedAccounts } from '../../data/seedAccounts';
const { patient, doctor } = seedAccounts;
```

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| Test needs a user | `user` fixture | hardcoded `patient@example.com` |
| Test needs unique email | `faker.internet.email()` | `test-user@example.com` (collides) |
| Read-only RBAC check | seed account (read-only) | dynamic user (wasted setup) |
| Test creates an appointment | dynamic fixture | seed account + shared slot |
| Test needs two patients | `twoUsersFixture` | two seed accounts |

---

## See Also

- `fixtures/index.ts` — all fixture definitions
- `.claude/skills/fixtures/SKILL.md` — how fixtures are wired and how to add new ones
- `data/seedAccounts.ts` — fixed credential store

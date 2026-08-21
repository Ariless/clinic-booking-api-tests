---
name: explore-before-write
description: Research DOM, API shape, and existing code before writing any locator, client method, or step. Use when: writing a new UI test or page object; writing a test for an endpoint you haven't used before; adding a locator to an existing page object.
triggers:
  - writing a new UI test or page object
  - writing a test for an endpoint you haven't used before
  - adding a locator to an existing page object
  - before writing any new selector, client call, or step definition
---

# Skill: Explore Before Write

## WHEN to load this skill

Load when the task involves:
- Writing a new UI test or page object
- Writing a test for an endpoint you haven't used before
- Adding a locator to an existing page object

---

## WHY

Writing code based on assumptions about DOM structure or API response shape leads to tests that pass locally but test the wrong thing. A 5-minute exploration prevents a 30-minute debugging session.

---

## HOW

### UI — explore the DOM before writing locators

Run the SUT, then use Playwright CLI to inspect real elements:

```bash
# Open browser and inspect interactively
npx playwright open http://localhost:3000/login

# Or query selectors directly from CLI
npx playwright codegen http://localhost:3000/login
```

Priority order when choosing a locator:
1. `getByRole()` — accessible name (button, textbox, heading)
2. `getByLabel()` — form field linked to label
3. `getByPlaceholder()` — input placeholder
4. `getByText()` — visible text, stable content
5. `getByTestId()` — `data-qa` attribute, last resort

```typescript
// CORRECT — role-based, survives layout changes
page.getByRole('button', { name: /book/i })

// WRONG — assumed testId without checking
page.getByTestId('booking-submit-button')   // may not exist
```

### API — make a real request before writing assertions

Before writing schema or field assertions, call the endpoint and see the actual response:

```bash
# Quick check from terminal
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/appointments/my | jq .
```

Or use a test with `console.log(body)` on the first run, then replace with proper assertions.

```typescript
// WRONG — guessing field names
expect(body.appointment_id).toBeDefined();  // maybe it's body.id?

// CORRECT — check actual response first, then assert
assertSchema(body, validateAppointment);
expect(body.id).toBeDefined();
```

### Codebase — read before adding

Before writing a new client method or step definition, grep for existing ones:

```bash
# Check if client method already exists
grep -n "getAppointment\|fetchAppointment" api/AppointmentsClient.ts

# Check if step already exists
grep -rh "^Given\|^When\|^Then" tests/step-definitions/
```

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| New page object locator | inspect real DOM first | assume `data-qa` name |
| New API assertion | call endpoint, check shape | guess field names |
| New client method | check existing client first | duplicate existing method |
| New step definition | grep existing steps first | add duplicate (causes silent skip) |

---

## See Also

- `.claude/skills/selectors/SKILL.md` — selector priority order and anti-patterns
- `.claude/skills/api-client/SKILL.md` — client conventions
- `.claude/skills/common-tasks/SKILL.md` — schema and error assertion patterns

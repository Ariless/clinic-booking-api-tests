---
name: selectors
description: Choosing and writing resilient locators in page objects and UI tests. Use when: writing a new UI or E2E test; adding locators to a page object.
triggers:
  - writing a new UI or E2E test
  - adding locators to a page object
  - reviewing or fixing a broken selector
---

# Skill: Selectors

## WHEN to load this skill

Load when the task involves:
- Writing a new UI or E2E test
- Adding locators to a Page Object
- Reviewing or fixing a broken selector
- Any task that touches `pages/*.ts`

---

## WHY

Selector choice determines test resilience. A test tied to a CSS class or DOM position breaks the moment a designer touches the markup. A test tied to accessible role or label text survives refactoring because it checks what the user actually perceives.

The hierarchy below is not a preference — it is a contract. A selector lower in the list requires a documented reason to exist.

---

## HOW

### Priority order

| Priority | Selector | Use when |
|----------|----------|----------|
| 1 | `getByRole('button', { name: /submit/i })` | element has a semantic role + accessible name |
| 2 | `getByLabel('Email address')` | form field with associated `<label>` or `aria-label` |
| 3 | `getByPlaceholder('Enter email')` | input without label (prefer adding label instead) |
| 4 | `getByText('Booking confirmed')` | static visible text with no better anchor |
| 5 | `getByTestId('submit-button')` | element with no semantic meaning and no stable text |

Never use: CSS class selectors, XPath, positional selectors (`:nth-child`).

### Phase 1 — Try role first

```typescript
// CORRECT — survives redesign, readable, tests accessibility implicitly
page.getByRole('button', { name: /log in/i })
page.getByRole('heading', { name: 'My Appointments' })
page.getByRole('cell', { name: 'confirmed' })

// WRONG — breaks if class changes
page.locator('.btn-primary')
page.locator('button:nth-child(2)')
```

### Phase 2 — Label for inputs

```typescript
// CORRECT — reflects what the user sees
page.getByLabel('Email address')
page.getByLabel('Date of birth')

// WRONG — placeholder disappears on type
page.getByPlaceholder('e.g. john@example.com')
```

### Phase 3 — data-qa only as last resort

```typescript
// CORRECT — explicit contract with SUT
page.getByTestId('booking-success-message')

// WRONG — brittle, invisible to screen readers
page.locator('[class="success-banner active"]')
page.locator('//div[@id="app"]/div[2]/p')  // never XPath
```

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| Click a form submit button | `getByRole('button', { name: /submit/i })` | `locator('.btn-submit')` |
| Assert page heading | `getByRole('heading', { name: 'Doctors' })` | `locator('h1')` |
| Fill email field | `getByLabel('Email address')` | `locator('#email-input')` |
| Assert success state | `getByText('Appointment booked')` | `locator('p.success')` |
| Target element with no role | `getByTestId('slot-item-42')` | `locator('li:nth-child(3)')` |

---

## See Also

- `pages/BasePage.ts` — base class for all page objects
- `.claude/skills/ui-test-scope/SKILL.md` — what belongs in a UI test at all
- `.claude/skills/e2e-cross-layer/SKILL.md` — when you need both browser + API assertion

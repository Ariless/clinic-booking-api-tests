---
name: e2e-cross-layer
description: Writing E2E tests that span UI + API + DB layers. Use when: writing a new E2E test in tests/e2e/; adding a DB or API assertion after a UI action.
triggers:
  - writing a new E2E test in tests/e2e/
  - adding a DB or API assertion after a UI action
  - any test that crosses two or more layers (UI + API, UI + DB, API + DB)
---

# Skill: E2E Cross-Layer Tests

## WHEN to load this skill

Load when the task involves:
- Writing a new E2E test in `tests/e2e/`
- Adding a DB or API assertion after a UI action
- Any test that crosses two or more layers (UI + API, UI + DB, API + DB)

---

## WHY

E2E tests exist to verify invariants that a single layer cannot prove alone. An API test proves the server behaves correctly. A UI test proves the browser renders correctly. An E2E test proves both sides agree — that a UI action produces the right persistent state, or that an API action produces the right UI state.

The most common mistake: writing an E2E test that only uses one layer — either pure UI clicks with no API/DB check, or pure API calls with no browser involved. Those belong in `tests/ui/` or `tests/api/` respectively.

---

## HOW

### Phase 1 — Identify the cross-layer invariant

Define what you are proving. The test name should state it:

```
patient books via UI wizard — appointment appears as pending in API @e2e
doctor confirms via API — patient UI shows confirmed status @e2e
```

Format: `SUBJECT — cross-layer result @e2e`

### Phase 2 — Structure the test: action in one layer, assert in another

**Pattern A — UI action → API/DB verification**

```typescript
test("patient books via UI wizard — appointment appears as pending in API @e2e", async ({
    request, page, user, slot
}) => {
    // 1. Action in browser
    const { loginPage, bookingPage } = ...; // use fixtures
    await loginPage.login(user.email, user.password);
    await bookingPage.walkWizard(slot.doctor.specialty, slot.doctor.name);
    await bookingPage.submitBookingButton.click();

    // 2. Assert UI feedback
    await expect(bookingPage.bookingSuccessMessage).toBeVisible();

    // 3. Verify persistent state via API
    const appointments = new AppointmentsClient(request);
    const { body } = await appointments.listMy({ headers: { Authorization: `Bearer ${user.token}` } });
    const pending = body.find((a: { status: string }) => a.status === "pending");
    expect(pending).toBeTruthy();
});
```

**Pattern B — API action → UI verification**

```typescript
test("doctor confirms via API — patient UI shows confirmed status @e2e", async ({
    request, page, user, slot
}) => {
    // 1. Setup and action via API
    const appointments = new AppointmentsClient(request);
    await appointments.confirm(appointmentId, { headers: doctorAuth });

    // 2. Verify state is reflected in UI
    await patientAppointmentsPage.navigate();
    await expect(patientAppointmentsPage.statusBadge).toHaveText("confirmed");
});
```

**Pattern C — DB assertion after action**

```typescript
// 3. Verify DB state directly when API does not expose the field
const record = dbClient.getAppointment(appointmentId);
expect(record).toBeDefined();
expect(record!.status).toBe("pending");
```

### Phase 3 — Use fixtures for setup, not manual creation

```typescript
// CORRECT — fixtures handle create/cleanup automatically
test("...", async ({ request, page, user, slot }) => { ... });

// WRONG — manual user/slot creation in E2E test body
const { token } = await authClient.register(...); // ← belongs in fixture
```

### Phase 4 — Tag correctly

All E2E tests must have `@e2e`. Add additional tags if relevant: `@webhook`, `@smoke`.

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| Verify booking created | UI action + API list check | UI action only, no server check |
| Verify status change | API action + UI render check | API action + API check (no browser) |
| Verify DB state | API action + `dbClient` direct check | API action + API assertion only when DB state differs |
| Test webhook fires | UI/API action + webhookTestServer assertion | Check webhook config exists |

---

## See Also

- `.claude/skills/ui-test-scope/SKILL.md` — when the test only needs the browser
- `utils/dbClient.ts` — direct DB queries for cross-layer DB assertions
- `utils/webhookTestServer.ts` — for webhook cross-layer tests
- `fixtures/index.ts` — available fixtures: user, slot, twoUsersFixture

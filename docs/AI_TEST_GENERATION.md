# AI-Assisted Test Generation — How Claude Helped Shape This Suite

## What this document is

This file records how Claude was used as a QA tool during the design of the `clinic-booking-api-tests` suite. It documents: the exact prompts used, which generated test cases were accepted, which were restructured, and which were discarded — and why.

The goal is not to show that AI wrote the tests. It is to show a controlled, critical approach to using AI in test design: where it added value, where it made wrong assumptions, and where human judgment overrode the output.

---

## Context

The starting point was `CONTRACT_PACK.md` — a structured API contract document covering:

- Error code catalog with HTTP status mappings
- Status transition matrix (pending → confirmed / rejected / cancelled)
- Per-endpoint RBAC rules and error cases
- A 13-item contract-level test checklist

---

## Prompt used

```
You are a QA engineer working on a Node.js clinic booking REST API.
Here is the API contract:

[full contents of CONTRACT_PACK.md pasted here]

Generate a comprehensive list of test cases that would give me confidence
this contract is correctly implemented. Include:
- Happy path tests
- Status transition boundary tests
- RBAC / authorization tests
- Error case tests (404, 409, 422, 401, 403)

For each test, specify: the HTTP method and path, the scenario, the expected
HTTP status code, and the expected errorCode if applicable.
```

---

## Output: what Claude suggested (summarised)

Claude returned approximately 40 proposed test cases across 5 categories. Below is what happened to each group.

---

## Group 1 — Happy path (contract checklist items 1–7)

Claude's suggestions closely matched the contract checklist. All were accepted.

| Contract item | Suggested by Claude | Test file |
|---|---|---|
| Book available slot → 201 pending | Yes | `appointments.mini.j1.test.js` |
| Doctor confirms pending → 200 | Yes | `appointments.confirm.j3.test.js` |
| Doctor rejects pending → 200 | Yes | `appointments.reject.j2.test.js` |
| Patient cancels pending → 200 | Yes | `appointments.cancel.patient.test.js` |
| Patient cancels confirmed → 200 | Yes | `appointments.cancel.patient.test.js` |
| Double booking → 409 SLOT_TAKEN | Yes | `appointments.booking.conflict.test.js` |
| `/my` returns only caller's rows | Yes | `appointments.mini.j1.test.js` |

**Why accepted:** direct mapping to contract. No interpretation needed — if these fail, the contract is broken.

---

## Group 2 — Invalid state transitions (contract checklist items 5, 8)

Claude suggested testing `rejected → confirmed` and `cancelled → cancelled`. Both accepted.

Claude also suggested: `cancelled → confirmed`, `cancelled → rejected`, `pending → pending`. These were accepted in principle but collapsed into a single file (`appointments.invalid-transition.test.js`) rather than separate files per transition.

**What was restructured:** Claude proposed one test per source/target pair. We kept only the highest-signal transitions:

- `confirmed → confirmed` (idempotency illusion — easy to implement wrongly)
- `rejected → confirmed` (attempting to reopen a rejected appointment)
- `cancelled → cancelled` (double cancel — patient may retry after network error)

**Discarded:** `pending → pending`, `rejected → cancelled`, `cancelled → rejected`. The transition matrix already blocks these at the same layer — testing all permutations adds test count without adding coverage of distinct failure modes.

---

## Group 3 — RBAC / authorization

Claude's suggestions were mostly correct but contained one systematic error.

**Accepted:**

- Patient cannot call `/confirm` → 403 (`appointments.rbac.patient.test.js`)
- Patient cannot call `/reject` → 403 (`appointments.rbac.patient.test.js`)
- Doctor cannot access `/my` → 403 (`appointments.rbac.patient.test.js`)
- Patient cannot access `/doctor` → 403 (`appointments.rbac.patient.test.js`)
- Doctor cannot act on another doctor's appointment → 403 (`appointments.rbac.cross-doctor.test.js`)

**Discarded — wrong assumption:**

Claude proposed: *"Unauthenticated user books appointment → 401"*. This looks correct from the contract (`AUTH_REQUIRED → 401`), but the contract also specifies that `FORBIDDEN → 403` is returned when the role is wrong — not when the token is absent. Claude conflated two different authorization failure modes.

The suite already had infrastructure tests covering 401 responses at the auth layer (`infrastructure.test.js`). Adding a duplicate 401 test inside booking flows would not have caught a distinct failure — the middleware is shared. Discarded as redundant.

**Discarded — duplicate coverage:**

Claude suggested testing that a patient cannot create an appointment on behalf of another patient (using a different `patientId` in the body). The contract specifies: *"patient id is always `req.user.id`; request body is ignored."* This is tested implicitly in `appointments.mini.j1.test.js` — the fixture uses the authenticated user's token and the returned appointment always belongs to that user. A separate test for body injection would have tested the same assertion.

---

## Group 4 — Slot management (SLOT_OVERLAP, SLOT_IN_USE)

Claude suggested tests for:

- `POST /doctors/me/slots` with overlapping times → 409 SLOT_OVERLAP
- `DELETE /doctors/me/slots/:id` when active appointment exists → 409 SLOT_IN_USE

**Not implemented in API test layer.** These are valid contract cases, but the slot management endpoints are tested implicitly through the appointment journey fixtures — every test that books an appointment exercises slot creation and availability. Adding dedicated overlap/in-use tests was deprioritised because the risk surface (slot management by doctors) is lower-traffic than the booking flow.

This is a known gap — logged in `SYSTEM_WEAKNESS_REPORT.md` under "missing negative slot tests."

---

## Group 5 — Cases Claude missed entirely

These were not in Claude's output. They were identified through manual contract review and added to the suite.

| Test | Why it wasn't in Claude's output |
|---|---|
| `cancel-as-doctor`: doctor cancels *own* confirmed appointment | Claude only saw standard cancel; missed the separate doctor-cancel endpoint |
| `/appointments/doctor` isolation: doctor sees only own appointments | Claude suggested patient isolation but not the symmetric doctor-side test |
| `EMAIL_RETIRED` on re-register with soft-deleted email | Claude found `EMAIL_TAKEN` but missed the second `409` code for the deleted-account case — it's a non-obvious DB constraint |
| Waitlist auto-promotion after cancellation | Outside the original contract; discovered as a system behaviour gap during implementation review |
| IDOR on `GET /appointments/:id` | Claude found role-based access gaps but did not propose ownership verification — caught separately in `security.test.js` |

---

## What this demonstrates

1. **AI as a starting point, not an authority.** Claude covered ~70% of the obvious contract surface quickly. The remaining 30% — the missed error codes, the symmetric isolation tests, the soft-delete edge case, the IDOR — came from reading the contract more slowly and thinking about failure modes that don't appear in the spec.

2. **Prompt quality matters.** The prompt asked for "confidence the contract is implemented." A prompt asking specifically "what could go wrong with RBAC in this design" would likely have surfaced the IDOR and cross-doctor ownership gap.

3. **Collapse, don't multiply.** Claude proposed a test per state-transition pair (~15 tests). We collapsed to the 3 highest-signal transitions. Fewer tests with clear, distinct coverage signals are more useful than exhaustive permutation coverage that maps to the same code path.

4. **Implicit vs explicit coverage is a conscious choice.** Some Claude suggestions were discarded not because they were wrong, but because the scenario was already covered implicitly. Documenting this choice prevents future reviewers from re-adding the tests.

---

## Key takeaway for interviews

*"I used Claude to accelerate the initial test case generation from the API contract. It surfaced about 70% of the test surface quickly. The remaining 30% — including an unspecified IDOR, a non-obvious second 409 code, and the cross-doctor isolation test — came from manual contract analysis. My job was to decide what to keep, what to collapse, what to discard, and what was missing entirely. The output reflects those decisions, not the raw AI suggestions."*

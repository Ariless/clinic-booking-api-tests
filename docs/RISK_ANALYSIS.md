# Risk analysis — full suite mapping (API + UI + E2E)

**Method:** informal **Impact × Likelihood** (1–5 each) to prioritize tests, not to compute formal RPN. **Source of truth for transitions:** SUT **`CONTRACT_PACK.md`** / OpenAPI.

---

## Risk heatmap

```
         LIKELIHOOD →
          1 (rare)   2          3 (edge)   4          5 (common)
         ┌──────────┬──────────┬──────────┬──────────┬──────────┐
5 ($$)   │    5     │   10     │ ■■ 15    │ ■■ 20    │ ■■■ 25   │  ← double book, RBAC, book path
         ├──────────┼──────────┼──────────┼──────────┼──────────┤
4        │    4     │    8     │ ■■ 12    │ ■■ 16    │   20     │  ← confirm invariant, cancel, RBAC ext
         ├──────────┼──────────┼──────────┼──────────┼──────────┤
3        │    3     │    6     │    9     │   12     │   15     │  ← auth, AI rate limit
         ├──────────┼──────────┼──────────┼──────────┼──────────┤
2        │    2     │    4     │    6     │    8     │   10     │
         ├──────────┼──────────┼──────────┼──────────┼──────────┤
1        │    1     │    2     │    3     │    4     │    5     │  ← cosmetic
         └──────────┴──────────┴──────────┴──────────┴──────────┘
IMPACT ↑

■■■ Score ≥ 20 — must have, in smoke
■■  Score 12–19 — important, in @api / @e2e
    Score < 12 — lower priority
```

---

## 1. Scoring (short)

**Impact:** 5 = money, trust, or legal-class harm; 3 = partial feature loss; 1 = cosmetic.  
**Likelihood:** 5 = common / races; 3 = edge-driven; 1 = rare.

**Score** = Impact × Likelihood (higher = test first).

---

## 2. Matrix

| Risk | I | L | Score | Coverage today |
| --- | :-: | :-: | :-: | --- |
| Double booking same slot | 5 | 5 | 25 | `appointments.booking.conflict.test.js` (`@api`) |
| RBAC / data boundary (wrong role reads data) | 5 | 4 | 20 | `appointments.rbac.doctor.test.js` (`@smoke`) |
| Core book + visible pending / lifecycle | 5 | 4 | 20 | `appointments.mini.j1.test.js` (`@smoke`) — J1 slice to **pending** + `GET …/my` |
| Slot / diary inconsistent after confirm | 4 | 4 | 16 | `appointments.confirm.j3.test.js` (`@api`) |
| Reject branch + slot recovery | 4 | 3 | 12 | `appointments.reject.j2.test.js` (`@api`) |
| Patient cancel + availability | 4 | 3 | 12 | `appointments.cancel.patient.test.js` (`@api`) — **shipped** |
| Waitlist auto-promotion (slot freed → patient booked) | 5 | 4 | 20 | `appointments.waitlist.promotion.test.js` (`@api`) — **shipped** |
| Waitlist duplicate prevention + patient can't delete another's entry | 4 | 3 | 12 | `appointments.waitlist.test.js` (`@api`) — **shipped** |
| Invalid state transition (`422`) | 4 | 3 | 12 | `appointments.invalid-transition.test.js` (`@api`) |
| **Extended RBAC** (patient cannot confirm/reject; doctor cannot act on other doctors’ visits / lists) | 5 | 3 | 15 | `appointments.rbac.patient.test.js`, `appointments.rbac.cross-doctor.test.js` (`@api`) |
| Auth register/login broken | 4 | 2 | 8 | `auth.register.test.js`, `auth.login.test.js` |
| Doctor registration with valid `doctorRecordId` → 201 | 3 | 2 | 6 | `auth.register.test.js` — doctor describe block |
| Doctor list / schema | 3 | 2 | 6 | `doctors.list.test.js` (`@smoke`) |
| GET idempotency — same result on repeated calls | 2 | 1 | 2 | `doctors.list.test.js` (`@api`) — low risk score, high interview value: "I verify HTTP semantics explicitly" |
| AI rate limit (`429 RATE_LIMITED`) | 3 | 2 | 6 | `ai.recommend.test.js` (`@api`) |
| AI feature flag (`ENABLE_AI_RECOMMENDATION=false` → 503) | 3 | 2 | 6 | **Planned** → `ai.recommend.test.js` (requires server restart with flag off) |
| Login rate limit (`429 RATE_LIMITED` after N failed/valid attempts per IP) | 4 | 2 | 8 | `auth.login.test.js` (`@rate-limit`) — **shipped**; requires `RATE_LIMIT_LOGIN_MAX=2 RATE_LIMIT_LOGIN_WINDOW_MS=5000` |
| Register rate limit (`429 RATE_LIMITED` after N attempts per IP) | 3 | 1 | 3 | `auth.register.test.js` (`@rate-limit`) — **shipped**; requires `RATE_LIMIT_REGISTER_MAX=2 RATE_LIMIT_REGISTER_WINDOW_MS=5000` |
| Booking rate limit (`429 RATE_LIMITED` after N booking attempts per IP) | 4 | 2 | 8 | `appointments.booking.rate-limit.test.js` (`@rate-limit`) — **shipped**; requires `RATE_LIMIT_BOOKING_MAX=2 RATE_LIMIT_BOOKING_WINDOW_MS=5000` |
| Chaos mode active but health misreports `disabled` | 3 | 1 | 3 | **Planned** → `chaos.fault-injection.test.js` (`@chaos`) — `GET /health` shape when chaos on |
| Chaos 503 format breaks error contract (missing `errorCode`/`requestId`) | 3 | 1 | 3 | **Planned** → `chaos.fault-injection.test.js` (`@chaos`) — 503 body matches `{ errorCode: "CHAOS_ERROR", message, requestId }` |
| `CHAOS_FAIL_PROBABILITY=0.0` knob broken — chaos fires even when off | 3 | 1 | 3 | **Planned** → `chaos.fault-injection.test.js` (`@chaos`) — probability off-switch |
| Seed non-deterministic — sequence differs across restarts with same seed | 2 | 1 | 2 | **Planned** → `chaos.fault-injection.test.js` (`@chaos`) — two runs same seed → identical pass/fail |
| Chaos bleeds into `/health` / `/metrics` — these must always respond 200 | 4 | 1 | 4 | **Planned** → `chaos.fault-injection.test.js` (`@chaos`) — health/metrics exempt even at `FAIL_PROBABILITY=1.0` |
| Infrastructure health / error contract | 2 | 1 | 2 | `infrastructure.test.js` (`@smoke`) |

---

## 3. UI risks

Pure UI state checks — no API assertions. Tag: `@ui`.

| Risk | I | L | Score | Coverage today |
| --- | :-: | :-: | :-: | --- |
| Guest accesses booking page — gate not shown / form leaks | 4 | 3 | 12 | `tests/ui/patient-guest-booking-gate.test.js` (`@ui`) — **shipped** |
| Login form shows error on wrong credentials | 3 | 3 | 9 | `tests/ui/login.test.js` (`@ui`) — **shipped** |
| Register form shows validation errors on empty submit | 3 | 2 | 6 | `tests/ui/register-patient.test.js` (`@ui`) — **shipped** |

---

## 4. E2E risks

Cross-layer journeys — UI action + API assertion (or vice-versa). Tag: `@e2e`. Workers: 1 (SQLite). See **`E2E_TEST_PLAN.md`** for full spec.

| Risk | I | L | Score | Coverage today |
| --- | :-: | :-: | :-: | --- |
| Patient can complete full booking via UI and appointment is created | 5 | 4 | 20 | `tests/e2e/booking.cross-layer.test.js` (`@e2e`) — **shipped** |
| Guest cannot reach booking form without logging in (navigation + gate) | 4 | 3 | 12 | `tests/ui/patient-guest-booking-gate.test.js` (`@ui`) — **shipped** (gate + link; full redirect flow not implemented in SUT) |
| UI enforces booking conflict — occupied slot shows error | 5 | 3 | 15 | `tests/e2e/booking-conflict.e2e.test.js` (`@e2e`) — **shipped** |
| Doctor confirms via API — patient UI reflects `confirmed` status | 4 | 3 | 12 | `tests/e2e/confirm.cross-layer.test.js` (`@e2e`) — **shipped** |

---

## 5. Interview line per critical row

- **25 — Double book:** “If this regresses, we sell one slot twice — separate test, not buried in happy path.”
- **20 — RBAC:** “Patient token must not read the doctor schedule endpoint — boundary, not a feature polish.”
- **20 — Booking path:** “Without book + visible state, the product does not exist for the user.”
- **16 — Post-confirm slot invariant:** “Confirm is a transition **and** a diary invariant — J3 owns that story.”

---

## 6. How we use this file

When adding a test, ask: **which row moves?** If none, the test is probably low value or belongs in UI/E2E per **`DESIGN_PRINCIPLES.md`**.

When a test fails in CI, map the failure to a **row** and communicate **business harm**, not only assertion text.

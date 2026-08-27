# Risk analysis — full suite mapping (API + UI + E2E)


<!-- sut-refs-notice -->
> **Referenced but living in the SUT repository:** `CONTRACT_PACK.md` — see *System under test* in `README.md`.

**Method:** informal **Impact × Likelihood** (1–5 each) to prioritize tests, not to compute formal RPN. **Source of truth for transitions:** SUT **`CONTRACT_PACK.md`** / OpenAPI.

---

## Risk heatmap

```
         LIKELIHOOD →
          1 (rare)   2          3 (edge)   4          5 (common)
         ┌──────────┬──────────┬──────────┬──────────┬──────────┐
5 ($$)   │    5     │   10     │ ■■ 15    │ ■■ 20    │ ■■■ 25   │  ← double book, RBAC, book path, AI route identity
         ├──────────┼──────────┼──────────┼──────────┼──────────┤
4        │    4     │    8     │ ■■ 12    │ ■■ 16    │   20     │  ← confirm invariant, cancel, RBAC ext
         ├──────────┼──────────┼──────────┼──────────┼──────────┤
3        │    3     │    6     │    9     │   12     │   15     │  ← auth, AI rate limit, PHI exits, cassette identity
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
| Double booking same slot | 5 | 5 | 25 | `appointments.booking.conflict.test.ts` (`@api`) |
| RBAC / data boundary (wrong role reads data) | 5 | 4 | 20 | `appointments.rbac.patient.test.ts` + `appointments.rbac.cross-doctor.test.ts` (`@smoke`) |
| Core book + visible pending / lifecycle | 5 | 4 | 20 | `appointments.mini.j1.test.ts` (`@smoke`) — J1 slice to **pending** + `GET …/my` |
| Slot / diary inconsistent after confirm | 4 | 4 | 16 | `appointments.confirm.j3.test.ts` (`@api`) |
| Reject branch + slot recovery | 4 | 3 | 12 | `appointments.reject.j2.test.ts` (`@api`) |
| Patient cancel + availability | 4 | 3 | 12 | `appointments.cancel.patient.test.ts` (`@api`) — **shipped** |
| Waitlist auto-promotion (slot freed → patient booked) | 5 | 4 | 20 | `appointments.waitlist.promotion.test.ts` (`@api`) — **shipped** |
| Waitlist duplicate prevention + patient can't delete another's entry | 4 | 3 | 12 | `appointments.waitlist.test.ts` (`@api`) — **shipped** |
| Invalid state transition (`422`) | 4 | 3 | 12 | `appointments.invalid-transition.test.ts` (`@api`) |
| **Extended RBAC** (patient cannot confirm/reject; doctor cannot act on other doctors’ visits / lists) | 5 | 3 | 15 | `appointments.rbac.patient.test.ts`, `appointments.rbac.cross-doctor.test.ts` (`@api`) |
| Auth register/login broken | 4 | 2 | 8 | `auth.register.test.ts`, `auth.login.test.ts` |
| Doctor registration with valid `doctorRecordId` → 201 | 3 | 2 | 6 | `auth.register.test.ts` — doctor describe block |
| Doctor list / schema | 3 | 2 | 6 | `doctors.list.test.ts` (`@smoke`) |
| GET idempotency — same result on repeated calls | 2 | 1 | 2 | `doctors.list.test.ts` (`@api`) — low risk score, high interview value: "I verify HTTP semantics explicitly" |
| AI rate limit (`429 RATE_LIMITED`) | 3 | 2 | 6 | `ai.recommend.test.ts` (`@api`) |
| AI feature flag (`ENABLE_AI_RECOMMENDATION=false` → 503) | 3 | 2 | 6 | `ai.recommend.test.ts` (`@api`) — shipped |
| RAG: response schema `{ specialty, reasoning }` always present | 4 | 2 | 8 | **shipped** — the shape is now a request parameter (`output_config.format`, `enum`), not a hope → `ai.recommend.test.ts` (`@rag`); skip without `ANTHROPIC_API_KEY` |
| RAG: hallucination — model recommends specialty not in knowledge base | 4 | 2 | 8 | **shipped** — structurally prevented by the schema enum, and re-checked after the answer because the service is a separate deployable → `ai.recommend.test.ts` (`@rag`); context grounding assertion |
| RAG: prompt injection in symptoms field hijacks recommendation | 4 | 1 | 4 | **shipped** → `ai.recommend.test.ts` (`@rag`); adversarial inputs |
| RAG: Claude unavailable → graceful 503, not unhandled exception | 4 | 1 | 4 | **shipped** → `ai.recommend.test.ts` (`@rag`); wrong API key simulation |
| Login rate limit (`429 RATE_LIMITED` after N failed/valid attempts per IP) | 4 | 2 | 8 | `auth.login.test.ts` (`@rate-limit`) — **shipped**; requires `RATE_LIMIT_LOGIN_MAX=2 RATE_LIMIT_LOGIN_WINDOW_MS=5000` |
| Register rate limit (`429 RATE_LIMITED` after N attempts per IP) | 3 | 1 | 3 | `auth.register.test.ts` (`@rate-limit`) — **shipped**; requires `RATE_LIMIT_REGISTER_MAX=2 RATE_LIMIT_REGISTER_WINDOW_MS=5000` |
| Booking rate limit (`429 RATE_LIMITED` after N booking attempts per IP) | 4 | 2 | 8 | `appointments.booking.rate-limit.test.ts` (`@rate-limit`) — **shipped**; requires `RATE_LIMIT_BOOKING_MAX=2 RATE_LIMIT_BOOKING_WINDOW_MS=5000` |
| Chaos mode active but health misreports `disabled` | 3 | 1 | 3 | **shipped** → `chaos.test.ts` (`@chaos`) — `GET /health` shape when chaos on |
| Chaos 503 format breaks error contract (missing `errorCode`/`requestId`) | 3 | 1 | 3 | **shipped** → `chaos.test.ts` (`@chaos`) — 503 body matches `{ errorCode: "CHAOS_ERROR", message, requestId }` |
| `CHAOS_FAIL_PROBABILITY=0.0` knob broken — chaos fires even when off | 3 | 1 | 3 | **shipped** → `chaos.test.ts` (`@chaos`) — probability off-switch |
| Seed non-deterministic — sequence differs across restarts with same seed | 2 | 1 | 2 | **shipped** → `chaos.test.ts` (`@chaos`) — two runs same seed → identical pass/fail |
| Chaos bleeds into `/health` / `/metrics` — these must always respond 200 | 4 | 1 | 4 | **shipped** → `chaos.test.ts` (`@chaos`) — health/metrics exempt even at `FAIL_PROBABILITY=1.0` |
| Patient symptoms (health data about an identified person) reach the log stream, an error body, or a third party | 5 | 3 | 15 | three files added 2026-08-26 — `sut/src/__tests__/aiPrivacy.test.js`, `aiServicePrivacy.test.js`, `tests/unit/bug-reporter.redaction.test.ts` — twenty tests between them. Two of the three exits were already correct and guarded by nothing; the reporter one was a real leak |
| The model is reached on behalf of an unidentified caller — unbounded cost, no attribution (OWASP ASI03) | 5 | 4 | 20 | `security.agentic.test.ts` (`@security`) — `requireAuth` added 2026-08-27; the route had answered 200 with no `Authorization` header at all |
| Retrieval corpus poisoned through a data-file change — a newline in a description buys extra prompt lines (ASI06) | 4 | 2 | 8 | `tests/unit/knowledge-integrity.test.ts` (`@unit`) — offline by design: the check has to run before the row is sent |
| A second deployable returns a specialty outside the allow-list and the SUT queries for it (ASI04) | 4 | 2 | 8 | `sut/src/__tests__/aiSupplyChain.test.js` — the refused value must never become a database query |
| An agent reaches a tool its session was not given (ASI02) | 4 | 2 | 8 | `sut/src/__tests__/mcpServer.test.js` — tools outside the profile are never registered, so there is nothing to refuse |
| Replayed model responses answer the wrong question — false green that is also *fast* | 5 | 3 | 15 | `tests/unit/claude-cassette.test.ts` — found live: 8/8 green in 2.1s on answers recorded for other prompts (`TST-09`) |
| The circuit breaker never opens under a real outage cascade (ASI08) | 4 | 2 | 8 | `sut/src/__tests__/aiCircuitBreaker.test.js` — 16 tests, added 2026-08-27; states through a mock plus the route in `CLAUDE_DEGRADE` |
| The breaker opens during normal operation — it counts failures over the process lifetime, not consecutive ones | 4 | 3 | 12 | **open** — found by the test above; behaviour pinned as-is, `SYSTEM_WEAKNESS_REPORT.md` §12.6 |
| Infrastructure health / error contract | 2 | 1 | 2 | `infrastructure.test.ts` (`@smoke`) |

---

## 3. UI risks

Pure UI state checks — no API assertions. Tag: `@ui`.

| Risk | I | L | Score | Coverage today |
| --- | :-: | :-: | :-: | --- |
| Guest accesses booking page — gate not shown / form leaks | 4 | 3 | 12 | `tests/ui/guest-gates.test.ts` (`@ui`) — **shipped** |
| Login form shows error on wrong credentials | 3 | 3 | 9 | `tests/ui/login.test.ts` (`@ui`) — **shipped** |
| Register form shows validation errors on empty submit | 3 | 2 | 6 | `tests/ui/register-patient.test.ts` (`@ui`) — **shipped** |

---

## 4. E2E risks

Cross-layer journeys — UI action + API assertion (or vice-versa). Tag: `@e2e`. Workers: 1 (SQLite).

| Risk | I | L | Score | Coverage today |
| --- | :-: | :-: | :-: | --- |
| Patient can complete full booking via UI and appointment is created | 5 | 4 | 20 | `tests/e2e/booking.cross-layer.test.ts` (`@e2e`) — **shipped** |
| Guest cannot reach booking form without logging in (navigation + gate) | 4 | 3 | 12 | `tests/ui/guest-gates.test.ts` (`@ui`) — **shipped** (gate + link; full redirect flow not implemented in SUT) |
| UI enforces booking conflict — occupied slot shows error | 5 | 3 | 15 | `tests/e2e/booking-conflict.e2e.test.ts` (`@e2e`) — **shipped** |
| Doctor confirms via API — patient UI reflects `confirmed` status | 4 | 3 | 12 | `tests/e2e/confirm.cross-layer.test.ts` (`@e2e`) — **shipped** |

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

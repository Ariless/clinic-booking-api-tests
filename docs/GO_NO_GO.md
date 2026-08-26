# Release recommendation — Clinic Booking API v1

**Date:** 2026-05-12  
**Prepared by:** QA  
**Cycle covered:** 2026-04-28 → 2026-05-12  
**Test suite:** 7 layers — smoke, API, E2E, UI, unit, security, performance  
**Total test cases:** 111 automated + 408 Schemathesis-generated scenarios

> **This is a dated snapshot, deliberately not rewritten** (noted 2026-08-21). A go/no-go call is
> evidence about the state of a system on the day it was made; updating its counts to today's would
> destroy exactly what makes it useful. For current numbers see `README.md` and `docs/RTM.md`; for
> the current bug register see `docs/KNOWN_ISSUES.md`.

---

## Recommendation

> **Conditional Go.**
>
> The core booking system is ready for production. The AI symptom checker requires a product decision on two open issues before it can be considered generally available. The reschedule feature is implemented in the backend and UI but has no automated test coverage — it should be treated as a controlled rollout.

---

## What this covers

| Feature area | Test coverage | Confidence |
|---|---|---|
| Appointment lifecycle (book / confirm / reject / cancel) | Full — API + E2E + concurrency + DB state | High |
| Reschedule | Backend implemented, 0 automated tests | Low — controlled rollout only |
| Waitlist + auto-promotion | Full — API + E2E + DB state | High |
| RBAC + authentication | Full — patient / doctor separation + JWT | High |
| Real-time notifications (WebSocket) | Full — API + E2E browser | High |
| AI symptom checker | Full schema / invariant / security coverage; 2 open correctness bugs | Medium |
| Payments / consultations | Full — idempotency + failure modes | High |
| Performance under load | 50 VUs, p95 < 200ms, < 1% error rate | High |
| Security | IDOR, BOLA, JWT tamper — all covered; 1 open spec violation | Medium–High |
| Accessibility | WCAG 2.1 AA — all structural violations fixed | High (1 known design debt) |

---

## What was found during this cycle

### Fixed (4 bugs)

| ID | Issue | Severity | Found by |
|---|---|---|---|
| B-01 | IDOR — `GET /appointments/:id` accessible without authentication | **High** | `security.test.ts` |
| B-02 | Missing `<main>` landmark and `<h1>` on login, register, booking pages | Medium | `accessibility.test.ts` |
| B-03 | Doctor WebSocket never connected in browser (`window.ClinicCore` undefined) | **High** | `doctor-notifications.e2e.test.ts` |
| B-04 | Confirm success banner hidden in < 1ms (timing race) | Low | `doctor-confirm.e2e.test.ts` |

All four were caught by automated tests and fixed during the cycle. Two were high severity — both required E2E or security tests to surface; API tests alone missed them.

---

### Open — product decision required

**B-05 — Symptom checker misroutes short cardiac descriptions**

Brief input like "chest pain" scores Orthopedist higher than Cardiologist in the retrieval layer. The patient receives a valid-looking recommendation for the wrong specialist.

- Severity: Medium
- Visible in: mock mode; partially corrected by the LLM in real Claude mode
- Options: (A) improve retrieval term weighting; (B) require minimum symptom detail before showing a recommendation
- **Blocker for AI general availability — not a blocker for core booking**

**B-06 — AI recommends specialties with no doctors in the system**

Orthopedist and Pediatrician appear in the knowledge base but have no seeded doctors. A valid `200` response can include `doctors: []` — the patient sees a recommendation but cannot book.

- Severity: Medium
- Options: (A) seed all 6 specialties with doctors; (B) return `404 DOCTORS_UNAVAILABLE` instead of silent empty array — more honest API contract
- **Blocker for AI general availability — not a blocker for core booking**

---

### Open — test infrastructure (not product blockers)

| ID | Issue | Impact |
|---|---|---|
| CI-01 | Rate limit test gets `400` instead of `429` in CI — env variable mismatch | CI only; test skipped; not a product bug |
| CI-02 | Flaky `SLOT_OVERLAP` in waitlist offers fixture — shared seed timestamps | Intermittent CI failure; test isolation gap, not a product bug |

---

### Found by fuzzing — spec violations (not release blockers)

Schemathesis (2026-05-12) generated 408 test scenarios from the OpenAPI spec and found:

- **Malformed JWT → `400 <EMPTY>`** — when the Authorization header contains invalid-format bytes, the middleware returns 400 with no body, breaking the error contract. Medium severity. Fix: catch JWT parse errors in middleware and return `401` with standard error body.
- ~~**TRACE method → `404` instead of `405`**~~ — fixed 2026-08-26; the defect was wider than TRACE (no path returned `405` under any method), see SYSTEM_WEAKNESS_REPORT §5.2.
- **`401` not documented in spec for auth-required endpoints** — spec gap, not a runtime bug.

None of these are release blockers. The malformed JWT case is worth fixing in the next dev cycle.

---

## Conditions for full Go

The following must be resolved before the AI symptom checker goes to general availability:

1. **Product decision on B-05** — retrieval scoring improvement or UX guard for short input
2. **Product decision on B-06** — either seed all specialties or change `200 + doctors: []` to a proper error response

The following should be completed before the reschedule feature is considered stable:

3. **Reschedule test suite** — 12 test cases specified in `../BACKLOG.md`; blocked on TypeScript migration

---

## Post-release monitoring

If released today, watch for the following signals in production:

| Signal | What it means | Where to look |
|---|---|---|
| Spike in `422 UNKNOWN_SPECIALTY` on AI endpoint | Model returning a specialty not in the knowledge base — context grounding failing | Loki: `event=ai.recommendation.error` |
| `doctors: []` in AI responses | B-06 manifesting in production — wrong specialty recommended | Loki: `event=ai.recommendation` + `doctors.length=0` |
| `500` on any authenticated route | Malformed JWT middleware bug (B-05 finding) surfacing from unusual clients | Loki: `level=error` + `event=auth` |
| Reschedule `409 SLOT_TAKEN` rate > 5% | Concurrent reschedule contention — may need UX slot-hold | Metrics: `appointments_rescheduled_total` vs 409 rate |

---

## What I would not ship

- The AI feature in general availability until B-05 and B-06 have product decisions
- The reschedule feature without automated test coverage covering the concurrency path (old slot freed + new slot booked atomically under load)

---

## Notes on test confidence

The two highest-severity bugs (B-01 IDOR, B-03 WebSocket) were found by automated tests — not by manual review. B-01 required a security test that expected `401` and got `200`. B-03 required an E2E test that opened a real browser — three passing API-layer WebSocket tests gave false confidence. This confirms the value of multi-layer coverage: API tests and E2E tests fail independently, and both are necessary.

The malformed JWT finding (Schemathesis) demonstrates that manual test design has systematic blind spots. A fuzzer reached an input space that no developer would think to test — and found an error contract violation in the middleware layer that 111 existing tests completely missed.

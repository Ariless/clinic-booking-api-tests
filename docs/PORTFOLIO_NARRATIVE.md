# Portfolio narrative — how to tell this project in an interview

This document is for interview preparation. It gives you a 2-3 minute story, answers to common questions, and what to show on screen.

---

## The 2-minute story (lead with this)

> "I built a full test engineering system around a real REST API — not a demo site, but a clinic booking service I wrote myself in Node.js. The idea was to create a realistic system with actual failure modes: double bookings, RBAC boundaries, waitlist auto-promotion, chaos injection — and then build a test suite that proves the system holds its invariants.
>
> The suite has four layers: API contract tests, UI tests, cross-layer E2E tests, and a k6 performance baseline that runs 50 virtual users against the booking flow with p95 latency thresholds. Everything runs in CI — smoke gates the rest, API and E2E run in parallel, and Allure publishes results to GitHub Pages after every push.
>
> What I'm most proud of is the depth of the test design. I have a risk analysis that maps business harm to test files, a concurrency suite that fires simultaneous cancel requests and proves the state machine holds, a chaos mode that injects 503s at the middleware layer, security tests that caught a real IDOR vulnerability, accessibility tests that found missing landmark structure — and a system weakness report that documents where the architecture is vulnerable and how each gap is covered."

---

## What to show (in this order)

1. **Allure report** (GitHub Pages) — start here, shows CI results and test history
2. **README** — failure detection model, architecture diagram, why this repo exists
3. **RISK_ANALYSIS.md** — risk heatmap + matrix mapped to test files
4. **One test file** — `appointments.concurrency.test.js` or `appointments.waitlist.promotion.test.js` — shows test depth
5. **SYSTEM_WEAKNESS_REPORT.md** — shows system thinking; point to §3.2 (IDOR found + fixed) and §3.4 (a11y found + fixed)
6. **Buggy branch demo** — `git checkout buggy`, run tests, show 18 failures, `git checkout main`
7. **security.test.js** — show the two tests that failed before the fix, explain what they caught
8. **k6/booking-flow.js** — show the load test script; explain setup() auth, 409 tolerance, per-endpoint thresholds

---

## Common interview questions

### "Tell me about your test automation project"
Use the 2-minute story above. Lead with "real SUT, not a demo site."

### "What did you find? Did your tests catch any real bugs?"
> "Two kinds of findings. First, I built a buggy branch with six intentional defects — the suite catches five cleanly. Second, I wrote security and accessibility tests against the live SUT and found real vulnerabilities I hadn't planted. `GET /appointments/:id` had no authentication and no ownership check — any unauthenticated user could read any appointment by ID. My security test caught it: expected 401, got 200. I fixed the route, added `requireAuth` and an ownership check, tests went green. The accessibility tests found missing landmark structure on three pages — fixed those too. Finding unintentional bugs with your own tests is a stronger signal than a buggy branch, because you didn't know they were there."

### "Why did you build your own API instead of testing an existing one?"
> "Because testability is a design property, not an afterthought. I wanted to show I understand both sides — building the system with stable `data-qa` selectors, structured error codes, and feature flags, and then testing against that contract. Most QA portfolios test things they didn't build. I tested something I understood end to end."

### "Did you do any security or accessibility testing?"
> "Yes — both. For security, I wrote IDOR tests and JWT manipulation tests. Two of them caught a real vulnerability: `GET /appointments/:id` had no auth and no ownership check. Any unauthenticated user could read any appointment by ID. I fixed the route in the SUT — added `requireAuth` and an ownership check — and the tests went green. For accessibility, I integrated axe-core with Playwright and ran it against three pages. It found missing landmark structure and a missing heading on the booking page. Fixed those in the HTML, documented the color contrast issue as known design debt with a reason why it was excluded."

### "Did you do any performance testing?"
> "Yes — I wrote a k6 load test for the core booking flow. It runs 50 virtual users against three endpoints: list doctors, get slots, and book an appointment. I authenticate once in `setup()` and share the JWT across all VUs — that's the realistic model, a user logs in once and stays logged in. I set thresholds: p95 under 200ms for read endpoints, under 500ms for the booking write. One interesting design decision: under 50 concurrent users racing for the same slots, most get `409 SLOT_TAKEN`. That's correct business behavior, not an error — so I explicitly mark it as expected so it doesn't inflate the error rate metric."

### "How do you know your tests are good?"
> "Three ways. First, I have a buggy branch — six intentional defects, the suite catches five. Second, I ran Stryker mutation testing: 92% mutation score, 12 of 13 mutants killed. Stryker automatically mutates the source code — flips conditions, removes returns, changes values — and measures how many mutations the test suite catches. The one survivor is an ArrayDeclaration mutation where Stryker injects an artificial string into an empty array; no real test can kill it without asserting against 'Stryker was here', so it's a known tool limitation, not a logic gap. Third, security and accessibility tests found real unintentional bugs — finding bugs you didn't plant is a stronger signal than a controlled demo."

### "How do you verify the API response is consistent with the database?"
> "I have a separate test file with direct DB assertions. After each API call I query the SQLite database file with `better-sqlite3` and verify the persisted state, not just the HTTP response. For example: after a patient cancels, I assert the API returns 200, then I read the slot row directly from the DB and check `isAvailable = 1`, and read the appointment row and check `status = 'cancelled'`. The most interesting test is the waitlist promotion one: patient A cancels, which should auto-promote patient B from the waitlist — I assert the waitlist entry is deleted in the DB and a new pending appointment for patient B exists. The API response alone can't tell you whether the promotion actually happened in the database."

### "Did you write unit tests? I thought you were doing API tests."
> "Both. The API tests cover the system end-to-end — booking, RBAC, state transitions. But for mutation testing to work efficiently, I needed a pure function I could mutate without a running database. So I extracted the appointment state machine — the logic that decides which status can transition to which — into an isolated function and wrote 14 Jest unit tests for it. That's not a developer decision, it's a testability decision: when validation logic is buried inside SQL transactions, you can't test it in isolation or run Stryker against it meaningfully."

### "What would you do differently?"
> "Migrate to TypeScript — it's already planned and in progress. The framework is JavaScript because that's what I know well, and I didn't want to pretend otherwise. But for a team running TypeScript, I'd migrate. I'd also add Pact contract testing for the AI recommendation endpoint to make the consumer contract explicit."

### "What's the hardest test you wrote?"
> "The concurrent waitlist promotion test. Two patients cancel simultaneously, one patient is in the waitlist queue. The test asserts that the queue patient is promoted exactly once — not twice. This validates that `promoteFromWaitlist` is truly atomic inside the transaction. It's the kind of test that would catch a real double-booking incident before it reaches production."

### "How do you handle flaky tests?"
> "I treat flakiness as a bug in the suite, not in the product. My tests use deterministic data — each test registers its own user with a unique timestamp email, creates its own slot in a non-overlapping time window. There's no shared mutable state between tests, so there's nothing to race on. If a test flakes, I investigate the root cause — it's usually a missing `await` or a timing assumption."

---

## What NOT to say

- Don't say "I have 100% coverage" — you don't measure line coverage, you measure risk coverage
- Don't apologize for JavaScript — say "same language as the SUT, same engineering habits"
- Don't call it a "learning project" — call it a "portfolio project" or "quality engineering system"
- Don't oversell TypeScript migration — say it's planned, not done
- Don't say "I refactored the SUT" — say "I extracted logic to make it testable"; testability is a QA concern

---

## Numbers to know

Run `npm run test:count` before the interview for the current number. Typical breakdown:
- API tests: ~20 files, ~40+ test cases
- Mutation score: **92%** (12/13 mutants killed) — `npm run test:mutation` in SUT
- UI tests: 3 files
- E2E tests: 3 files
- Smoke subset: ~8 tests, runs in ~1-3s locally
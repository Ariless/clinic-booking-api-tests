# UI + E2E test plan — clinic-booking-api-tests

Risk-based. UI tests check page-level state. E2E tests cross the UI↔API boundary.

**Tags:** `@ui` (pure UI), `@e2e` (cross-layer).  
**Workers:** 1 for all UI/E2E (SQLite — no parallel writes).  
**Page Objects:** `pages/` — extend when a new page is first touched by a test.

---

## UI tests (`tests/ui/`)

| ID | File | What | Risk |
| -- | ---- | ---- | ---- |
| U1 | `patient-guest-booking-gate.test.js` | Guest hits `/patient/booking` — gate visible, form hidden, link → `/login` | ✅ shipped |
| U2 | `login.test.js` | Wrong credentials → error message visible on page | ✅ shipped |
| U3 | `register-patient.test.js` | Empty form submit → validation errors shown | ✅ shipped |

---

## E2E tests (`tests/e2e/`)

Each test owns its data (seed login or register + teardown). API calls use `request` fixture directly — no Page Object for API layer.

| ID | File | Journey | Risk |
| -- | ---- | ------- | ---- |
| E1 | `booking.cross-layer.test.js` | Patient logs in via UI → selects specialty/doctor/slot → books → `GET /appointments/my` confirms `pending` | ✅ shipped |
| E2 | `booking-conflict.e2e.test.js` | Book slot via API (patient A) → patient B tries to book same slot via UI → conflict error shown | ✅ shipped |
| E3 | `confirm.cross-layer.test.js` | Book via API → doctor confirms via API → patient opens appointments UI → status shows `confirmed` | ✅ shipped |

---

## Interview lines

- **E1 (cross-layer booking):** "The API tests prove the contract; E1 proves the UI speaks that contract correctly — a gap the API suite can't catch."
- **E4 (conflict via UI):** "Double booking is the highest-risk scenario in the domain. E4 adds a UI layer on top of the API conflict test — different path, same invariant."
- **E5 (state in UI after API action):** "State machine transitions happen at the API. E5 verifies the UI reflects them — cross-layer consistency is the story."
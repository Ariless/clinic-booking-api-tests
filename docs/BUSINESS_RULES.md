# Business Rules — clinic-booking-api

Single source of truth for domain rules enforced by the system. Written for **test design and acceptance criteria** — not a user manual. Each rule is testable: a rule without a test is a gap.

**Sources:** `CONTRACT_PACK.md`, `API_ENDPOINTS.md`, `openapi/openapi.yaml`, test suite behaviour, code review.  
**Companion:** `KNOWN_ISSUES.md` (where rules are broken), `TEST_STRATEGY.md` §State machine (transition diagram).

---

## 1. Accounts

| # | Rule |
|---|---|
| A-01 | Email is unique system-wide, case-insensitive. Duplicate → `409 EMAIL_TAKEN`. |
| A-02 | A soft-deleted email cannot be reused. Attempt → `409 EMAIL_RETIRED`. |
| A-03 | Role is set at registration (`patient` or `doctor`) and cannot be changed. |
| A-04 | Password: 6–72 UTF-8 bytes. Email: valid format, max 254 chars. Name: max 120 chars. |
| A-05 | Doctor registration requires `doctorRecordId` (links account to the doctor directory). Not validated against actual records — known gap (see `KNOWN_ISSUES.md` D-02). |
| A-06 | Registration returns `201` + access token + refresh token. |
| A-07 | Access token lifetime: 1 hour. Refresh token lifetime: 7 days. |
| A-08 | `401` responses must trigger a refresh attempt (`POST /auth/refresh`) before giving up — implemented in UI (`app-core.js`). |

---

## 2. Appointments — booking

| # | Rule |
|---|---|
| B-01 | Only a patient JWT can book an appointment. |
| B-02 | Booking body contains only `slotId`. Patient identity always comes from JWT — a patient cannot book on behalf of another patient. |
| B-03 | A new appointment always starts in status `pending`. |
| B-04 | A slot must exist and be available (`isAvailable = 1`). Unavailable → `409 SLOT_TAKEN`. Missing → `404 SLOT_NOT_FOUND`. |
| B-05 | No two active appointments can exist for the same slot simultaneously. Enforced by both application logic and a DB unique index. |

---

## 3. Appointments — state machine

Allowed transitions only. All other transitions → `422 INVALID_TRANSITION`.

| From | To | Who |
|---|---|---|
| `pending` | `confirmed` | Doctor who owns the slot |
| `pending` | `rejected` | Doctor who owns the slot |
| `pending` | `cancelled` | Patient who owns the appointment, OR doctor who owns the slot |
| `confirmed` | `cancelled` | Patient who owns the appointment, OR doctor who owns the slot |
| `pending` / `confirmed` | `pending` | Patient (reschedule — see §7) |

**Terminal states:** `cancelled` and `rejected` — no further transitions permitted.

| # | Rule |
|---|---|
| SM-01 | A doctor can only act on appointments that are on their own slots. |
| SM-02 | A patient can only cancel their own appointment. |
| SM-03 | Reject frees the slot (`isAvailable = 1`) immediately. |
| SM-04 | Cancel (patient or doctor) frees the slot immediately and triggers waitlist promotion (see §5). |
| SM-05 | Confirm does **not** free the slot — slot remains unavailable while the appointment is confirmed. |

---

## 4. Slots

| # | Rule |
|---|---|
| SL-01 | Only a doctor with a linked `doctorRecordId` can create or delete slots. |
| SL-02 | A doctor's slots cannot overlap in time. Overlap → `409 SLOT_OVERLAP`. Half-open interval `[start, end)` — adjacent slots (`end === next start`) are allowed. |
| SL-03 | Slots from different doctors may share the same time window. |
| SL-04 | A slot with an active (`pending` or `confirmed`) appointment cannot be deleted. → `409 SLOT_IN_USE`. |
| SL-05 | Deleting a slot clears its historical `cancelled` and `rejected` appointment rows. |
| SL-06 | `GET /doctors/:id/slots` (public) returns only available slots. `GET /doctors/me/slots` (doctor) returns all slots including booked ones. |

---

## 5. Waitlist

| # | Rule |
|---|---|
| WL-01 | Waitlist is **per-doctor**, not per-slot. A patient joins the queue for a doctor — the specific slot is assigned when one becomes free. |
| WL-02 | Order is **FIFO** by join time. When a slot frees, the oldest entry for that doctor is promoted. |
| WL-03 | One entry per patient-doctor pair. Duplicate join → `409 WAITLIST_DUPLICATE`. |
| WL-04 | **Auto-promotion**: when any slot frees for a doctor (cancel, reject, reschedule), the oldest waitlist entry is atomically converted to a new `pending` appointment on that slot. This happens inside the same database transaction as the cancellation. |
| WL-05 | A patient can remove their own waitlist entry at any time (`DELETE /waitlist/:id`). |
| WL-06 | A patient cannot remove another patient's waitlist entry. → `403 FORBIDDEN`. |
| WL-07 | Promotion is exactly-once: the same waitlist entry cannot produce two appointments. Guaranteed by the atomic transaction boundary. |

---

## 6. Waitlist offers

When a promoted patient already has an active booking with that doctor, the system creates a **pending offer** instead of booking directly.

| # | Rule |
|---|---|
| WO-01 | A patient can accept an offer — their existing appointment is cancelled and the new slot is booked. |
| WO-02 | A patient can decline an offer — the slot is freed again and the patient remains on the waitlist. |
| WO-03 | Accepting an offer that has already been resolved → `409`. Double-accept is blocked. |
| WO-04 | A patient cannot accept or decline another patient's offer. → `403 FORBIDDEN`. |

---

## 7. Reschedule

| # | Rule |
|---|---|
| R-01 | Only a patient can reschedule their own appointment. |
| R-02 | Reschedule is allowed from `pending` or `confirmed`. Not from `cancelled` or `rejected` → `422 INVALID_TRANSITION`. |
| R-03 | The new slot must belong to the **same doctor**. Different doctor → `422 DOCTOR_MISMATCH`. |
| R-04 | The new slot cannot be the same as the current slot → `422 SAME_SLOT`. |
| R-05 | The new slot must be available → `409 SLOT_TAKEN`. |
| R-06 | After reschedule, the appointment status **always resets to `pending`**. The doctor must re-confirm even if the appointment was previously confirmed. |
| R-07 | Reschedule is atomic: (1) free old slot, (2) trigger waitlist promotion on old slot, (3) book new slot — all in one transaction. Failure at any step rolls back everything. |

---

## 8. Auto-expiry

| # | Rule |
|---|---|
| AE-01 | Background timer cancels `pending` appointments older than `AUTO_EXPIRE_PENDING_MAX_AGE_MS` (default: 7 days). Disabled when `AUTO_EXPIRE_PENDING_INTERVAL_MS = 0`. |
| AE-02 | Only `pending` appointments expire. `confirmed` appointments are never auto-expired. |
| AE-03 | Expiry frees the slot (`isAvailable = 1`). |

---

## 9. RBAC summary

| Action | Patient | Doctor (own) | Doctor (other) | Unauthenticated |
|---|---|---|---|---|
| Book appointment | ✅ | ❌ | ❌ | ❌ |
| View own appointments | ✅ | — | — | ❌ |
| View doctor's appointments | ❌ | ✅ | ❌ | ❌ |
| View one appointment by ID | ✅ (own only) | ✅ (own slot) | ❌ | ❌ |
| Cancel appointment | ✅ (own) | ✅ (own slot) | ❌ | ❌ |
| Confirm appointment | ❌ | ✅ (own slot) | ❌ | ❌ |
| Reject appointment | ❌ | ✅ (own slot) | ❌ | ❌ |
| Reschedule appointment | ✅ (own) | ❌ | ❌ | ❌ |
| Create / delete slots | ❌ | ✅ | ❌ | ❌ |
| Join / leave waitlist | ✅ | ❌ | ❌ | ❌ |
| View own waitlist | ✅ | — | — | ❌ |
| View doctor waitlist | ❌ | ✅ (own) | ❌ | ❌ |
| Use AI recommendation | ✅ | ✅ | ✅ | ❌ |

---

## 10. AI recommendation

| # | Rule |
|---|---|
| AI-01 | Feature-flagged: `ENABLE_AI_RECOMMENDATION=false` → `503 FEATURE_DISABLED`. |
| AI-02 | Requires authentication (any role). |
| AI-03 | `symptoms` field is required and must be non-empty. Empty → `400 VALIDATION_ERROR`. |
| AI-04 | Response specialty must always be from the system's known specialty list. The model is constrained — it cannot hallucinate a specialty that doesn't exist in the knowledge base. |
| AI-05 | If symptoms cannot be mapped to any known specialty → `422 UNKNOWN_SPECIALTY`. |
| AI-06 | Rate limit: 5 requests per token+IP hash per 60 seconds (default). → `429 RATE_LIMITED`. |
| AI-07 | If Claude API is unavailable → `503 CLAUDE_UNAVAILABLE`. |
| AI-08 | `symptoms` max length is 500 characters. Exceeding → `400 VALIDATION_ERROR`. Input is rejected before reaching the retrieval or Claude layer. |

---

## 11. Payments & consultations

| # | Rule |
|---|---|
| P-01 | Feature-flagged: `PAYMENT_MODE=disabled` (default) → `503 FEATURE_DISABLED`. |
| P-02 | Payment failure → `402 PAYMENT_REQUIRED`. No consultation record is created. |
| P-03 | A payment record is always written, whether the charge succeeded or failed. |
| P-04 | Idempotency key (`X-Idempotency-Key` header): same key always returns the same result without re-charging. |

---

## 12. Rate limits

| Endpoint | Default limit | Window | Key |
|---|---|---|---|
| `POST /auth/login` | 10 attempts | 15 minutes | IP |
| `POST /auth/register` | 5 attempts | 1 hour | IP |
| `POST /appointments` | 20 attempts | 1 minute | IP |
| `POST /ai/recommend-doctor` | 5 attempts | 1 minute | IP + token hash |

All rate limit responses: `429 RATE_LIMITED`.  
`TRUST_PROXY=true` required for correct IP detection behind a reverse proxy.

---

## 13. Error contract

| # | Rule |
|---|---|
| E-01 | All non-2xx responses use the same JSON shape: `{ errorCode, message, requestId }`. |
| E-02 | `requestId` is also present in the `X-Request-Id` response header. |
| E-03 | `requestId` is system-generated — it is never controlled by the client. |
| E-04 | Unknown routes → `404` with the standard error shape. |

---

## Rules not yet covered by tests

| Rule | Gap |
|---|---|
| AE-01 / AE-02 | Auto-expiry not tested — requires time manipulation or short TTL override |
| WL-02 | Waitlist FIFO under concurrent cancellations not explicitly tested |
| A-05 | Doctor self-registration with invalid `doctorRecordId` not tested — acknowledged gap |
| P-04 | Idempotency key tested; retry-on-network-timeout scenario not tested |
| SL-02 | Adjacent slot boundary (`end === next start` allowed) not explicitly tested |

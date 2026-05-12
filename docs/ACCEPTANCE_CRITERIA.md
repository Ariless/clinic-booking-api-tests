# Acceptance Criteria — clinic-booking-api

Written **before** checking finished work — these criteria define what "done" means for each feature. This is the shift-left artifact: a tester who can write this participates in defining done, not just verifying it.

**Format:** each criterion is a testable statement. If a test doesn't exist yet, it's a gap.  
**Companion:** `BUSINESS_RULES.md` (the rules behind the criteria), `KNOWN_ISSUES.md` (where criteria are currently violated).

---

## 1. Patient registration

**Done when:**

1. A new patient can register with a valid email, password (6–72 chars), and name — receives `201` with an access token, a refresh token, and their user object.
2. The registered patient can immediately log in with the same credentials.
3. Registering with an already-used email returns `409 EMAIL_TAKEN` — no new account is created.
4. Registering with a previously deleted email returns `409 EMAIL_RETIRED` — no new account is created.
5. Invalid input returns `400 VALIDATION_ERROR`:
   - email not a valid format
   - password shorter than 6 characters or longer than 72
   - name missing or over 120 characters
6. The registered account has role `patient` and cannot perform doctor-only actions (confirm, reject appointments).
7. Every error response includes `errorCode`, `message`, and `requestId`.

---

## 2. Doctor registration

**Done when:**

1. A new doctor can register with a valid email, password, name, and `doctorRecordId` — receives `201` with tokens.
2. The registered doctor can immediately log in.
3. The account has role `doctor` and cannot perform patient-only actions (book appointments, join waitlist).
4. All email/password validation rules from patient registration apply identically.

---

## 3. Login

**Done when:**

1. A registered user can log in with correct credentials — receives `200` with a new access token and refresh token.
2. Wrong password returns `401`.
3. Unknown email returns `401`.
4. After 10 failed login attempts from the same IP within 15 minutes, subsequent attempts return `429 RATE_LIMITED`.
5. The rate limit counter resets after the window expires.

---

## 4. Token refresh

**Done when:**

1. A valid refresh token exchanges for a new access token and a new refresh token (`200`).
2. An invalid or expired refresh token returns `401`.
3. An access token (not a refresh token) is rejected by the refresh endpoint.
4. The new access token is accepted by protected endpoints.

---

## 5. Book appointment

**Done when:**

1. A patient with a valid token can book an available slot — receives `201` with the new appointment in status `pending`.
2. The booked slot immediately becomes unavailable — a second booking attempt returns `409 SLOT_TAKEN`.
3. The appointment is visible in `GET /appointments/my` for the booking patient only.
4. A non-existent slot returns `404 SLOT_NOT_FOUND`.
5. A doctor cannot book an appointment — returns `403 FORBIDDEN`.
6. An unauthenticated request returns `401`.
7. Missing or invalid `slotId` in the body returns `400 VALIDATION_ERROR`.
8. DB check: after booking, `slots.isAvailable = 0` for that slot.

---

## 6. Cancel appointment — patient

**Done when:**

1. A patient can cancel their own `pending` appointment — returns `200`.
2. A patient can cancel their own `confirmed` appointment — returns `200`.
3. After cancel: slot is available again (`isAvailable = 1`), appointment status is `cancelled`.
4. If a patient is on the waitlist for the same doctor, they are automatically promoted to a new `pending` appointment on the freed slot — exactly one promotion per freed slot.
5. A patient cannot cancel another patient's appointment — returns `403 FORBIDDEN`.
6. Cancelling an already-cancelled appointment returns `422 INVALID_TRANSITION`.
7. Cancelling a rejected appointment returns `422 INVALID_TRANSITION`.
8. DB check: `appointment.status = 'cancelled'` and `slot.isAvailable = 1` after cancel.

---

## 7. Cancel appointment — doctor

**Done when:**

1. A doctor can cancel a `pending` or `confirmed` appointment on their own slot — returns `200`.
2. After cancel: slot is freed and waitlist promotion fires (same rules as patient cancel).
3. A doctor cannot cancel an appointment on another doctor's slot — returns `403 FORBIDDEN`.
4. A patient cannot call `cancel-as-doctor` — returns `403 FORBIDDEN`.

---

## 8. Confirm appointment

**Done when:**

1. A doctor can confirm a `pending` appointment on their own slot — returns `200`, status becomes `confirmed`.
2. The slot remains unavailable after confirm (`isAvailable = 0`).
3. Confirming a `confirmed` appointment returns `422 INVALID_TRANSITION`.
4. Confirming a `cancelled` or `rejected` appointment returns `422 INVALID_TRANSITION`.
5. A doctor cannot confirm an appointment on another doctor's slot — returns `403 FORBIDDEN`.
6. A patient cannot confirm — returns `403 FORBIDDEN`.
7. DB check: `appointment.status = 'confirmed'` and `slot.isAvailable = 0`.

---

## 9. Reject appointment

**Done when:**

1. A doctor can reject a `pending` appointment on their own slot — returns `200`, status becomes `rejected`.
2. After reject: slot is freed (`isAvailable = 1`).
3. Rejecting an already-rejected appointment returns `422 INVALID_TRANSITION`.
4. Rejecting a `confirmed` appointment returns `422 INVALID_TRANSITION`.
5. A doctor cannot reject an appointment on another doctor's slot — returns `403 FORBIDDEN`.
6. A patient cannot reject — returns `403 FORBIDDEN`.
7. DB check: `appointment.status = 'rejected'` and `slot.isAvailable = 1`.

---

## 10. Reschedule appointment

**Done when:**

1. A patient can reschedule a `pending` appointment to a different available slot with the same doctor — returns `200`, status resets to `pending`.
2. A patient can reschedule a `confirmed` appointment — status always resets to `pending` (doctor must re-confirm).
3. The old slot is freed and waitlist promotion fires for the old slot.
4. The new slot becomes unavailable.
5. Rescheduling to the same slot returns `422 SAME_SLOT`.
6. Rescheduling to a slot belonging to a different doctor returns `422 DOCTOR_MISMATCH`.
7. Rescheduling to an already-booked slot returns `409 SLOT_TAKEN`.
8. Rescheduling a `cancelled` or `rejected` appointment returns `422 INVALID_TRANSITION`.
9. A patient cannot reschedule another patient's appointment — returns `403 FORBIDDEN`.
10. DB check: old slot `isAvailable = 1`, new slot `isAvailable = 0`, appointment status `pending`.

---

## 11. Waitlist — join and leave

**Done when:**

1. A patient can join the waitlist for a doctor — returns `201`.
2. Joining the same doctor's waitlist twice returns `409 WAITLIST_DUPLICATE`.
3. The patient's waitlist entry appears in `GET /appointments/waitlist/me`.
4. A patient can remove their own waitlist entry — returns `200`.
5. After leaving, the entry no longer appears in `GET /appointments/waitlist/me`.
6. A patient cannot remove another patient's waitlist entry — returns `403 FORBIDDEN`.
7. A doctor can view the list of waiting patients for their own waitlist.

---

## 12. Waitlist — auto-promotion

**Done when:**

1. When a slot is freed (cancel, reject, or reschedule), the oldest waitlist entry for that doctor is automatically promoted to a new `pending` appointment.
2. Promotion happens exactly once per freed slot — never zero, never twice, even under concurrent cancellations.
3. The promoted patient's waitlist entry is removed.
4. If no waitlist entries exist, the slot is simply freed with no side effects.
5. DB check: new `pending` appointment exists for the promoted patient, waitlist row is deleted.

---

## 13. Waitlist offers — accept and decline

**Done when:**

1. A promoted patient who already has an active booking with that doctor receives a pending offer instead of a direct booking.
2. Accepting an offer cancels the patient's existing booking and creates a new one for the offered slot — returns `200`.
3. Declining an offer frees the slot and keeps the patient on the waitlist — returns `200`.
4. Accepting an already-resolved offer returns `409`.
5. A patient cannot accept or decline another patient's offer — returns `403 FORBIDDEN`.

---

## 14. AI symptom recommendation

**Done when:**

1. An authenticated user submitting symptoms receives `200` with `recommendedSpecialty` (string), `doctors` (array), and `reasoning` (non-empty string).
2. `recommendedSpecialty` is always one of the system's known specialties — never a hallucinated value.
3. Empty or missing `symptoms` returns `400 VALIDATION_ERROR`.
4. Symptoms that cannot be mapped to any specialty return `422 UNKNOWN_SPECIALTY`.
5. After 5 requests in 60 seconds, further requests return `429 RATE_LIMITED`.
6. When `ENABLE_AI_RECOMMENDATION=false`, the endpoint returns `503 FEATURE_DISABLED`.
7. When the Claude API is unavailable, the endpoint returns `503 CLAUDE_UNAVAILABLE` — no unhandled exception or `500`.
8. Adversarial input (prompt injection attempts) does not produce a specialty outside the allowed list — system either recommends correctly or returns a 4xx error.
9. An unauthenticated request returns `401`.
10. Every error response includes `errorCode`, `message`, and `requestId`.

---

## 15. Paid consultation

**Done when:**

1. A patient can book a consultation with a valid doctor and payment method — receives `201` with the consultation and payment records.
2. A failed payment returns `402 PAYMENT_REQUIRED` — no consultation record is created.
3. A payment record is always written regardless of outcome (succeeded or failed).
4. Sending the same `X-Idempotency-Key` twice returns the same `consultationId` without re-charging — DB contains exactly one payment row for that key.
5. An unknown doctor returns `404 DOCTOR_NOT_FOUND`.
6. When `PAYMENT_MODE=disabled`, the endpoint returns `503 FEATURE_DISABLED`.
7. DB check: on success, one `consultations` row and one `payments` row exist; on failure, only the `payments` row exists.

---

## 16. Doctor real-time notifications (WebSocket)

**Done when:**

1. A doctor can connect to `ws://…/ws?token=<JWT>` with a valid doctor token — connection established.
2. When a patient books an appointment on the doctor's slot, the connected doctor receives an `appointment.booked` event with `appointmentId`, `patientId`, `status`, and `timestamp`.
3. When a patient cancels, the doctor receives an `appointment.cancelled_by_patient` event.
4. Events are delivered without the doctor refreshing the page.
5. An invalid or missing token → connection closed with code `4001`.
6. A patient token → connection closed with code `4003`.
7. API tests using a Node.js WS client **and** E2E tests using a real browser both pass — the browser-side JavaScript initialisation is covered.

---

## 17. Patient real-time notifications (WebSocket)

**Done when:**

1. A patient can connect and receive notifications.
2. When a doctor confirms their appointment, the patient receives an `appointment.confirmed` notification in the browser in real time.
3. When a doctor cancels or rejects, the patient receives the corresponding event.
4. An invalid token → connection rejected.

---

## 18. Webhook notifications

**Done when:**

1. When an appointment status changes (confirmed, rejected, cancelled), the system sends a POST to the configured `WEBHOOK_URL`.
2. Webhook payload includes `event`, `appointmentId`, `patientId`, `status`, and `timestamp`.
3. A slow or failing webhook receiver does not delay or fail the API response — webhook is fire-and-forget.
4. If `WEBHOOK_URL` is not configured, no webhook attempt is made and the API responds normally.

---

## 19. Rate limiting

**Done when:**

1. Login endpoint: after 10 attempts from the same IP in 15 minutes → `429 RATE_LIMITED`. 11th attempt blocked.
2. Register endpoint: after 5 attempts from the same IP in 1 hour → `429 RATE_LIMITED`.
3. Booking endpoint: after 20 attempts from the same IP in 1 minute → `429 RATE_LIMITED`.
4. AI recommendation: after 5 requests per token+IP hash in 60 seconds → `429 RATE_LIMITED`.
5. All `429` responses include `errorCode: "RATE_LIMITED"`, `message`, and `requestId`.
6. Legitimate requests succeed before the limit is reached.

---

## 20. Auto-expiry of pending appointments

**Done when:**

1. A `pending` appointment older than `AUTO_EXPIRE_PENDING_MAX_AGE_MS` is automatically cancelled and the slot is freed.
2. `confirmed` appointments are never auto-expired.
3. After expiry, the freed slot triggers waitlist promotion (same as manual cancel).
4. When `AUTO_EXPIRE_PENDING_INTERVAL_MS = 0`, expiry is disabled and no appointments are automatically cancelled.

---

## 21. Error contract (cross-cutting)

**Done when:**

1. Every non-2xx response from any endpoint includes `errorCode` (non-empty string), `message` (non-empty string), and `requestId` (non-empty string).
2. The same `requestId` appears in the `X-Request-Id` response header.
3. Unknown routes return `404` with the standard error shape — not an HTML error page or empty body.
4. Unhandled exceptions return `500 INTERNAL_ERROR` with the standard shape — no stack traces in the response body.

---

## Criteria not yet covered by automated tests

| Feature | Missing coverage |
|---|---|
| Token refresh (§4) | Invalid token and cross-token-type rejection not explicitly tested |
| Auto-expiry (§20) | Not tested — requires time manipulation or short `MAX_AGE_MS` override |
| Waitlist FIFO under concurrency (§12) | Order guarantee under simultaneous cancellations not tested |
| Webhook fire-and-forget (§18) | Failure isolation (slow receiver doesn't delay API) not explicitly asserted |
| Slot adjacent boundary (§Slots, SL-02) | `end === next start` allowed case not tested |
| Patient notifications (§17) | Tested E2E; doctor-cancels-and-patient-notified path less covered |

# SUT Surface Map

Compact index of the clinic-booking SUT. Read this instead of exploring DOM or routes each time.

Base URL: `http://localhost:3000` · API prefix: `/api/v1`

---

## API endpoints

### Auth — `/api/v1/auth/`
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/auth/register` | — | any |
| POST | `/auth/login` | — | any |
| POST | `/auth/refresh` | — | any |
| GET  | `/auth/me` | Bearer | any |

### Appointments — `/api/v1/appointments/`
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/appointments` | Bearer | patient |
| GET  | `/appointments/my` | Bearer | patient |
| GET  | `/appointments/doctor` | Bearer | doctor |
| GET  | `/appointments/:id` | Bearer | owner or doctor |
| PATCH | `/appointments/:id/cancel` | Bearer | patient (owner) |
| PATCH | `/appointments/:id/confirm` | Bearer | doctor (owner) |
| PATCH | `/appointments/:id/reject` | Bearer | doctor (owner) |
| PATCH | `/appointments/:id/cancel-as-doctor` | Bearer | doctor |
| PATCH | `/appointments/:id/complete` | Bearer | doctor |
| PATCH | `/appointments/:id/reschedule` | Bearer | patient (owner) |
| GET/POST | `/appointments/:id/notes` | Bearer | doctor |
| POST | `/appointments/:id/rate` | Bearer | patient |
| POST | `/appointments/recurring` | Bearer | patient |
| DELETE | `/appointments/series/:seriesId/cancel` | Bearer | patient |
| POST | `/appointments/waitlist` | Bearer | patient |
| GET  | `/appointments/waitlist/me` | Bearer | patient |
| DELETE | `/appointments/waitlist/:id` | Bearer | patient (owner) |
| GET  | `/appointments/waitlist-offers` | Bearer | patient |
| POST | `/appointments/waitlist-offers/:id/accept` | Bearer | patient (owner) |
| POST | `/appointments/waitlist-offers/:id/decline` | Bearer | patient (owner) |

### Doctors — `/api/v1/doctors/`
| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/doctors` | — | any |
| GET | `/doctors/:id` | — | any |
| GET | `/doctors/:id/slots` | — | any |
| GET | `/doctors/:id/rating` | — | any |
| GET | `/doctors/:id/schedule` | Bearer | doctor |
| GET | `/doctors/me/slots` | Bearer | doctor |
| POST | `/doctors/:id/slots` | Bearer | doctor |
| DELETE | `/doctors/me/slots/:slotId` | Bearer | doctor |
| GET/PATCH | `/doctors/me/schedule` | Bearer | doctor |

### AI — `/api/v1/ai/`
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/ai/recommend-doctor` | Bearer | feature flag: `ENABLE_AI_RECOMMENDATION`; mock: `AI_MOCK_RESPONSE=true` |

### Consultations — `/api/v1/consultations/`
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/consultations` | Bearer | requires `PAYMENT_MODE=mock_success` |
| GET  | `/consultations/me` | Bearer | — |

### System
| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | — |
| GET | `/metrics` | — |
| POST | `/api/v1/debug/simulate-concurrent-booking` | — |

---

## UI pages — public/

| URL | File | data-qa page marker | Role |
|-----|------|---------------------|------|
| `/login` | `login.html` | `page-login` | any |
| `/register` | `register-patient.html` | `page-register-patient` | any |
| `/patient/booking` | `patient-booking.html` | — | patient |
| `/patient/appointments` | `patient-appointments.html` | `page-patient-appointments` | patient |
| `/patient/consultations` | `patient-consultations.html` | `page-patient-consultations` | patient |
| `/patient/notifications` | `patient-notifications.html` | `page-patient-notifications` | patient |
| `/doctor/appointments` | `doctor-appointments.html` | `page-doctor-appointments` | doctor |
| `/doctor/schedule` | `doctor-schedule.html` | — | doctor |

---

## Key data-qa attributes

### Login page
`login-email` · `login-password` · `login-submit` · `login-error` · `login-link-register`

### Register page
`register-patient-name` · `register-patient-email` · `register-patient-password` · `register-patient-submit` · `register-patient-error` · `register-patient-success`

### Patient booking (`/patient/booking`)
`booking-specialty` · `booking-doctor` · `booking-slot-day` · `booking-slot-time` · `booking-submit` · `booking-form-message` · `booking-banner-error` · `booking-success-message` · `booking-guest-gate` · `booking-doctors-empty` · `booking-slots-empty` · `booking-section-ai` · `booking-ai-symptoms` · `booking-ai-submit` · `booking-ai-result`

### Patient appointments
`patient-appt-list` · `patient-appt-item` · `patient-appt-filter-status` · `patient-appt-sort` · `patient-appt-banner` · `patient-appt-pagination` · `patient-appt-prev-page` · `patient-appt-next-page` · `patient-appt-page-info` · `patient-appt-page-size` · `patient-appt-reschedule-slot-input` · `patient-appt-reschedule-confirm` · `patient-appt-cancel-series` · `patient-waitlist-section` · `patient-offers-section`

### Doctor appointments
`doctor-appt-list` · `doctor-appt-section` · `doctor-appt-empty` · `doctor-appt-banner-error` · `doctor-appt-pagination` · `doctor-appt-prev-page` · `doctor-appt-next-page` · `doctor-appt-page-info` · `doctor-appt-page-size` · `doctor-ws-status` · `doctor-ws-toast` · `doctor-waitlist-section`

### Patient consultations
`patient-consult-form` · `patient-consult-doctor-select` · `patient-consult-payment-method` · `patient-consult-submit` · `patient-consult-list` · `patient-consult-banner-success` · `patient-consult-banner-error` · `patient-consult-guest-gate`

### Patient notifications
`patient-notif-list` · `patient-notif-ws-status` · `patient-notif-section` · `patient-notif-guest-gate`

### Global nav
`site-header` · `site-brand` · `site-login` · `site-logout` · `patient-nav` · `doctor-nav`

---

## Per-item data-qa pattern

Appointment items use `data-appt-id="{id}"` and `data-status="{status}"`:
```html
<div data-qa="patient-appt-item" data-appt-id="42" data-status="pending">
  <button data-qa="patient-appt-cancel" data-appt-id="42">...</button>
  <span data-qa="status-badge">pending</span>
</div>
```
Select by status: `[data-qa="status-badge"][data-status="confirmed"]`
Select cancel button for specific appt: `[data-qa="patient-appt-cancel"][data-appt-id="${id}"]`

---

## Error codes by area

| Area | Error codes |
|------|-------------|
| Auth | `VALIDATION_ERROR` `FORBIDDEN` |
| Appointments | `SLOT_TAKEN` `SLOT_NOT_FOUND` `SLOT_TOO_SHORT` `OUTSIDE_WORKING_HOURS` `INVALID_TRANSITION` `FORBIDDEN` `PAYMENT_REQUIRED` `WAITLIST_DUPLICATE` `OFFER_ALREADY_RESOLVED` `SERIES_NOT_FOUND` `CHAOS_ERROR` |
| Doctors | `DOCTOR_NOT_FOUND` `FORBIDDEN` |
| AI | `UNKNOWN_SPECIALTY` `FEATURE_DISABLED` `CLAUDE_UNAVAILABLE` `AI_SERVICE_UNAVAILABLE` `RATE_LIMITED` `VALIDATION_ERROR` |
| Consultations | `PAYMENT_REQUIRED` `FORBIDDEN` |

---

## Seed accounts

| Email | Password | Role | doctorRecordId |
|-------|----------|------|----------------|
| `doctor@example.com` | `password` | doctor | 1 — Cardiologist |
| `doctor2@example.com` | `password` | doctor | 2 — Dermatologist |
| `doctor3@example.com` | `password` | doctor | 3 — Neurologist |

Patient accounts are created by fixtures — no hardcoded seed patients.

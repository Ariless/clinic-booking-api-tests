# Test summary — Clinic Booking System

**Date:** 2026-05-09  
**Prepared by:** QA  
**Version:** 1.0

---

> **Dated snapshot, deliberately not rewritten** (noted 2026-08-21). This is what was reported to
> stakeholders on 2026-05-09; rewriting its counts would turn a record of a conversation into a
> claim about today. Current state: `README.md`, `docs/KNOWN_ISSUES.md` (3 open bugs).

## Overall status: ⚠️ Mostly ready — 2 open issues require a decision before release

The core booking experience works correctly and is covered by automated checks. Two issues related to the AI symptom checker remain open — they affect the accuracy of specialist recommendations and require a product decision on how to handle them.

---

## What was tested

| Area | What we checked | Status |
|---|---|---|
| **Booking appointments** | Patients can find a doctor, book a slot, cancel, and reschedule. No two patients can book the same slot at the same time. | ✅ Green |
| **Doctor workflow** | Doctors can view their appointments, confirm or reject, and cancel when needed. Live notifications appear in the browser without refreshing the page. | ✅ Green |
| **Waitlist** | Patients can join the queue for a fully booked doctor. When a slot frees up, the first person in the queue is automatically offered it. | ✅ Green |
| **Account security** | Patient appointment data is private — only the patient who made the booking can see it. Accessing another patient's data is blocked. | ✅ Green |
| **AI symptom checker** | Patients describe symptoms and receive a specialist recommendation. The system never invents specialties that don't exist in the product. | ⚠️ Yellow — see issues below |
| **Accessibility** | The website works with screen readers and keyboard-only navigation. Meets WCAG 2.1 AA standard (with one documented exception — see below). | ⚠️ Yellow — minor debt |
| **System reliability** | The system handles 50 simultaneous users booking appointments without errors or slowdowns. Response times stay within acceptable limits. | ✅ Green |
| **Error handling** | When something goes wrong, the system returns a clear error message with a reference code — no silent failures, no crashes. | ✅ Green |

---

## Issues found

### Fixed before this summary

| # | What was wrong | Business impact | How found |
|---|---|---|---|
| B-01 | Appointment details were visible to anyone on the internet — no login required | Privacy breach; patient data exposed | Automated security checks |
| B-02 | The website was not navigable by screen readers — missing page structure | Legal compliance risk (EU Accessibility Act) | Automated accessibility checks |
| B-03 | Doctors received no live notifications in the browser when patients booked or cancelled | Doctors had to manually refresh to see new bookings | End-to-end browser testing |
| B-04 | After confirming an appointment, the confirmation message disappeared immediately | Doctors had no visual feedback that their action worked | End-to-end browser testing |

All four were fixed during the testing cycle. The test suite now catches regressions on all four automatically.

---

### Open — require a decision

**B-05 — Symptom checker may recommend the wrong specialist for short descriptions**

When a patient types a brief description like "chest pain," the system may suggest an orthopaedic specialist instead of a cardiologist. Longer, more descriptive input ("chest pain and shortness of breath") works correctly.

- **Who is affected:** Patients who describe symptoms briefly
- **What happens:** They receive a valid-looking recommendation for the wrong specialty
- **Risk level:** Medium — no error shown; silent misdirection
- **Options:** (A) Improve the matching logic so short descriptions work reliably; (B) Prompt patients to add more detail before showing a recommendation
- **Workaround until fixed:** The AI model (Claude) often corrects the ranking when it has enough context — this issue is most visible in mock/test mode

**B-06 — Symptom checker recommends specialties with no available doctors**

For two specialties in the system (Orthopaedist, Paediatrician), there are currently no doctors added to the platform. If the symptom checker recommends one of them, the patient sees a successful-looking result but cannot book an appointment — no doctors are listed.

- **Who is affected:** Any patient whose symptoms map to these two specialties
- **What happens:** They land on a page that looks successful but offers no next step
- **Risk level:** Medium — misleading experience; patient has no way forward
- **Options:** (A) Add doctors for all specialties before release; (B) Show a helpful message ("No doctors currently available for this specialty — please contact us directly") instead of an empty result

---

## Known limitations (accepted, not planned for fixing in this phase)

| Limitation | Decision |
|---|---|
| **Text colour contrast on secondary labels** is slightly below the WCAG AA threshold | Requires a design change; marked as design debt; all structural accessibility requirements are met |
| **Anyone can create a doctor account** by providing a valid-looking ID | Acceptable for a development environment; production would require invitation-based registration |
| **Usage limits apply per network address**, not per user account | On shared office networks, one user's high activity can affect others; acceptable risk for current scale |

---

## What is not yet covered

| Area | Reason not tested yet | When |
|---|---|---|
| Rescheduling appointments (full test suite) | Feature is built and working; full automated test suite planned after a technical upgrade in progress | Next sprint |

---

## Recommendation

**Release the core booking product.** The booking, doctor management, waitlist, and security areas are green and covered by continuous automated checks.

**Before releasing the AI symptom checker:** resolve B-05 and B-06. Both require a product decision more than a technical fix — the engineering effort is low once the direction is clear.

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/appointments.type.test.ts >> POST /appointments — appointment type @api >> POST /appointments — [B-14] 422 SLOT_TOO_SHORT procedure into 15min slot @api
- Location: tests/api/appointments.type.test.ts:73:10

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 422
Received: 201
```

# Test source

```ts
  1   | import { test, expect } from "../../fixtures";
  2   | import { AppointmentsClient } from "../../api/AppointmentsClient";
  3   | import { DoctorsClient } from "../../api/DoctorsClient";
  4   | 
  5   | test.describe("POST /appointments — appointment type @api", () => {
  6   | 
  7   |     test("POST /appointments — 201 no type defaults to consultation @smoke @api",
  8   |         async ({ request, slot, user }) => {
  9   |             const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  10  |             const appointments = new AppointmentsClient(request);
  11  | 
  12  |             const { status, body } = await appointments.createAppointment(slot.slot.id, patientAuth);
  13  | 
  14  |             expect(status).toBe(201);
  15  |             expect(body.type).toBe("consultation");
  16  |         },
  17  |     );
  18  | 
  19  |     test("POST /appointments — 201 explicit type consultation @smoke @api",
  20  |         async ({ request, slot, user }) => {
  21  |             const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  22  |             const appointments = new AppointmentsClient(request);
  23  | 
  24  |             const { status, body } = await appointments.createAppointment(
  25  |                 slot.slot.id,
  26  |                 { ...patientAuth, type: "consultation" },
  27  |             );
  28  | 
  29  |             expect(status).toBe(201);
  30  |             expect(body.type).toBe("consultation");
  31  |         },
  32  |     );
  33  | 
  34  |     test("POST /appointments — 201 type procedure, slot 60min @smoke @api",
  35  |         async ({ request, slot, user }) => {
  36  |             const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  37  |             const appointments = new AppointmentsClient(request);
  38  | 
  39  |             const { status, body } = await appointments.createAppointment(
  40  |                 slot.slot.id,
  41  |                 { ...patientAuth, type: "procedure" },
  42  |             );
  43  | 
  44  |             expect(status).toBe(201);
  45  |             expect(body.type).toBe("procedure");
  46  |         },
  47  |     );
  48  | 
  49  |     test("POST /appointments — 400 VALIDATION_ERROR invalid type @api",
  50  |         async ({ request, slot, user }) => {
  51  |             const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  52  |             const appointments = new AppointmentsClient(request);
  53  | 
  54  |             const { status, body } = await appointments.createAppointment(
  55  |                 slot.slot.id,
  56  |                 { ...patientAuth, type: "checkup" },
  57  |             );
  58  | 
  59  |             expect(status).toBe(400);
  60  |             expect(body.errorCode).toBe("VALIDATION_ERROR");
  61  |         },
  62  |     );
  63  | 
  64  |     test("POST /appointments — 401 without token @api",
  65  |         async ({ request, slot }) => {
  66  |             const appointments = new AppointmentsClient(request);
  67  |             const { status } = await appointments.createAppointment(slot.slot.id, { type: "consultation" });
  68  |             expect(status).toBe(401);
  69  |         },
  70  |     );
  71  | 
  72  |     // B-14: procedure into a short slot — should fail SLOT_TOO_SHORT but check is not implemented
  73  |     test.fail(
  74  |         "POST /appointments — [B-14] 422 SLOT_TOO_SHORT procedure into 15min slot @api",
  75  |         async ({ request, slot, user }) => {
  76  |             const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  77  |             const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
  78  |             const appointments = new AppointmentsClient(request);
  79  |             const doctors = new DoctorsClient(request);
  80  | 
  81  |             // Create a 15-minute slot at 11:00 UTC, 3+ days out.
  82  |             // 11:00 is intentionally between nextSeedSlotWindow windows (10:00–11:00, 12:00–13:00)
  83  |             // to avoid SLOT_OVERLAP with fixture slots from other tests in the suite.
  84  |             const start = new Date(Date.now() + 72 * 60 * 60 * 1000);
  85  |             start.setUTCHours(11, 0, 0, 0);
  86  |             const end = new Date(start.getTime() + 15 * 60 * 1000);
  87  |             const { body: shortSlot } = await doctors.createSlot(
  88  |                 slot.doctor.doctorRecordId,
  89  |                 start.toISOString(),
  90  |                 end.toISOString(),
  91  |                 true,
  92  |                 doctorAuth,
  93  |             );
  94  | 
  95  |             try {
  96  |                 const { status, body } = await appointments.createAppointment(
  97  |                     shortSlot.id as number,
  98  |                     { ...patientAuth, type: "procedure" },
  99  |                 );
> 100 |                 expect(status).toBe(422);
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  101 |                 expect(body.errorCode).toBe("SLOT_TOO_SHORT");
  102 |             } finally {
  103 |                 await doctors.deleteSlot(shortSlot.id as number, doctorAuth);
  104 |             }
  105 |         },
  106 |     );
  107 | 
  108 | });
  109 | 
```
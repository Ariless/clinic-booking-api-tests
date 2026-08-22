# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/security.test.ts >> POST /api/v1/appointments/waitlist-offers/:id/decline — 403 when patient declines another patient's offer @api @security
- Location: tests/api/security.test.ts:94:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 409
```

# Test source

```ts
  6   | 
  7   | test("GET /api/v1/appointments/:id — 401 when no auth token provided @api @security", async ({ request, user, slot }) => {
  8   |     const appointments = new AppointmentsClient(request);
  9   |     const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  10  | 
  11  |     const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
  12  |     expect(bookStatus).toBe(201);
  13  | 
  14  |     const { status } = await appointments.getAppointment(bookBody.id, {});
  15  |     expect(status).toBe(401);
  16  | });
  17  | 
  18  | test("GET /api/v1/appointments/:id — 403 when patient reads another patient's appointment @api @security", async ({ request, user, user2, slot }) => {
  19  |     const appointments = new AppointmentsClient(request);
  20  |     const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  21  |     const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
  22  | 
  23  |     const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
  24  |     expect(bookStatus).toBe(201);
  25  | 
  26  |     const { status, body } = await appointments.getAppointment(bookBody.id, patient2Auth);
  27  |     expect(status).toBe(403);
  28  |     expect(body.errorCode).toBe("FORBIDDEN");
  29  | });
  30  | 
  31  | test("PATCH /api/v1/appointments/:id/cancel — 403 when patient cancels another patient's appointment @api @security", async ({ request, user, user2, slot }) => {
  32  |     const appointments = new AppointmentsClient(request);
  33  |     const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  34  |     const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
  35  | 
  36  |     const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
  37  |     expect(bookStatus).toBe(201);
  38  | 
  39  |     const { status, body } = await appointments.cancelAppointment(bookBody.id, patient2Auth);
  40  |     expect(status).toBe(403);
  41  |     expect(body.errorCode).toBe("FORBIDDEN");
  42  | });
  43  | 
  44  | test("DELETE /api/v1/appointments/waitlist/:id — 403 when patient deletes another patient's waitlist entry @api @security", async ({ request, user, user2, slot }) => {
  45  |     const appointments = new AppointmentsClient(request);
  46  |     const { doctor } = slot;
  47  |     const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  48  |     const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
  49  | 
  50  |     const { status: joinStatus, body: joinBody } = await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
  51  |     expect(joinStatus).toBe(201);
  52  | 
  53  |     try {
  54  |         const { status, body } = await appointments.leaveWaitlist(joinBody.id, patient2Auth);
  55  |         expect(status).toBe(403);
  56  |         expect(body.errorCode).toBe("FORBIDDEN");
  57  |     } finally {
  58  |         await appointments.leaveWaitlist(joinBody.id, patientAuth);
  59  |     }
  60  | });
  61  | 
  62  | test("POST /api/v1/appointments/waitlist-offers/:id/accept — 403 when patient accepts another patient's offer @api @security", async ({ request, user, user2, slot }) => {
  63  |     const { slot: slot1Body, doctorToken, doctor } = slot;
  64  |     const appointments = new AppointmentsClient(request);
  65  |     const doctors = new DoctorsClient(request);
  66  |     const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  67  |     const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
  68  |     const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
  69  | 
  70  |     const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
  71  |     const { status: slotStatus, body: slot2 } = await doctors.createSlot(
  72  |         doctor.doctorRecordId, seedSlotStart, seedSlotEnd, true, doctorAuth
  73  |     );
  74  |     expect(slotStatus).toBe(201);
  75  | 
  76  |     try {
  77  |         await appointments.createAppointment(slot1Body.id, patientAuth);
  78  |         const { body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
  79  |         await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
  80  |         await appointments.cancelAppointment(book2Body.id, patient2Auth);
  81  | 
  82  |         const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
  83  |         const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);
  84  |         expect(offer, "offer must exist for user1").toBeDefined();
  85  | 
  86  |         const { status, body } = await appointments.acceptOffer(offer.id, patient2Auth);
  87  |         expect(status).toBe(403);
  88  |         expect(body.errorCode).toBe("FORBIDDEN");
  89  |     } finally {
  90  |         await doctors.deleteSlot(slot2.id, doctorAuth);
  91  |     }
  92  | });
  93  | 
  94  | test("POST /api/v1/appointments/waitlist-offers/:id/decline — 403 when patient declines another patient's offer @api @security", async ({ request, user, user2, slot }) => {
  95  |     const { slot: slot1Body, doctorToken, doctor } = slot;
  96  |     const appointments = new AppointmentsClient(request);
  97  |     const doctors = new DoctorsClient(request);
  98  |     const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  99  |     const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
  100 |     const doctorAuth = { headers: { Authorization: `Bearer ${doctorToken}` } };
  101 | 
  102 |     const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
  103 |     const { status: slotStatus, body: slot2 } = await doctors.createSlot(
  104 |         doctor.doctorRecordId, seedSlotStart, seedSlotEnd, true, doctorAuth
  105 |     );
> 106 |     expect(slotStatus).toBe(201);
      |                        ^ Error: expect(received).toBe(expected) // Object.is equality
  107 | 
  108 |     try {
  109 |         await appointments.createAppointment(slot1Body.id, patientAuth);
  110 |         const { body: book2Body } = await appointments.createAppointment(slot2.id, patient2Auth);
  111 |         await appointments.joinWaitlist(doctor.doctorRecordId, patientAuth);
  112 |         await appointments.cancelAppointment(book2Body.id, patient2Auth);
  113 | 
  114 |         const { body: offers } = await appointments.getWaitlistOffers(patientAuth);
  115 |         const offer = offers.find((o: { slotId: number }) => o.slotId === slot2.id);
  116 |         expect(offer, "offer must exist for user1").toBeDefined();
  117 | 
  118 |         const { status, body } = await appointments.declineOffer(offer.id, patient2Auth);
  119 |         expect(status).toBe(403);
  120 |         expect(body.errorCode).toBe("FORBIDDEN");
  121 |     } finally {
  122 |         await doctors.deleteSlot(slot2.id, doctorAuth);
  123 |     }
  124 | });
  125 | 
  126 | test("GET /api/v1/auth/me — 401 with tampered JWT payload @api @security", async ({ request, user }) => {
  127 |     const [header, payload, signature] = user.token.split(".");
  128 |     const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  129 |     decoded.role = "admin";
  130 |     const tamperedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");
  131 |     const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
  132 | 
  133 |     const response = await request.get(endpoints.authMe, {
  134 |         headers: { Authorization: `Bearer ${tamperedToken}` },
  135 |     });
  136 |     expect(response.status()).toBe(401);
  137 | });
  138 | 
```
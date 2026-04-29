# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/appointments.rbac.cross-doctor.test.js >> Doctor cannot reject another doctor's appointment — 403 @api
- Location: tests/api/appointments.rbac.cross-doctor.test.js:26:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 403
Received: 401
```

# Test source

```ts
  1  | const { test, expect } = require("../../fixtures");
  2  | const { AuthClient } = require("../../api/AuthClient");
  3  | const { AppointmentsClient } = require("../../api/AppointmentsClient");
  4  | const { seedDoctors } = require("../../data/seedAccounts");
  5  | 
  6  | test("Doctor cannot confirm another doctor's appointment — 403 @api", async ({ request, user, slot }) => {
  7  |     const { slot: slotBody } = slot;
  8  | 
  9  |     const appointments = new AppointmentsClient(request);
  10 |     const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, {
  11 |         headers: { Authorization: `Bearer ${user.token}` },
  12 |     });
  13 |     expect(bookStatus).toBe(201);
  14 | 
  15 |     const auth = new AuthClient(request);
  16 |     const { body: loginBody } = await auth.verifyLogin(seedDoctors[1].email, seedDoctors[1].password);
  17 |     const doctor2Token = loginBody.token;
  18 | 
  19 |     const { status, body } = await appointments.confirmAppointment(bookBody.id, {
  20 |         headers: { Authorization: `Bearer ${doctor2Token}` },
  21 |     });
  22 |     expect(status).toBe(403);
  23 |     expect(body.errorCode).toBe("FORBIDDEN");
  24 | });
  25 | 
  26 | test("Doctor cannot reject another doctor's appointment — 403 @api", async ({ request, user, slot }) => {
  27 |     const { slot: slotBody } = slot;
  28 | 
  29 |     const appointments = new AppointmentsClient(request);
  30 |     const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, {
  31 |         headers: { Authorization: `Bearer ${user.token}` },
  32 |     });
  33 |     expect(bookStatus).toBe(201);
  34 | 
  35 |     const auth = new AuthClient(request);
  36 |     const { body: loginBody } = await auth.verifyLogin(seedDoctors[1].email, seedDoctors[1].password);
  37 |     const doctor2Token = loginBody.token;
  38 | 
  39 |     const { status, body } = await appointments.rejectAppointment(bookBody.id, {
  40 |         headers: { Authorization: `Bearer ${doctor2Token}` },
  41 |     });
> 42 |     expect(status).toBe(403);
     |                    ^ Error: expect(received).toBe(expected) // Object.is equality
  43 |     expect(body.errorCode).toBe("FORBIDDEN");
  44 | });
  45 | 
  46 | test("Doctor cannot cancel-as-doctor another doctor's appointment — 403 @api", async ({ request, user, slot }) => {
  47 |     const { slot: slotBody } = slot;
  48 | 
  49 |     const appointments = new AppointmentsClient(request);
  50 |     const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, {
  51 |         headers: { Authorization: `Bearer ${user.token}` },
  52 |     });
  53 |     expect(bookStatus).toBe(201);
  54 | 
  55 |     const auth = new AuthClient(request);
  56 |     const { body: loginBody } = await auth.verifyLogin(seedDoctors[1].email, seedDoctors[1].password);
  57 |     const doctor2Token = loginBody.token;
  58 | 
  59 |     const { status, body } = await appointments.cancelAsDoctor(bookBody.id, {
  60 |         headers: { Authorization: `Bearer ${doctor2Token}` },
  61 |     });
  62 |     expect(status).toBe(403);
  63 |     expect(body.errorCode).toBe("FORBIDDEN");
  64 | });
  65 | 
```
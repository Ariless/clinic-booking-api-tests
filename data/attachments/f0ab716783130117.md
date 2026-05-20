# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/appointments.reschedule.test.ts >> PATCH /api/v1/appointments/:id/reschedule — old slot freed and waitlist patient promoted @api
- Location: tests/api/appointments.reschedule.test.ts:216:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 409
```

# Test source

```ts
  132 |         const appointments = new AppointmentsClient(request);
  133 | 
  134 |         const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
  135 |         expect(bookStatus).toBe(201);
  136 | 
  137 |         const { status: cancelStatus } = await appointments.cancelAppointment(bookBody.id, patientAuth);
  138 |         expect(cancelStatus).toBe(200);
  139 | 
  140 |         const { slotId: newSlotId, cleanup } = await createExtraSlot(request, doctor.doctorRecordId, doctorToken);
  141 |         try {
  142 |             const { status, body } = await appointments.rescheduleAppointment(bookBody.id, newSlotId, patientAuth);
  143 |             expect(status).toBe(422);
  144 |             expect(body.errorCode).toBe('INVALID_TRANSITION');
  145 |         } finally {
  146 |             await cleanup();
  147 |         }
  148 |     },
  149 | );
  150 | 
  151 | test('PATCH /api/v1/appointments/:id/reschedule — 422 new slot belongs to different doctor @api',
  152 |     async ({ request, user, slot }) => {
  153 |         const { slot: slotBody } = slot;
  154 |         const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  155 |         const appointments = new AppointmentsClient(request);
  156 | 
  157 |         const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
  158 |         expect(bookStatus).toBe(201);
  159 | 
  160 |         const doctor2 = seedDoctors[1];
  161 |         const auth = new AuthClient(request);
  162 |         const { body: d2Login } = await auth.verifyLogin(doctor2.email, doctor2.password);
  163 |         const doctor2Token = d2Login.token as string;
  164 | 
  165 |         const { slotId: doctor2SlotId, cleanup } = await createExtraSlot(
  166 |             request, doctor2.doctorRecordId, doctor2Token,
  167 |         );
  168 |         try {
  169 |             const { status, body } = await appointments.rescheduleAppointment(
  170 |                 bookBody.id, doctor2SlotId, patientAuth,
  171 |             );
  172 |             expect(status).toBe(422);
  173 |             expect(body.errorCode).toBe('DOCTOR_MISMATCH');
  174 |         } finally {
  175 |             await cleanup();
  176 |         }
  177 |     },
  178 | );
  179 | 
  180 | test('PATCH /api/v1/appointments/:id/reschedule — 422 same slot as current @api',
  181 |     async ({ request, user, slot }) => {
  182 |         const { slot: slotBody } = slot;
  183 |         const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
  184 |         const appointments = new AppointmentsClient(request);
  185 | 
  186 |         const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
  187 |         expect(bookStatus).toBe(201);
  188 | 
  189 |         const { status, body } = await appointments.rescheduleAppointment(bookBody.id, slotBody.id, patientAuth);
  190 |         expect(status).toBe(422);
  191 |         expect(body.errorCode).toBe('SAME_SLOT');
  192 |     },
  193 | );
  194 | 
  195 | test('PATCH /api/v1/appointments/:id/reschedule — 403 patient does not own appointment @api',
  196 |     async ({ request, user, user2, slot }) => {
  197 |         const { slot: slotBody, doctor, doctorToken } = slot;
  198 |         const patient1Auth = { headers: { Authorization: `Bearer ${user.token}` } };
  199 |         const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
  200 |         const appointments = new AppointmentsClient(request);
  201 | 
  202 |         const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patient1Auth);
  203 |         expect(bookStatus).toBe(201);
  204 | 
  205 |         const { slotId: newSlotId, cleanup } = await createExtraSlot(request, doctor.doctorRecordId, doctorToken);
  206 |         try {
  207 |             const { status, body } = await appointments.rescheduleAppointment(bookBody.id, newSlotId, patient2Auth);
  208 |             expect(status).toBe(403);
  209 |             expect(body.errorCode).toBe('FORBIDDEN');
  210 |         } finally {
  211 |             await cleanup();
  212 |         }
  213 |     },
  214 | );
  215 | 
  216 | test('PATCH /api/v1/appointments/:id/reschedule — old slot freed and waitlist patient promoted @api',
  217 |     async ({ request, user, user2, slot }) => {
  218 |         const { slot: slotBody, doctor, doctorToken } = slot;
  219 |         const patient1Auth = { headers: { Authorization: `Bearer ${user.token}` } };
  220 |         const patient2Auth = { headers: { Authorization: `Bearer ${user2.token}` } };
  221 |         const appointments = new AppointmentsClient(request);
  222 | 
  223 |         const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patient1Auth);
  224 |         expect(bookStatus).toBe(201);
  225 | 
  226 |         const { status: waitStatus } = await appointments.joinWaitlist(doctor.doctorRecordId, patient2Auth);
  227 |         expect(waitStatus).toBe(201);
  228 | 
  229 |         const { slotId: newSlotId, cleanup } = await createExtraSlot(request, doctor.doctorRecordId, doctorToken);
  230 |         try {
  231 |             const { status, body } = await appointments.rescheduleAppointment(bookBody.id, newSlotId, patient1Auth);
> 232 |             expect(status).toBe(200);
      |                            ^ Error: expect(received).toBe(expected) // Object.is equality
  233 |             expect(body.slotId).toBe(newSlotId);
  234 | 
  235 |             const { status: myStatus, body: myBody } = await appointments.listMy(patient2Auth);
  236 |             expect(myStatus).toBe(200);
  237 |             const promoted = (Array.isArray(myBody) ? myBody : []).find(
  238 |                 (a: { slotId: number }) => a.slotId === slotBody.id,
  239 |             );
  240 |             expect(promoted, 'patient2 promoted to freed slot').toBeDefined();
  241 |             expect(promoted.status).toBe('pending');
  242 | 
  243 |             const { status: wlStatus, body: wlBody } = await appointments.getMyWaitlist(patient2Auth);
  244 |             expect(wlStatus).toBe(200);
  245 |             expect(
  246 |                 wlBody.some((w: { doctorId: number }) => w.doctorId === doctor.doctorRecordId),
  247 |                 'patient2 removed from waitlist after promotion',
  248 |             ).toBe(false);
  249 | 
  250 |             const dbOldSlot = dbClient.getSlotById(slotBody.id);
  251 |             expect(dbOldSlot!.isAvailable, 'DB: old slot taken by promoted patient').toBe(0);
  252 | 
  253 |             const dbWaitlist = dbClient.getWaitlistByPatient(user2.user.id);
  254 |             expect(dbWaitlist, 'DB: patient2 waitlist entry removed').toHaveLength(0);
  255 | 
  256 |             const dbAppts = dbClient.getActiveAppointmentsForSlot(slotBody.id);
  257 |             expect(dbAppts).toHaveLength(1);
  258 |             expect(dbAppts[0].patientId, 'DB: slot appointment belongs to patient2').toBe(user2.user.id);
  259 |         } finally {
  260 |             await cleanup();
  261 |         }
  262 |     },
  263 | );
  264 | 
```
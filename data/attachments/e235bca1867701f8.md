# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/doctors.schedule.test.ts >> doctor schedule >> POST /doctors/me/slots — 201 slot within working hours @api
- Location: tests/api/doctors.schedule.test.ts:61:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 409
```

# Test source

```ts
  1   | import { test, expect } from "../../fixtures";
  2   | import { DoctorsClient } from "../../api/DoctorsClient";
  3   | import { AuthClient } from "../../api/AuthClient";
  4   | import { seedDoctors } from "../../data/seedAccounts";
  5   | 
  6   | type ScheduleEntry = { dayOfWeek: number; startTime: string; endTime: string };
  7   | 
  8   | // Returns next occurrence of given UTC day-of-week (0=Mon) at specified UTC hour, +1 week offset to avoid collisions
  9   | function slotAt(dayOfWeek: number, startHour: number, endHour: number): { startTime: string; endTime: string } {
  10  |     const now = new Date();
  11  |     const nowDay = (now.getUTCDay() + 6) % 7;
  12  |     let daysUntil = (dayOfWeek - nowDay + 7) % 7;
  13  |     if (daysUntil === 0) daysUntil = 7;
  14  |     const base = new Date(now);
  15  |     base.setUTCDate(base.getUTCDate() + daysUntil + 7); // +7 avoids conflicts with slotFixture
  16  |     base.setUTCHours(startHour, 0, 0, 0);
  17  |     const end = new Date(base);
  18  |     end.setUTCHours(endHour, 0, 0, 0);
  19  |     return { startTime: base.toISOString(), endTime: end.toISOString() };
  20  | }
  21  | 
  22  | // All-week schedule covering the given UTC hours
  23  | function weekSchedule(startTime: string, endTime: string): ScheduleEntry[] {
  24  |     return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime, endTime }));
  25  | }
  26  | 
  27  | test.describe("doctor schedule", () => {
  28  |     let doctorToken: string;
  29  |     let doctors: DoctorsClient;
  30  |     const doctor = seedDoctors[0];
  31  | 
  32  |     test.beforeEach(async ({ request }) => {
  33  |         const auth = new AuthClient(request);
  34  |         const { body } = await auth.verifyLogin(doctor.email, doctor.password);
  35  |         doctorToken = body.token;
  36  |         doctors = new DoctorsClient(request);
  37  |         // clear schedule before each test
  38  |         await doctors.setSchedule([], { headers: { Authorization: `Bearer ${doctorToken}` } });
  39  |     });
  40  | 
  41  |     test("PUT /doctors/me/schedule — 200 sets weekly schedule @smoke @api", async () => {
  42  |         const entries = weekSchedule("09:00", "17:00");
  43  |         const { status, body } = await doctors.setSchedule(entries, {
  44  |             headers: { Authorization: `Bearer ${doctorToken}` },
  45  |         });
  46  |         expect(status).toBe(200);
  47  |         expect(body.schedule).toHaveLength(7);
  48  |         expect(body.schedule[0]).toMatchObject({ dayOfWeek: 0, startTime: "09:00", endTime: "17:00" });
  49  |     });
  50  | 
  51  |     test("GET /doctors/:id/schedule — 200 returns persisted schedule @api", async () => {
  52  |         const entries: ScheduleEntry[] = [{ dayOfWeek: 1, startTime: "10:00", endTime: "14:00" }];
  53  |         await doctors.setSchedule(entries, { headers: { Authorization: `Bearer ${doctorToken}` } });
  54  | 
  55  |         const { status, body } = await doctors.getSchedule(doctor.doctorRecordId);
  56  |         expect(status).toBe(200);
  57  |         expect(body.schedule).toHaveLength(1);
  58  |         expect(body.schedule[0]).toMatchObject({ dayOfWeek: 1, startTime: "10:00", endTime: "14:00" });
  59  |     });
  60  | 
  61  |     test("POST /doctors/me/slots — 201 slot within working hours @api", async ({ request }) => {
  62  |         await doctors.setSchedule(weekSchedule("09:00", "18:00"), {
  63  |             headers: { Authorization: `Bearer ${doctorToken}` },
  64  |         });
  65  |         const { startTime, endTime } = slotAt(1, 10, 11); // Tuesday 10:00–11:00 UTC
  66  |         const { status } = await doctors.createSlot(
  67  |             doctor.doctorRecordId, startTime, endTime, true,
  68  |             { headers: { Authorization: `Bearer ${doctorToken}` } },
  69  |         );
> 70  |         expect(status).toBe(201);
      |                        ^ Error: expect(received).toBe(expected) // Object.is equality
  71  |     });
  72  | 
  73  |     test("POST /doctors/me/slots — 422 OUTSIDE_WORKING_HOURS slot outside schedule hours @api", async () => {
  74  |         await doctors.setSchedule(weekSchedule("09:00", "12:00"), {
  75  |             headers: { Authorization: `Bearer ${doctorToken}` },
  76  |         });
  77  |         const { startTime, endTime } = slotAt(1, 13, 14); // Tuesday 13:00–14:00 UTC — after 12:00
  78  |         const { status, body } = await doctors.createSlot(
  79  |             doctor.doctorRecordId, startTime, endTime, true,
  80  |             { headers: { Authorization: `Bearer ${doctorToken}` } },
  81  |         );
  82  |         expect(status).toBe(422);
  83  |         expect(body.errorCode).toBe("OUTSIDE_WORKING_HOURS");
  84  |     });
  85  | 
  86  |     test("POST /doctors/me/slots — 422 OUTSIDE_WORKING_HOURS slot on day not in schedule @api", async () => {
  87  |         // only Monday in schedule
  88  |         await doctors.setSchedule([{ dayOfWeek: 0, startTime: "09:00", endTime: "17:00" }], {
  89  |             headers: { Authorization: `Bearer ${doctorToken}` },
  90  |         });
  91  |         const { startTime, endTime } = slotAt(2, 10, 11); // Wednesday — not in schedule
  92  |         const { status, body } = await doctors.createSlot(
  93  |             doctor.doctorRecordId, startTime, endTime, true,
  94  |             { headers: { Authorization: `Bearer ${doctorToken}` } },
  95  |         );
  96  |         expect(status).toBe(422);
  97  |         expect(body.errorCode).toBe("OUTSIDE_WORKING_HOURS");
  98  |     });
  99  | 
  100 |     test("POST /doctors/me/slots — 201 slot at exact boundary start (09:00–10:00) @api", async () => {
  101 |         await doctors.setSchedule(weekSchedule("09:00", "17:00"), {
  102 |             headers: { Authorization: `Bearer ${doctorToken}` },
  103 |         });
  104 |         const { startTime, endTime } = slotAt(3, 9, 10); // Wednesday 09:00–10:00 — boundary start
  105 |         const { status } = await doctors.createSlot(
  106 |             doctor.doctorRecordId, startTime, endTime, true,
  107 |             { headers: { Authorization: `Bearer ${doctorToken}` } },
  108 |         );
  109 |         expect(status).toBe(201);
  110 |     });
  111 | 
  112 |     test("POST /doctors/me/slots — 201 slot at exact boundary end (16:00–17:00) @api", async () => {
  113 |         await doctors.setSchedule(weekSchedule("09:00", "17:00"), {
  114 |             headers: { Authorization: `Bearer ${doctorToken}` },
  115 |         });
  116 |         const { startTime, endTime } = slotAt(3, 16, 17); // Wednesday 16:00–17:00 — boundary end
  117 |         const { status } = await doctors.createSlot(
  118 |             doctor.doctorRecordId, startTime, endTime, true,
  119 |             { headers: { Authorization: `Bearer ${doctorToken}` } },
  120 |         );
  121 |         expect(status).toBe(201);
  122 |     });
  123 | 
  124 |     test("POST /doctors/me/slots — 422 OUTSIDE_WORKING_HOURS slot ends after schedule (16:00–18:00) @api", async () => {
  125 |         await doctors.setSchedule(weekSchedule("09:00", "17:00"), {
  126 |             headers: { Authorization: `Bearer ${doctorToken}` },
  127 |         });
  128 |         const { startTime, endTime } = slotAt(3, 16, 18); // starts in window but ends outside
  129 |         const { status, body } = await doctors.createSlot(
  130 |             doctor.doctorRecordId, startTime, endTime, true,
  131 |             { headers: { Authorization: `Bearer ${doctorToken}` } },
  132 |         );
  133 |         expect(status).toBe(422);
  134 |         expect(body.errorCode).toBe("OUTSIDE_WORKING_HOURS");
  135 |     });
  136 | 
  137 |     test("POST /doctors/me/slots — 201 no schedule set → always allowed @api", async () => {
  138 |         // schedule cleared in beforeEach
  139 |         const { startTime, endTime } = slotAt(4, 10, 11);
  140 |         const { status } = await doctors.createSlot(
  141 |             doctor.doctorRecordId, startTime, endTime, true,
  142 |             { headers: { Authorization: `Bearer ${doctorToken}` } },
  143 |         );
  144 |         expect(status).toBe(201);
  145 |     });
  146 | 
  147 |     test("POST /doctors/me/slots — 422 OUTSIDE_WORKING_HOURS timezone offset resolves to UTC outside hours @api", async () => {
  148 |         // schedule: all days 10:00–17:00 UTC
  149 |         await doctors.setSchedule(weekSchedule("10:00", "17:00"), {
  150 |             headers: { Authorization: `Bearer ${doctorToken}` },
  151 |         });
  152 |         // slot at "10:00 UTC+5" = 05:00 UTC — outside 10:00–17:00 UTC window
  153 |         const base = new Date();
  154 |         const nowDay = (base.getUTCDay() + 6) % 7;
  155 |         let daysUntil = (1 - nowDay + 7) % 7;
  156 |         if (daysUntil === 0) daysUntil = 14;
  157 |         base.setUTCDate(base.getUTCDate() + daysUntil + 7);
  158 |         base.setUTCHours(5, 0, 0, 0); // 05:00 UTC = 10:00 UTC+5
  159 |         const end = new Date(base);
  160 |         end.setUTCHours(6, 0, 0, 0);
  161 |         // send with explicit +05:00 offset to confirm server validates UTC, not local
  162 |         const startTime = base.toISOString().replace("Z", "+05:00");
  163 |         const endTime = end.toISOString().replace("Z", "+05:00");
  164 | 
  165 |         const { status, body } = await doctors.createSlot(
  166 |             doctor.doctorRecordId, startTime, endTime, true,
  167 |             { headers: { Authorization: `Bearer ${doctorToken}` } },
  168 |         );
  169 |         expect(status).toBe(422);
  170 |         expect(body.errorCode).toBe("OUTSIDE_WORKING_HOURS");
```
const { test, expect } = require("@playwright/test");
const { DoctorsClient } = require("../../api/DoctorsClient");
const { validateDoctorsList } = require("../../data/schemas/doctorsSchemas");

test("GET /api/v1/doctors — list doctors @smoke", async ({ request }) => {
    const doctors = new DoctorsClient(request);
    const { status, body } = await doctors.list();
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const ok = validateDoctorsList(body);
    expect(ok, JSON.stringify(validateDoctorsList.errors)).toBe(true);
});

test("GET /api/v1/doctors — idempotent, repeated call returns same data @api", async ({ request }) => {
    const doctors = new DoctorsClient(request);

    const { status: status1, body: body1 } = await doctors.list();
    const { status: status2, body: body2 } = await doctors.list();

    expect(status1).toBe(200);
    expect(status2).toBe(200);
    expect(body1).toEqual(body2);
});



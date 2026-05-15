import { test, expect } from '@playwright/test';
import { DoctorsClient } from '../../api/DoctorsClient';
import { validateDoctorsList } from '../../data/schemas/doctorsSchemas';

test("GET /api/v1/doctors — list doctors @smoke", async ({ request }) => {
    const doctors = new DoctorsClient(request);
    const { status, body } = await doctors.list();
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const ok = validateDoctorsList(body);
    expect(ok, JSON.stringify(validateDoctorsList.errors)).toBe(true);
});

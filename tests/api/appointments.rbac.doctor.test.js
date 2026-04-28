const { test, expect } = require("../../fixtures");
const { endpoints } = require("../../data/testData");

test("GET /api/v1/appointments/doctor — 403 when patient JWT @smoke", async ({ request, user }) => {
    const response = await request.get(endpoints.appointmentsDoctor, {
        headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.errorCode).toBe("FORBIDDEN");
});

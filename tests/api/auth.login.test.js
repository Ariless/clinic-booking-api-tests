const { test, expect } = require("../../fixtures/userFixture");
const { AuthClient } = require("../../api/AuthClient");

test("POST /api/v1/auth/login — patient from fixture (register + login + teardown) @smoke", async ({
    request,
    user,
}) => {
    expect(user.token).toBeTruthy();
    expect(user.email).toMatch(/^test_/);

    const auth = new AuthClient(request);
    const { status, body } = await auth.verifyLogin(user.email, user.password);
    expect(status).toBe(200);
    expect(body.token).toBeTruthy();
});

const { test, expect } = require("../../fixtures/userFixture");
const { AuthClient } = require("../../api/AuthClient");
const { assertSchema } = require("../../utils/schemaValidator");
const { validateTokenResponse } = require("../../data/schemas/authSchemas");

const LOGIN_MAX = parseInt(process.env.RATE_LIMIT_LOGIN_MAX ?? "10");

test("POST /api/v1/auth/login — 200 patient login returns token + user @smoke", async ({
    request,
    user,
}) => {
    expect(user.token).toBeTruthy();
    expect(user.email).toMatch(/^test_/);

    const auth = new AuthClient(request);
    const { status, body } = await auth.verifyLogin(user.email, user.password);
    expect(status).toBe(200);
    assertSchema(body, validateTokenResponse);
    expect(body.token).toBeTruthy();
});

test("POST /api/v1/auth/login — 429 RATE_LIMITED after exhausting per-IP login limit @rate-limit", async ({ request }) => {
    test.skip(LOGIN_MAX > 5, `RATE_LIMIT_LOGIN_MAX=${LOGIN_MAX}; set RATE_LIMIT_LOGIN_MAX=2 and RATE_LIMIT_LOGIN_WINDOW_MS=5000 to run`);
    const auth = new AuthClient(request);
    for (let i = 0; i < LOGIN_MAX; i++) {
        await auth.verifyLogin(`exhaust_login_${i}@example.com`, "wrong");
    }
    const { status, body } = await auth.verifyLogin("final_login@example.com", "wrong");
    expect(status).toBe(429);
    expect(body.errorCode).toBe("RATE_LIMITED");
    expect(body.message).toBeTruthy();
    expect(body.requestId).toBeTruthy();
});

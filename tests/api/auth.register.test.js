const { test, expect } = require("@playwright/test");
const { UserClient } = require("../../api/UserClient");
const { generateUser } = require("../../utils/userUtils");
const { seedDoctors } = require("../../data/seedAccounts");

const REGISTER_MAX = parseInt(process.env.RATE_LIMIT_REGISTER_MAX ?? "5");

test.describe("POST /api/v1/auth/register — patient", () => {
    test("201: unique patient, token returned; teardown DELETE /auth/me", async ({ request }) => {
        const users = new UserClient(request);
        const userData = generateUser();
        const { status, body } = await users.registerPatient({
            email: userData.email,
            password: userData.password,
            name: userData.name,
        });
        expect(status).toBe(201);
        expect(body.token).toBeTruthy();
        expect(body.user).toBeTruthy();

        const { status: delStatus } = await users.deleteMyAccount(body.token);
        expect(delStatus).toBe(204);
    });

    test("400 VALIDATION_ERROR when email is malformed", async ({ request }) => {
        const users = new UserClient(request);
        const { status, body } = await users.registerPatient({
            email: "not-an-email",
            password: "password",
            name: "John Doe",
        });
        expect(status).toBe(400);
        expect(body.errorCode).toBe("VALIDATION_ERROR");
    });

    test("400 VALIDATION_ERROR when password is too short", async ({ request }) => {
        const users = new UserClient(request);
        const userData = generateUser();
        const { status, body } = await users.registerPatient({
            email: userData.email,
            password: "short",
            name: userData.name,
        });
        expect(status).toBe(400);
        expect(body.errorCode).toBe("VALIDATION_ERROR");
    });
});

test.describe("POST /api/v1/auth/register — doctor", () => {
    test("201: valid doctorRecordId → token + doctorProfile; teardown DELETE /auth/me", async ({ request }) => {
        const users = new UserClient(request);
        const userData = generateUser();
        const { status, body } = await users.registerDoctor({
            email: userData.email,
            password: userData.password,
            name: userData.name,
            doctorRecordId: seedDoctors[1].doctorRecordId,
        });
        expect(status).toBe(201);
        expect(body.token).toBeTruthy();
        expect(body.user.role).toBe("doctor");
        expect(body.user.doctorRecordId).toBe(seedDoctors[1].doctorRecordId);

        const { status: delStatus } = await users.deleteMyAccount(body.token);
        expect(delStatus).toBe(204);
    });

    test("404 DOCTOR_NOT_FOUND when doctorRecordId does not exist", async ({ request }) => {
        const users = new UserClient(request);
        const userData = generateUser();
        const { status, body } = await users.registerDoctor({
            email: userData.email,
            password: userData.password,
            name: userData.name,
            doctorRecordId: 999999,
        });
        expect(status).toBe(404);
        expect(body.errorCode).toBe("DOCTOR_NOT_FOUND");
    });

    test("400 VALIDATION_ERROR when doctorRecordId is missing", async ({ request }) => {
        const users = new UserClient(request);
        const userData = generateUser();
        const { status, body } = await users.registerDoctor({
            email: userData.email,
            password: userData.password,
            name: userData.name,
            doctorRecordId: undefined,
        });
        expect(status).toBe(400);
        expect(body.errorCode).toBe("VALIDATION_ERROR");
    });
});

test("POST /api/v1/auth/register — 429 RATE_LIMITED after exhausting per-IP register limit @rate-limit", async ({ request }) => {
    test.skip(REGISTER_MAX > 5, `RATE_LIMIT_REGISTER_MAX=${REGISTER_MAX}; set RATE_LIMIT_REGISTER_MAX=2 and RATE_LIMIT_REGISTER_WINDOW_MS=5000 to run`);
    const users = new UserClient(request);
    for (let i = 0; i < REGISTER_MAX; i++) {
        await users.registerPatient({ email: "not-an-email", password: "short", name: "n" });
    }
    const { status, body } = await users.registerPatient({ email: "not-an-email", password: "short", name: "n" });
    expect(status).toBe(429);
    expect(body.errorCode).toBe("RATE_LIMITED");
    expect(body.message).toBeTruthy();
    expect(body.requestId).toBeTruthy();
});

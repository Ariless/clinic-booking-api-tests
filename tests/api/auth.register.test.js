const { test, expect } = require("@playwright/test");
const { UserClient } = require("../../api/UserClient");
const { generateUser } = require("../../utils/userUtils");
const { seedDoctors } = require("../../data/seedAccounts");

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

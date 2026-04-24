const { test: base } = require("@playwright/test");
const { generateUser } = require("../utils/userUtils");
const { UserClient } = require("../api/UserClient");

const test = base.extend({
    // Setup: creates a unique user via API before the test.
    // Teardown: deletes the user via API after the test, even if the test fails.
    // This keeps each test fully isolated — no shared state between tests.
    user: async ({ request }, use) => {
        const userClient = new UserClient(request);
        const userData = generateUser();

        const { status, body } = await userClient.registerPatient({
            email: userData.email,
            password: userData.password,
            name: userData.name ?? "Test Patient",
        });

        if (status !== 201 || !body.token) {
            throw new Error(`user fixture failed: ${JSON.stringify(body)}`);
        }

        const userPayload = {
            ...userData,
            token: body.token,
            refreshToken: body.refreshToken,
            user: body.user,
        };

        await use(userPayload);

        await userClient.deleteMyAccount(userPayload.token);
    },
});

module.exports = { test, expect: base.expect };

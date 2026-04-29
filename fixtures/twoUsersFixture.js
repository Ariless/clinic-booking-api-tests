const { test: base, expect } = require("./slotFixture");
const { generateUser } = require("../utils/userUtils");
const { UserClient } = require("../api/UserClient");

const test = base.extend({
    user2: async ({ request }, use) => {
        const userClient = new UserClient(request);
        const userData = generateUser();

        const { status, body } = await userClient.registerPatient({
            email: userData.email,
            password: userData.password,
            name: userData.name ?? "Test Patient",
        });

        if (status !== 201 || !body.token) {
            throw new Error(`user2 fixture failed: ${JSON.stringify(body)}`);
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

module.exports = { test, expect };

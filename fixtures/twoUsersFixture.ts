import { test as base, expect } from "./slotFixture";
import { generateUser } from "../utils/userUtils";
import { UserClient } from "../api/UserClient";
import type { UserPayload } from "./userFixture";

export const test = base.extend<{ user2: UserPayload }>({
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

        const userPayload: UserPayload = {
            ...userData,
            token: body.token,
            refreshToken: body.refreshToken,
            user: body.user,
        };

        await use(userPayload);

        await userClient.deleteMyAccount(userPayload.token);
    },
});

export { expect };

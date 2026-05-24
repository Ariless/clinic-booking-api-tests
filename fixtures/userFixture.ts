import { test as base } from "@playwright/test";
import { generateUser } from "../utils/userUtils";
import { UserClient } from "../api/UserClient";

export type UserPayload = {
    email: string;
    name: string;
    password: string;
    token: string;
    refreshToken: string;
    user: { id: number; email: string; role: string; name: string; [key: string]: unknown };
};

export const test = base.extend<{ user: UserPayload }>({
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

export const expect = base.expect;

import "dotenv/config";

interface UserData {
    email: string;
    name: string;
    password: string;
}

export function generateUser(): UserData {
    const id = Date.now();
    const rnd = Math.random().toString(36).slice(2, 10);
    return {
        email: `test_${id}_${rnd}@example.com`,
        name: `user_${id}`,
        password: process.env.TEST_USER_PASSWORD ?? "password",
    };
}
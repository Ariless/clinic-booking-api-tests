import { AuthClient } from "../api/AuthClient";
import type { APIRequestContext } from "@playwright/test";
import type { SeedDoctor } from "../data/seedAccounts";

export async function loginDoctor(request: APIRequestContext, doctor: SeedDoctor): Promise<string> {
    const auth = new AuthClient(request);
    const { status, body } = await auth.verifyLogin(doctor.email, doctor.password);
    if (status !== 200) throw new Error("Doctor login failed");
    return body.token;
}

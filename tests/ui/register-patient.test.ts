import { test, expect } from "../../fixtures";

test("register page — error shown when required fields are empty @ui", async ({ registerPage }) => {
    await registerPage.submitForm("", "", "");
    await expect(registerPage.submitErrorMessage).toBeVisible();
});
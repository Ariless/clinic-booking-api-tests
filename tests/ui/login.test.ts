import { test, expect } from "../../fixtures";

test("login page — error shown for invalid credentials @ui", async ({ loginPage }) => {
    await loginPage.submitForm("wrong@test.com", "wrongpassword");
    await expect(loginPage.errorMessage).toBeVisible();
});
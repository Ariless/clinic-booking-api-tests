const { test, expect } = require("@playwright/test");
const {LoginPage} = require("../../pages/LoginPage");

test("login page — error shown for invalid credentials @ui", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.submitForm("wrong@test.com", "wrongpassword");

    await expect(page.getByTestId("login-error")).toBeVisible();
});
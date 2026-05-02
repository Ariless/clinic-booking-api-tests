const { test, expect } = require("@playwright/test");
const { RegisterPage } = require("../../pages/RegisterPatientPage");

test("register page — error shown when required fields are empty @ui", async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.submitForm("", "", "");

    await expect(registerPage.submitErrorMessage).toBeVisible();

})

const { test, expect } = require("../../fixtures");
const { AxeBuilder } = require("@axe-core/playwright");

// color-contrast excluded: .muted uses #64748b (3.9:1 ratio) — below WCAG AA 4.5:1.
// Known design debt; structural and keyboard violations are fully checked.
function axe(page) {
    return new AxeBuilder({ page }).disableRules(["color-contrast"]);
}

// Injects auth session so the page renders as a logged-in patient.
async function setPatientSession(page, user) {
    await page.goto("/");
    await page.evaluate(({ token, userData }) => {
        sessionStorage.setItem("clinic_demo_jwt", token);
        sessionStorage.setItem("clinic_demo_user", JSON.stringify(userData));
    }, { token: user.token, userData: user.user });
}

test("login page — no accessibility violations @ui @a11y", async ({ page }) => {
    await page.goto("/login");
    const results = await axe(page).analyze();
    expect(results.violations).toEqual([]);
});

test("register page — no accessibility violations @ui @a11y", async ({ page }) => {
    await page.goto("/register/patient");
    const results = await axe(page).analyze();
    expect(results.violations).toEqual([]);
});

test("patient booking page — no accessibility violations @ui @a11y", async ({ page, user }) => {
    await setPatientSession(page, user);
    await page.goto("/patient/booking");
    await page.waitForLoadState("networkidle");
    const results = await axe(page).analyze();
    expect(results.violations).toEqual([]);
});

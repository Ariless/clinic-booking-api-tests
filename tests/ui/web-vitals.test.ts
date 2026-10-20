import { test, expect } from "../../fixtures";
import { observeVitals, readVitals, slowDownCpu, VITALS_GOOD } from "../../utils/webVitals";

// Core Web Vitals as a lab regression guard. Runs in both projects: desktop Chrome and the Pixel 7
// viewport. All three metrics come from Chromium-only browser APIs, which is why this file has no
// WebKit or Firefox counterpart. Why these pages and thresholds: docs/WEB_VITALS.md.

test.describe("core web vitals @ui", () => {

    test.beforeEach(async ({ page }) => {
        await observeVitals(page);
        await slowDownCpu(page);
    });

    test("login page — largest contentful paint within 2.5 s on a 4x slower CPU @ui", async ({ page }) => {
        await page.goto("/login");
        await page.waitForLoadState("load");

        const { lcp } = await readVitals(page);

        // A null LCP would pass any "less than" check — the meter must have seen a paint first.
        expect(lcp, "no LCP candidate was reported").not.toBeNull();
        expect(lcp!).toBeLessThanOrEqual(VITALS_GOOD.lcpMs);
    });

    test("booking page — layout shift stays under 0.1 while the wizard loads @ui",
        async ({ page, user, loginPage, bookingPage }) => {
            await loginPage.login(user.email, user.password);
            await bookingPage.open();
            await expect(bookingPage.wizardStep1).toBeVisible();
            await page.waitForLoadState("networkidle");

            // clsAnyCause, not cls: the test sends no input on this page, and in mobile emulation the
            // browser flags early shifts as input-driven, which would hide a real load-time shift.
            const { clsAnyCause } = await readVitals(page);

            expect(clsAnyCause).toBeLessThanOrEqual(VITALS_GOOD.cls);
        },
    );

    test("login form — typing responds within 200 ms (INP) on a 4x slower CPU @ui", async ({ page, loginPage }) => {
        await page.goto("/login");
        // Real key presses: Playwright sends them through the browser's input pipeline, so they are
        // trusted events with an interactionId. fill() or a dispatched event would not count as INP.
        await loginPage.emailInput.click();
        await loginPage.emailInput.pressSequentially("typing.check@example.org");

        const { inp, interactions } = await readVitals(page);

        expect(interactions, "the browser registered no interaction to measure").toBeGreaterThan(0);
        expect(inp!).toBeLessThanOrEqual(VITALS_GOOD.inpMs);
    });

    test("web vitals meter — reports a layout shift injected into the page @ui", async ({ page }) => {
        // Control test for the meter itself. A CLS of 0 is a valid result, so the booking test above
        // cannot tell "no shift" from "observer not running". Here a shift is caused on purpose:
        // if this test fails, a green CLS test means nothing.
        await page.goto("/login");
        await page.waitForLoadState("load");
        // The login form is centred with flexbox, so padding on the body moves it down by half the value.
        // The shift is scheduled 600 ms out, past the 500 ms window in which the browser treats a shift
        // as caused by recent input and leaves it out of CLS (in mobile emulation that window opens on
        // navigation). The timer runs in the page, so the test itself never sleeps.
        await page.evaluate(
            () => new Promise<void>((done) => setTimeout(() => {
                document.body.style.paddingTop = "300px";
                done();
            }, 600)),
        );
        await expect.poll(async () => (await readVitals(page)).cls).toBeGreaterThan(0);
    });
});

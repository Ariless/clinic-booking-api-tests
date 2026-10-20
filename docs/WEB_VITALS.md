# Core Web Vitals — what the suite measures and why

`tests/ui/web-vitals.test.ts` · `utils/webVitals.ts` · added 2026-10-20

## The three metrics

| Metric | What the customer feels | Good | How the browser reports it |
|---|---|---|---|
| **LCP** — Largest Contentful Paint | "The page has loaded": the biggest text block or image is on screen | ≤ 2.5 s | `largest-contentful-paint` entries; each larger paint replaces the candidate, the last one counts |
| **INP** — Interaction to Next Paint | "The page reacts": time from a click, tap or key press to the next frame on screen | ≤ 200 ms | `event` entries grouped by `interactionId`; the slowest interaction is the INP (below 50 interactions) |
| **CLS** — Cumulative Layout Shift | "The page doesn't jump": content moving under the customer's finger | ≤ 0.1 | `layout-shift` entries, grouped into session windows (gap < 1 s, window < 5 s); CLS is the worst window |

INP replaced FID (First Input Delay) in March 2024. FID measured only the delay before the first
handler ran; INP covers every interaction and the time until the screen actually updates.

Google assesses a site on the **75th percentile of real users** (field data, the Chrome UX Report).
A page passes when 75% of visits are within "good".

## Lab vs field — what this suite can and cannot claim

These tests are **lab** measurements: one synthetic visit, on CI hardware, against a local SUT.
They do not say how fast the site is for real customers. They say: under the same conditions,
did this change make the page slower to paint, slower to react, or jumpier? That is a regression
guard, and it is the part of performance a test suite can own.

To make the budget mean something on fast hardware, every test runs on a **4x slower CPU**
(`Emulation.setCPUThrottlingRate`, the same factor as Lighthouse's mobile preset), in both desktop
Chrome and the Pixel 7 project.

Measured on 2026-10-20, localhost: LCP ~60 ms, CLS 0, INP ~56 ms. Far inside the thresholds — the
pages are small and served locally. The tests are there to catch the day that changes.

## Why the meter is hand-written

The numbers come from the browser's own `PerformanceObserver` entries — the same ones the
`web-vitals` library reads — collected by an init script injected before any page script runs.
No dependency, and every number traces back to a browser API.

## Four things learned building it

1. **Observer callbacks arrive after the paint.** Reading right after `load` returned `lcp: null`;
   the entry arrived a frame later. `readVitals()` waits two animation frames and a task first.
2. **A "good" result can mean "nothing measured".** A null LCP passes `toBeLessThanOrEqual`, an INP
   with zero interactions is trivially fast, a CLS of 0 is indistinguishable from a dead observer.
   So the LCP test asserts a candidate exists, the INP test asserts interactions were registered,
   and a control test injects a layout shift that must show up.
3. **The control test caught a real blind spot.** In the mobile-chrome project the browser flags
   shifts in the first ~500 ms after navigation as `hadRecentInput` although the test sent no input.
   Standard CLS excludes those, so a load-time shift on mobile would have passed silently. The
   booking test reads `clsAnyCause` (every shift counted); it performs no input on that page.
4. **Only trusted input counts for INP.** `pressSequentially` and `click` go through the browser's
   input pipeline and get an `interactionId`. `fill()` or a dispatched event would not, and INP
   would stay empty.

## Checked from the other side

One-off runs, not committed:

| Change | Result |
|---|---|
| 3 s delay on the `/login` document (slow server) | LCP 3068 ms — test fails |
| 300 ms busy `keydown` handler | INP 360 ms — test fails |
| 3 s delay on scripts and other subresources | LCP ~136 ms — test passes: the login text paints before the script loads, which is correct |

## Limits

- **Chromium only.** `largest-contentful-paint` and `layout-shift` are not available in WebKit or
  Firefox, so this file does not run on BrowserStack.
- **No network throttling.** CPU slowdown only; a local SUT has no meaningful network latency.
- **Not field data.** Real-user monitoring (CrUX, or the `web-vitals` library sending to analytics)
  is what tells you how customers actually experience the site.

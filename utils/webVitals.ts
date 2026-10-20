import type { Page } from "@playwright/test";

// Core Web Vitals measured in the lab, inside the browser, with the same PerformanceObserver entries
// the `web-vitals` library reads — no extra dependency, so every number below can be traced to a
// browser API rather than to a black box.
//
// What this is NOT: field data. Google judges a site on the 75th percentile of real users (CrUX).
// A lab run on localhost is a regression guard: it fails when a change makes the page measurably
// slower or jumpier under the same conditions, which is the part a test suite can own.
// Details and the reasoning behind the thresholds: docs/WEB_VITALS.md.

/** Google's "good" thresholds. A value at or below the threshold is good. */
export const VITALS_GOOD = {
    lcpMs: 2500,
    inpMs: 200,
    cls: 0.1,
} as const;

export type Vitals = {
    /** Largest Contentful Paint, ms from navigation start. null if no candidate was reported. */
    lcp: number | null;
    /** Cumulative Layout Shift, largest session window (the definition Chrome uses). */
    cls: number;
    /**
     * The same calculation without excluding shifts flagged hadRecentInput. In the mobile-chrome
     * project the browser flags shifts in the first ~500 ms after navigation as input-driven although
     * the test sent no input, so `cls` under-reports load-time shifts there. Use this one on pages
     * where the test itself does nothing after navigating. See docs/WEB_VITALS.md.
     */
    clsAnyCause: number;
    /** Interaction to Next Paint, ms. null if the page saw no trusted interaction. */
    inp: number | null;
    /** Trusted interactions the browser registered. Guards against an INP that is "good" only because nothing was measured. */
    interactions: number;
};

/**
 * Starts the observers before any page script runs. Call before the first navigation:
 * addInitScript re-runs on every document, so the numbers always belong to the current page.
 */
export async function observeVitals(page: Page): Promise<void> {
    await page.addInitScript(() => {
        type Store = {
            lcp: number | null;
            cls: number;
            clsAnyCause: number;
            session: { value: number; first: number; last: number };
            sessionAny: { value: number; first: number; last: number };
            eventMax: Map<number, number>;
            firstInput: number | null;
        };
        const store: Store = {
            lcp: null,
            cls: 0,
            clsAnyCause: 0,
            session: { value: 0, first: 0, last: 0 },
            sessionAny: { value: 0, first: 0, last: 0 },
            eventMax: new Map(),
            firstInput: null,
        };
        (window as unknown as { __vitals: Store }).__vitals = store;

        const observe = (type: string, cb: (entries: PerformanceEntryList) => void, extra: object = {}) => {
            try {
                new PerformanceObserver((list) => cb(list.getEntries())).observe({ type, buffered: true, ...extra });
            } catch {
                // Entry type unsupported in this engine (LCP and layout-shift are Chromium-only).
            }
        };

        // LCP: the browser reports a new candidate each time a larger element paints.
        // The last candidate before the user interacts is the page's LCP.
        observe("largest-contentful-paint", (entries) => {
            const last = entries[entries.length - 1];
            if (last) store.lcp = last.startTime;
        });

        // CLS: shifts caused by the user's own input don't count. Shifts are grouped into session
        // windows (gap < 1 s, window < 5 s) and CLS is the worst window, not the sum over the page's life.
        observe("layout-shift", (entries) => {
            const addTo = (s: Store["session"], e: { value: number; startTime: number }) => {
                if (s.value > 0 && e.startTime - s.last < 1000 && e.startTime - s.first < 5000) {
                    s.value += e.value;
                    s.last = e.startTime;
                } else {
                    Object.assign(s, { value: e.value, first: e.startTime, last: e.startTime });
                }
                return s.value;
            };
            for (const e of entries as unknown as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
                store.clsAnyCause = Math.max(store.clsAnyCause, addTo(store.sessionAny, e));
                if (e.hadRecentInput) continue;
                store.cls = Math.max(store.cls, addTo(store.session, e));
            }
        });

        // INP: every trusted interaction (click, tap, key press) gets an interactionId. Its latency is
        // the longest event duration in that interaction: input delay + handlers + time to next paint.
        // With fewer than 50 interactions, INP is simply the worst one.
        observe(
            "event",
            (entries) => {
                for (const e of entries as unknown as Array<PerformanceEntry & { interactionId: number }>) {
                    if (!e.interactionId) continue;
                    const prev = store.eventMax.get(e.interactionId) ?? 0;
                    store.eventMax.set(e.interactionId, Math.max(prev, e.duration));
                }
            },
            // 16 ms is the lowest threshold the API allows; faster interactions are not reported at all.
            { durationThreshold: 16 },
        );

        // first-input is reported whatever its duration, so it proves an interaction happened even
        // when every event was faster than 16 ms and the "event" observer stayed silent.
        observe("first-input", (entries) => {
            const e = entries[0];
            if (e) store.firstInput = e.duration;
        });
    });
}

/**
 * Reads what the observers collected on the current document. Observer callbacks are delivered
 * asynchronously, after the browser paints: reading straight after `load` returned a null LCP that
 * arrived a frame later. So the read first waits two animation frames and one task.
 */
export async function readVitals(page: Page): Promise<Vitals> {
    await page.evaluate(
        () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 0)))),
    );
    return page.evaluate(() => {
        const s = (window as unknown as {
            __vitals?: { lcp: number | null; cls: number; clsAnyCause: number; eventMax: Map<number, number>; firstInput: number | null };
        }).__vitals;
        if (!s) throw new Error("observeVitals(page) was not called before navigation");
        const durations = [...s.eventMax.values()];
        const inp = durations.length ? Math.max(...durations) : s.firstInput;
        return {
            lcp: s.lcp,
            cls: s.cls,
            clsAnyCause: s.clsAnyCause,
            inp,
            interactions: Math.max(durations.length, s.firstInput === null ? 0 : 1),
        };
    });
}

/**
 * Slows the CPU the way Lighthouse's mobile preset does (4x). On a fast laptop every page is fast;
 * the slowdown makes the budget mean something closer to a mid-range phone. Chromium only (CDP).
 */
export async function slowDownCpu(page: Page, rate = 4): Promise<void> {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
}

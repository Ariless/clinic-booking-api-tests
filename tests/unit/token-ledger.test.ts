// What a run costs, held as assertions.
//
// Until 2026-08-28 the suite had no answer to "what did that cost". `max_tokens` was the only
// ceiling anywhere in the repository, and it bounds one response — a run of 40 calls and a run of
// 4,000 look the same to it. The ledger exists because the `@rag` layer was blocked for a week by
// "credit balance too low" and nothing could say what the runs before it had spent.
//
// The tests below hold the three things that make a ledger worth trusting: it adds up across
// processes (Playwright uses several workers, and `scripts/` runs as separate `node` invocations),
// it prices what it counts, and it says so when it *cannot* price something rather than reporting a
// confident undercount.

import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ledger = require('../../utils/tokenLedger') as {
    record: (e: { model?: string; usage?: unknown; label?: string }) => unknown;
    summarise: () => {
        calls: number;
        totalUsd: number;
        inputTokens: number;
        outputTokens: number;
        usageMissingCalls: number;
        byModel: Record<string, { calls: number; usd: number }>;
        unpricedModels: string[];
    };
    checkBudget: (s?: unknown) => { withinBudget: boolean; reasons: string[] };
    reset: () => void;
};

/** Each test gets its own ledger file, so they can run in any order and in parallel. */
function useScratchLedger(): string {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-')), 'usage.jsonl');
    process.env.CLAUDE_TOKEN_LEDGER = file;
    return file;
}

test.describe('the token ledger accounts for what a run spends @unit', () => {
    test.afterEach(() => {
        delete process.env.CLAUDE_TOKEN_LEDGER;
        delete process.env.CLAUDE_RUN_BUDGET_USD;
        delete process.env.CLAUDE_RUN_BUDGET_CALLS;
    });

    test('a million input tokens of Haiku costs the price on the card @unit', () => {
        useScratchLedger();
        ledger.record({
            model: 'claude-haiku-4-5-20251001',
            usage: { input_tokens: 1_000_000, output_tokens: 0 },
        });

        // $1.00 per million input — config/pricing.json. Arithmetic, but the arithmetic is the
        // product here: a ledger that counts tokens and prices them wrong reports a wrong bill
        // with the same confidence as a right one.
        expect(ledger.summarise().totalUsd).toBeCloseTo(1.0, 6);
    });

    test('the judge and the subject are billed at their own rates @unit', () => {
        useScratchLedger();
        // Opus 5 at $5/$25 against Haiku at $1/$5 — the reason the judge moved to another family is
        // also the reason the two cannot share a rate.
        ledger.record({ model: 'claude-opus-5', usage: { input_tokens: 200_000, output_tokens: 40_000 } });
        ledger.record({ model: 'claude-haiku-4-5-20251001', usage: { input_tokens: 200_000, output_tokens: 40_000 } });

        const s = ledger.summarise();
        expect(s.byModel['claude-opus-5'].usd).toBeCloseTo(0.2 * 5 + 0.04 * 25, 6);
        expect(s.byModel['claude-haiku-4-5-20251001'].usd).toBeCloseTo(0.2 * 1 + 0.04 * 5, 6);
        expect(s.totalUsd).toBeCloseTo(2.0 + 0.4, 6);
    });

    test('calls from separate processes add up to one total @unit', () => {
        const file = useScratchLedger();
        // The load-bearing property. Playwright runs tests in several worker processes and the five
        // reporting scripts are separate `node` invocations; an in-memory counter in any one of them
        // reports a fraction of the run and calls it the total. Written here the way the workers
        // write it — appended lines, no shared state.
        fs.appendFileSync(
            file,
            [
                JSON.stringify({ at: '', label: 'worker-1', model: 'claude-haiku-4-5-20251001', inputTokens: 500_000, outputTokens: 0 }),
                JSON.stringify({ at: '', label: 'worker-2', model: 'claude-haiku-4-5-20251001', inputTokens: 500_000, outputTokens: 0 }),
            ].join('\n') + '\n'
        );
        ledger.record({ model: 'claude-haiku-4-5-20251001', usage: { input_tokens: 0, output_tokens: 200_000 } });

        const s = ledger.summarise();
        expect(s.calls).toBe(3);
        expect(s.inputTokens).toBe(1_000_000);
        expect(s.totalUsd).toBeCloseTo(1.0 + 1.0, 6);
    });

    test('a run over the dollar budget is not within budget @unit', () => {
        useScratchLedger();
        process.env.CLAUDE_RUN_BUDGET_USD = '0.10';
        ledger.record({ model: 'claude-opus-5', usage: { input_tokens: 1_000_000, output_tokens: 0 } });

        const verdict = ledger.checkBudget();
        expect(verdict.withinBudget).toBe(false);
        expect(verdict.reasons.join(' ')).toContain('budget');
    });

    test('a run of many cheap calls is caught by the call budget @unit', () => {
        useScratchLedger();
        // The failure the dollar figure alone misses: a loop that calls the model hundreds of times
        // for pennies is still a runaway, and on a metered key it is the one that empties it.
        process.env.CLAUDE_RUN_BUDGET_USD = '100';
        process.env.CLAUDE_RUN_BUDGET_CALLS = '5';
        for (let i = 0; i < 6; i += 1) {
            ledger.record({ model: 'claude-haiku-4-5-20251001', usage: { input_tokens: 10, output_tokens: 10 } });
        }

        const verdict = ledger.checkBudget();
        expect(verdict.withinBudget).toBe(false);
        expect(verdict.reasons.join(' ')).toContain('calls');
    });

    test('an unpriced model is reported as an undercount, not as free @unit', () => {
        useScratchLedger();
        // The quiet failure mode: someone points the suite at a model with no rate on the card, the
        // ledger prices it at zero, and the run reports $0.00 while spending money.
        ledger.record({ model: 'claude-some-future-model', usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 } });

        const verdict = ledger.checkBudget();
        expect(ledger.summarise().unpricedModels).toEqual(['claude-some-future-model']);
        expect(verdict.withinBudget).toBe(false);
        expect(verdict.reasons.join(' ')).toContain('undercount');
    });

    test('a replayed call with no usage still counts as a call @unit', () => {
        useScratchLedger();
        // Replay answers from disk and may carry no `usage`. Dropping the entry would make a replay
        // run look like it made no calls at all; recording it at zero tokens keeps the count honest
        // and the dollar figure truthful.
        ledger.record({ model: 'claude-haiku-4-5-20251001', usage: undefined });

        const s = ledger.summarise();
        expect(s.calls).toBe(1);
        expect(s.usageMissingCalls).toBe(1);
        expect(s.totalUsd).toBe(0);
    });

    test('a run that calls nothing reports nothing @unit', () => {
        useScratchLedger();
        const s = ledger.summarise();

        expect(s.calls).toBe(0);
        expect(s.totalUsd).toBe(0);
        expect(ledger.checkBudget().withinBudget).toBe(true);
    });
});

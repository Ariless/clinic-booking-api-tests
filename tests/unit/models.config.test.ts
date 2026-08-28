// The rules that make `config/models.ts` worth having, held as assertions rather than as a comment.
//
// The first one is the point of the file. A judge that runs on the model it judges cannot catch the
// failures that model is prone to — it shares them, and agrees with a weak answer for the same
// reason the answer was weak. That was the state of the `@rag` LLM judge until 2026-08-27: same id,
// same family, same price tier as the endpoint under test. Nothing in the suite said it was wrong,
// so nothing would have said it if it happened again.
//
// The others guard the two mistakes the refactor itself could introduce: a drift sweep dragging the
// reporting tooling along with the subject, and an empty CI input being read as a model id.

import { test, expect } from '@playwright/test';
import { JUDGE_MODEL, SUBJECT_MODEL, TOOLING_MODEL, resolveModels } from '../../config/models';

/**
 * Reads the ids as if the process had started with this environment and nothing else.
 *
 * Was a re-import with `delete require.cache[...]`, which stopped resetting anything when
 * Playwright 1.62 changed how it loads TypeScript: the sweep assertion below kept passing the
 * default id back to itself and would have gone on reporting a rule it no longer checked.
 */
function loadWith(env: Record<string, string | undefined>) {
    return resolveModels(env as NodeJS.ProcessEnv);
}

test.describe('the models configuration keeps its three roles apart @unit', () => {
    test('the judge is not the model it judges @unit', () => {
        expect(JUDGE_MODEL).not.toBe(SUBJECT_MODEL);
    });

    test('a drift sweep moves the subject without moving the reporting tooling @unit', () => {
        // Otherwise a changed CI summary would not say which of the two models moved.
        const swept = loadWith({ CLAUDE_MODEL: 'claude-sonnet-5', CLAUDE_TOOLING_MODEL: undefined });

        expect(swept.SUBJECT_MODEL).toBe('claude-sonnet-5');
        expect(swept.TOOLING_MODEL).toBe(TOOLING_MODEL);
    });

    test('a blank workflow input means unset, not an empty model id @unit', () => {
        // `workflow_dispatch` passes '' for an optional input the operator left empty. Read with
        // `??` instead of `||`, every model id in that run becomes the empty string.
        const blank = loadWith({ CLAUDE_MODEL: '', CLAUDE_JUDGE_MODEL: '' });

        expect(blank.SUBJECT_MODEL).toBe(SUBJECT_MODEL);
        expect(blank.JUDGE_MODEL).toBe(JUDGE_MODEL);
    });
});

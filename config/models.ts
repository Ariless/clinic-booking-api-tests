/**
 * Every model this suite names, in one place.
 *
 * Before 2026-08-27 the id `claude-haiku-4-5-20251001` was a literal at eight call sites here and
 * two more in the SUT. Two consequences, both structural:
 *
 *  1. `model-drift.yml` could not do the job it exists for. It runs the `@rag` golden dataset weekly
 *     against the live API, but it could not run it against a *different* model, because there was
 *     nothing to override — the id was baked into every caller.
 *  2. The LLM judge ran on the same cheap model as the system it judges. A judge that is neither
 *     stronger than the defendant nor from a different family cannot catch the failures the
 *     defendant is prone to; it shares them.
 *
 * Three roles, because they answer to different pressures — collapsing them into one constant is
 * what made the second problem invisible.
 */

// The values live in `models.json` and the documentation lives here. The five reporting scripts in
// `scripts/` are CommonJS run straight through `node`, so they cannot import this file — JSON is the
// one format both halves read without a build step. Loaded the way this repo already loads JSON
// (`require(...) as ...`), rather than turning on `resolveJsonModule` for one file.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ids = require('./models.json') as { subject: string; judge: string; tooling: string };

/**
 * Reads the three ids out of an environment, defaulting to `models.json`.
 *
 * A function rather than three top-level constants so the reading itself can be asserted against a
 * given environment. The test used to re-import this module with `delete require.cache[...]`, which
 * worked only while Playwright transpiled it to CommonJS: 1.62 changed that and the sweep assertion
 * silently started reading the default. A rule that can only be tested through the loader's
 * internals is a rule that stops being tested when the loader changes.
 */
export function resolveModels(env: NodeJS.ProcessEnv = process.env) {
    return {
        SUBJECT_MODEL: env.CLAUDE_MODEL || ids.subject,
        JUDGE_MODEL: env.CLAUDE_JUDGE_MODEL || ids.judge,
        TOOLING_MODEL: env.CLAUDE_TOOLING_MODEL || ids.tooling,
    };
}

// `||`, not `??`, throughout. A workflow that offers an optional model input passes an *empty
// string* when the field is left blank, and `??` treats that as a value — every model id in the run
// would become "". Falsy-or is the correct reading of "unset" for an environment variable.

/**
 * The model under test: what the SUT asks for a recommendation, and what the drift job sweeps.
 *
 * A dated snapshot rather than the `claude-haiku-4-5` alias, deliberately. The alias follows
 * Anthropic's latest snapshot; drift detection wants the opposite — a model that changes only when
 * this line changes, so a red drift run means behaviour moved under a fixed id rather than that the
 * id started pointing somewhere else. Must match `ANTHROPIC_MODEL` in the SUT's `config/env.js`;
 * `aiServiceParity.test.js` holds the SUT's two copies together, and `SUBJECT_MODEL` is what tests
 * assert the recording was made against.
 */
export const SUBJECT_MODEL = resolveModels().SUBJECT_MODEL;

/**
 * The model that judges the subject's reasoning.
 *
 * Opus 5 — a different family and a stronger one. The judge reads a recommendation and rules on
 * whether the reasoning justifies it, which is the kind of question where sharing the defendant's
 * blind spots is not a cost saving but a silent loss of coverage: a weak judge agrees with a weak
 * answer for the same reason the answer was weak. It is also the cheapest place in this suite to
 * spend more — three calls of ~200 input and ~128 output tokens per judged test.
 *
 * Overridable so the judge can itself be swept: the `@rag` layer has never checked that the judge
 * agrees with a human, and the golden dataset in `eu-ai-act.steps.ts` is the material for doing it.
 */
export const JUDGE_MODEL = resolveModels().JUDGE_MODEL;

/**
 * The model behind the tooling that reports *on* the suite — bug reports, CI summaries, gap
 * analysis, flakiness classification, generated test data.
 *
 * Separate from `SUBJECT_MODEL` because a drift sweep must not move it: if the sweep changed the
 * model doing the summarising as well as the model being measured, a changed summary would not say
 * which of the two moved. Haiku on purpose — these run on every CI job and none of them gate a
 * merge.
 */
export const TOOLING_MODEL = resolveModels().TOOLING_MODEL;

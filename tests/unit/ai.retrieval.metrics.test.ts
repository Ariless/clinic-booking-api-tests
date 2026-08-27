import path from 'path';
import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';
import { RETRIEVAL_GOLDEN_SET } from '../../data/retrievalGoldenSet';
import {
    scoreRetrieval,
    scoreFalsePositives,
    scoreByKind,
    pct,
    type Retriever,
} from '../../utils/retrievalMetrics';

// The retrieval layer had exactly one documented weakness — RAG-08, "itchy" failing to match the
// keyword "itching" — found by CI rather than by review. One anecdote is not a measurement, and
// `RAG completeness` in the API suite asks a different question: whether retrieved context reached
// the reasoning, not whether retrieval found the right thing in the first place.
//
// So this file measures the retriever against a clinically-decided golden set: accuracy@1 (what mock
// mode actually serves, `retrieved[0]`), recall@3 (what the model receives as context), MRR, and
// coverage. Split by how the query is phrased, because the interesting result is not one number but
// where a lexical retriever stops working.
//
// Baseline measured 2026-08-26 on 34 answerable cases:
//   overall     acc@1 61.8%  recall@3 64.7%  MRR 0.632  coverage 67.6%
//   direct      acc@1 94.4%  recall@3 100.0%
//   morphology  acc@1 60.0%  recall@3 60.0%
//   synonym     acc@1  0.0%  recall@3  0.0%
//   colloquial  acc@1 14.3%  recall@3 14.3%
//
// The thresholds below sit at that baseline. The retriever is a pure function, so none of this can
// flake: a red test here means the algorithm, the knowledge base, or the dataset changed — all three
// are things to look at rather than re-run.

const SUT_ROOT = process.env.SUT_ROOT
    ? path.resolve(process.env.SUT_ROOT)
    : path.resolve(__dirname, '../../../sut');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { retrieve } = require(path.join(SUT_ROOT, 'src/services/retrieval')) as {
    retrieve: (symptoms: string, knowledge: unknown, n: number) => Array<{ specialty: string }>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const specialtyKnowledge = require(path.join(SUT_ROOT, 'src/data/specialtyKnowledge.json')) as unknown;

/** top-3 is what `recommendWithRag` sends the model, so it is what gets measured. */
const TOP_K = 3;

const retriever: Retriever = (symptoms) =>
    retrieve(symptoms, specialtyKnowledge, TOP_K).map((r) => r.specialty);

test.describe('retrieval quality — keyword retriever against the golden set', () => {
    test('direct phrasings: every one is retrieved, and almost every one ranks first @unit', async () => {
        const byKind = scoreByKind(RETRIEVAL_GOLDEN_SET, retriever, TOP_K);
        const direct = byKind.direct!;

        await allure.parameter('direct — accuracy@1', pct(direct.accuracyAt1));
        await allure.parameter('direct — recall@3', pct(direct.recallAtK));

        // The contract a lexical retriever must hold: a phrase containing a keyword verbatim is
        // found. Anything less means the matching itself broke, not that language is hard.
        expect(direct.recallAtK).toBe(1);
        expect(direct.accuracyAt1).toBeGreaterThanOrEqual(0.94);
    });

    test('overall: recall@3 and coverage stay at the measured baseline @unit', async () => {
        const overall = scoreRetrieval(RETRIEVAL_GOLDEN_SET, retriever, TOP_K);

        await allure.parameter('accuracy@1', pct(overall.accuracyAt1));
        await allure.parameter('recall@3', pct(overall.recallAtK));
        await allure.parameter('MRR', overall.mrr.toFixed(3));
        await allure.parameter('coverage', pct(overall.coverage));
        await allure.parameter('misses', overall.misses.map((m) => m.symptoms).join(' | '));

        expect(overall.recallAtK).toBeGreaterThanOrEqual(0.64);
        expect(overall.mrr).toBeGreaterThanOrEqual(0.63);
        // A third of realistic complaints retrieve nothing at all, and the patient gets a 422. That
        // is the honest number, and it belongs in the report rather than in a footnote.
        expect(overall.coverage).toBeGreaterThanOrEqual(0.67);
    });

    test('nothing is invented: queries with no clinical route return empty @unit', async () => {
        const falsePositives = scoreFalsePositives(RETRIEVAL_GOLDEN_SET, retriever);

        await allure.parameter('false positive rate', pct(falsePositives.rate));

        // The retriever's one unambiguous strength. Silence is a 422; a guess is a confident
        // recommendation built on nothing, and the model downstream cannot tell the difference.
        expect(falsePositives.rate).toBe(0);
        expect(falsePositives.total).toBeGreaterThanOrEqual(3);
    });

    test('the known weakness is bounded: paraphrase collapses, and by how much @unit', async () => {
        const byKind = scoreByKind(RETRIEVAL_GOLDEN_SET, retriever, TOP_K);
        const { morphology, synonym, colloquial } = byKind;

        await allure.parameter('morphology — recall@3', pct(morphology!.recallAtK));
        await allure.parameter('synonym — recall@3', pct(synonym!.recallAtK));
        await allure.parameter('colloquial — recall@3', pct(colloquial!.recallAtK));

        // These assert the weakness, not the strength, and that is deliberate: they go red when the
        // retriever gets *better*, the same way the `test.fail()` marker on B-05 alerted on its fix.
        // A red test here is a prompt to re-measure the baseline and update DECISIONS, not a defect.
        // RAG-08 lives in the morphology row; "my fingers tingle every morning" is its twin.
        expect(morphology!.recallAtK).toBeLessThanOrEqual(0.6);
        // Not one synonym is found. No stemming and no weighting is the reason, not model quality.
        expect(synonym!.recallAtK).toBe(0);
        expect(colloquial!.recallAtK).toBeLessThanOrEqual(0.2);
    });

    test('ranking by match count, not specificity: a child complaint ranks GP above Pediatrician @unit', async () => {
        const ranked = retriever('my child has high fever and cough');

        await allure.parameter('ranked', JSON.stringify(ranked));

        // Two generic keywords ("fever", "cough") outweigh one specific one ("child"), because the
        // score is a count and every keyword is worth the same. Mock mode serves `retrieved[0]`, so
        // the CI configuration answers General Practitioner here. Registered as D-05.
        expect(ranked[0]).toBe('General Practitioner');
        expect(ranked).toContain('Pediatrician');
    });
});

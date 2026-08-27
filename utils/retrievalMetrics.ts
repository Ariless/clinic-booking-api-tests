import type { RetrievalCase, QueryKind } from '../data/retrievalGoldenSet';

/**
 * A retriever, reduced to what a metric cares about: a query in, a ranked list of specialty names
 * out. Scores and descriptions are the implementation's business — swapping a keyword retriever for
 * any other kind must not require touching this file.
 */
export type Retriever = (symptoms: string) => string[];

export type RetrievalScore = {
    /** Cases with an expected specialty. `none` cases are counted separately. */
    total: number;
    /** Share where the expected specialty is ranked first. This is what mock mode serves: `retrieved[0]`. */
    accuracyAt1: number;
    /** Share where the expected specialty appears in the top k. k = 3 is what the SUT sends the model. */
    recallAtK: number;
    /** Mean reciprocal rank: 1/1 for first place, 1/2 for second, 0 when absent. Rewards ranking, not just presence. */
    mrr: number;
    /** Share that returned anything at all. A miss and an empty result fail the patient differently: 422 vs wrong doctor. */
    coverage: number;
    /** Cases where the expected specialty was not in the top k, in dataset order. */
    misses: RetrievalCase[];
};

/** 1-based rank of `expected` in the ranked list, or 0 when absent. */
function rankOf(ranked: string[], expected: string): number {
    return ranked.indexOf(expected) + 1;
}

function ratio(hits: number, total: number): number {
    return total === 0 ? 0 : hits / total;
}

/**
 * Scores a retriever over the cases that expect a specialty. Cases with `expected: null` are ignored
 * here — see `scoreFalsePositives`, which is the metric they belong to.
 */
export function scoreRetrieval(cases: RetrievalCase[], retrieve: Retriever, k = 3): RetrievalScore {
    const answerable = cases.filter((c) => c.expected !== null);

    let firstPlace = 0;
    let withinK = 0;
    let reciprocalSum = 0;
    let nonEmpty = 0;
    const misses: RetrievalCase[] = [];

    for (const testCase of answerable) {
        const ranked = retrieve(testCase.symptoms);
        const rank = rankOf(ranked, testCase.expected!);

        if (ranked.length > 0) nonEmpty++;
        if (rank === 1) firstPlace++;
        if (rank > 0 && rank <= k) withinK++;
        else misses.push(testCase);
        if (rank > 0) reciprocalSum += 1 / rank;
    }

    return {
        total: answerable.length,
        accuracyAt1: ratio(firstPlace, answerable.length),
        recallAtK: ratio(withinK, answerable.length),
        mrr: ratio(reciprocalSum, answerable.length),
        coverage: ratio(nonEmpty, answerable.length),
        misses,
    };
}

/**
 * Share of `expected: null` cases where the retriever returned something anyway. A specialty for
 * "what are your opening hours" is not a harmless miss: it is what turns a 422 into a confident
 * recommendation built on nothing.
 */
export function scoreFalsePositives(cases: RetrievalCase[], retrieve: Retriever): {
    total: number;
    rate: number;
    offenders: Array<{ symptoms: string; returned: string[] }>;
} {
    const unanswerable = cases.filter((c) => c.expected === null);
    const offenders = unanswerable
        .map((c) => ({ symptoms: c.symptoms, returned: retrieve(c.symptoms) }))
        .filter((r) => r.returned.length > 0);

    return { total: unanswerable.length, rate: ratio(offenders.length, unanswerable.length), offenders };
}

/**
 * The same score, split by how the query is phrased. This is the breakdown that names a weakness
 * instead of reporting one number: a lexical retriever is expected to be strong on `direct` and to
 * lose ground the further a phrasing drifts from the keyword list.
 */
export function scoreByKind(
    cases: RetrievalCase[],
    retrieve: Retriever,
    k = 3
): Partial<Record<QueryKind, RetrievalScore>> {
    const kinds = [...new Set(cases.map((c) => c.kind))].filter((kind) => kind !== 'none');
    const byKind: Partial<Record<QueryKind, RetrievalScore>> = {};

    for (const kind of kinds) {
        byKind[kind] = scoreRetrieval(
            cases.filter((c) => c.kind === kind),
            retrieve,
            k
        );
    }

    return byKind;
}

/** Percentage with one decimal, for report lines and Allure parameters. */
export function pct(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
}

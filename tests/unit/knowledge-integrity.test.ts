// OWASP ASI06 — Memory & Context Poisoning, in the form this system can have it.
//
// There is no agent memory here. There is a retrieval corpus, and it is the context: the SUT picks
// the top three entries for a set of symptoms and interpolates them into the prompt as one line per
// entry, joined by newlines (`aiRecommendation.buildPrompt`):
//
//     - Cardiologist: Specialises in disorders of the heart and blood vessels.
//     - Neurologist:  Specialises in disorders of the nervous system.
//
// So an entry is a row of data that becomes prompt text with no delimiter, no escaping, and no role
// boundary. A `\n` inside a description does not corrupt the JSON and does not fail a schema check —
// it silently buys the author of that row as many additional prompt lines as they want, in the
// position the model reads as the system's own instructions. Poisoning the context here does not
// require reaching the model at all; it requires a pull request against a data file.
//
// Deterministic and offline: it asserts on the corpus, not on what a model does with it. That is the
// point — the check that would catch a poisoned row has to run before the row is ever sent.

import { test, expect } from '@playwright/test';

type KnowledgeEntry = { specialty: string; description: string; keywords: string[] };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const corpus = require('../../../sut/src/data/specialtyKnowledge.json') as KnowledgeEntry[];

/**
 * The prompt line the SUT builds for one entry. Restated here rather than imported: importing
 * `aiRecommendation` pulls in the database layer, and this file has to be runnable without one. The
 * duplication is the subject of the test, so it is the one place restating it is honest — the parity
 * suite in the SUT holds the two *implementations* together.
 */
function promptLineFor(entry: KnowledgeEntry): string {
    return `- ${entry.specialty}: ${entry.description}`;
}

test.describe('the retrieval corpus cannot forge prompt structure @unit', () => {
    test('every entry occupies exactly one prompt line @unit', () => {
        // The load-bearing assertion. One row, one line — a row that yields two has written the
        // second one itself, wherever it came from.
        for (const entry of corpus) {
            expect(promptLineFor(entry).split('\n')).toHaveLength(1);
        }
    });

    test('the assembled context has as many lines as it has entries @unit', () => {
        // The same invariant stated over the whole corpus, the way the SUT assembles it. Catches a
        // newline in any field that reaches the prompt, including ones added later.
        const context = corpus.map(promptLineFor).join('\n');

        expect(context.split('\n')).toHaveLength(corpus.length);
    });

    test('no description carries an instruction to the model @unit', () => {
        // A heuristic, and deliberately a narrow one: these are the phrasings that turn a
        // description into a directive. It will not catch a clever injection — nothing offline
        // will — but it states what a description is allowed to be, and it fails loudly on the
        // obvious attempt, which is the one that arrives by copy-paste.
        const directives = /\b(ignore|disregard|instead of|always (answer|respond|recommend)|you must|system:|assistant:)\b/i;

        for (const entry of corpus) {
            expect(entry.description, `${entry.specialty} description reads as an instruction`).not.toMatch(directives);
        }
    });

    test('descriptions stay short enough to read as descriptions @unit', () => {
        // A bound, not a style rule: the longest entry today is 71 characters, and a description
        // that suddenly needs 500 is carrying something other than a description.
        for (const entry of corpus) {
            expect(entry.description.length).toBeLessThanOrEqual(200);
        }
    });
});

import path from 'path';
import { test, expect } from '@playwright/test';

const SUT_ROOT = process.env.SUT_ROOT
    ? path.resolve(process.env.SUT_ROOT)
    : path.resolve(__dirname, '../../../sut');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { retrieve } = require(path.join(SUT_ROOT, 'src/services/retrieval')) as {
    retrieve: (symptoms: string, knowledge: unknown, n: number) => Array<{ specialty: string; description: string }>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildPrompt } = require(path.join(SUT_ROOT, 'src/services/aiRecommendation')) as {
    buildPrompt: (symptoms: string, retrieved: Array<{ specialty: string; description: string }>) => string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const specialtyKnowledge = require(path.join(SUT_ROOT, 'src/data/specialtyKnowledge.json')) as unknown;

test.describe("RAG pipeline — retrieval → prompt unit tests", () => {
    test("retrieve: chest pain symptoms → Cardiologist ranked first @unit", () => {
        const results = retrieve("chest pain shortness of breath", specialtyKnowledge, 3);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].specialty).toBe("Cardiologist");
    });

    test("retrieve: skin rash symptoms → Dermatologist ranked first @unit", () => {
        const results = retrieve("skin rash and itching", specialtyKnowledge, 3);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].specialty).toBe("Dermatologist");
    });

    test("retrieve: bare 'chest pain' ranks Cardiologist first — B-05 regression @unit", () => {
        // Was a documented defect (B-05): the generic "pain" keyword scored
        // Orthopedist above Cardiologist on a bare two-word query, while
        // "chest pain shortness of breath" worked because extra terms tipped the
        // score. The test carried test.fail() so the suite stayed green while
        // recording the flaw, and would alert the moment it was fixed.
        //
        // It alerted. SUT commit fcccd6d ("fix multi-word keyword matching in
        // retrieval") closed it, and Playwright reported "Expected to fail, but
        // passed". The marker is gone and this is now an ordinary regression
        // test guarding the fix.
        const results = retrieve("chest pain", specialtyKnowledge, 3);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].specialty).toBe("Cardiologist");
    });

    test("retrieve: unknown symptoms → empty result (no match) @unit", () => {
        const results = retrieve("xyzzy gibberish", specialtyKnowledge, 3);
        expect(results.length).toBe(0);
    });

    test("buildPrompt: retrieved specialty names and descriptions are present in prompt @unit", () => {
        const symptoms = "chest pain and shortness of breath";
        const retrieved = retrieve(symptoms, specialtyKnowledge, 3);
        const prompt = buildPrompt(symptoms, retrieved);

        expect(prompt).toContain(symptoms);
        for (const r of retrieved) {
            expect(prompt).toContain(r.specialty);
            expect(prompt).toContain(r.description);
        }
    });
});

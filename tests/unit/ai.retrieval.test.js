const path = require("path");
const { test, expect } = require("@playwright/test");
const SUT_ROOT = process.env.SUT_ROOT
  ? path.resolve(process.env.SUT_ROOT)
  : path.resolve(__dirname, "../../../sut");
const { retrieve } = require(path.join(SUT_ROOT, "src/services/retrieval"));
const { buildPrompt } = require(path.join(SUT_ROOT, "src/services/aiRecommendation"));
const specialtyKnowledge = require(path.join(SUT_ROOT, "src/data/specialtyKnowledge.json"));

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

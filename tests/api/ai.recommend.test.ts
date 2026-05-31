import { test, expect } from '../../fixtures';
import { AiRecommendClient } from '../../api/AiRecommendClient';
import { allure } from 'allure-playwright';

const ALLOWED_SPECIALTIES = [
    "General Practitioner",
    "Cardiologist",
    "Neurologist",
    "Dermatologist",
    "Orthopedist",
    "Pediatrician",
];

const AI_MOCK = process.env.AI_MOCK_RESPONSE === 'true'
const AI_REAL = !!process.env.ANTHROPIC_API_KEY && !AI_MOCK

// Layer 1–2: contract + domain — run with mock or real Claude
const contractLayer = (AI_MOCK || AI_REAL) ? test.describe : test.describe.skip
// Layer 3: metamorphic — meaningful only with real Claude (LLM consistency, not retrieval)
const qualityLayer = (AI_REAL && !AI_MOCK) ? test.describe : test.describe.skip

contractLayer("POST /api/v1/ai/recommend-doctor — contract + domain @api", () => {

    test("200: known symptoms → recommendedSpecialty + doctors @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const { status, body } = await ai.recommend("chest pain", user.token);
        expect(status).toBe(200);
        expect(body.recommendedSpecialty).toBeTruthy();
        expect(Array.isArray(body.doctors)).toBe(true);
    });

    test("200: response includes reasoning field (non-empty string) @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const { status, body } = await ai.recommend("chest pain and palpitations", user.token);
        expect(status).toBe(200);
        expect(typeof body.reasoning).toBe("string");
        expect(body.reasoning.length).toBeGreaterThan(0);
    });

    test("200: recommendedSpecialty is always from ALLOWED_SPECIALTIES (invariant) @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const symptomsList = [
            "chest pain",
            "skin rash and itching",
            "severe headache and dizziness",
            "knee pain after running",
            "my child has fever",
        ];
        for (const symptoms of symptomsList) {
            const { status, body } = await ai.recommend(symptoms, user.token);
            expect(status).toBe(200);
            expect(ALLOWED_SPECIALTIES).toContain(body.recommendedSpecialty);
        }
    });

    test("200: doctors array is non-empty when specialty is seeded in DB @api", async ({ request, user }) => {
        // Regression for B-06: 200 with doctors:[] = silent failure (patient can't book anyone)
        // "chest pain and shortness of breath" reliably maps to Cardiologist (seeded in DB)
        const ai = new AiRecommendClient(request);
        const { status, body } = await ai.recommend("chest pain and shortness of breath", user.token);
        expect(status).toBe(200);
        expect(body.recommendedSpecialty).toBe("Cardiologist");
        expect(body.doctors.length).toBeGreaterThan(0);
    });

    test("422 UNKNOWN_SPECIALTY: symptoms cannot be mapped @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const { status, body } = await ai.recommend("xyzzy gibberish", user.token);
        expect(status).toBe(422);
        expect(body.errorCode).toBe("UNKNOWN_SPECIALTY");
        expect(body.message).toBeTruthy();
        expect(body.requestId).toBeTruthy();
    });

    test("400 VALIDATION_ERROR: empty symptoms @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const { status, body } = await ai.recommend("", user.token);
        expect(status).toBe(400);
        expect(body.errorCode).toBe("VALIDATION_ERROR");
    });

    test("429 RATE_LIMITED after exceeding per-token limit @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        for (let i = 0; i < 5; i++) {
            await ai.recommend("chest pain", user.token);
        }
        const { status, body } = await ai.recommend("chest pain", user.token);
        expect(status).toBe(429);
        expect(body.errorCode).toBe("RATE_LIMITED");
        expect(body.message).toBeTruthy();
        expect(body.requestId).toBeTruthy();
    });
});

qualityLayer("POST /api/v1/ai/recommend-doctor — metamorphic consistency @api", () => {

    // Metamorphic relation: same condition rephrased → same specialty.
    // Tests retrieval-layer consistency in mock mode; LLM consistency with a real key.
    test("metamorphic: cardiac symptoms in 5 phrasings → same specialty @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const phrasings = [
            "chest pain and shortness of breath",
            "heart palpitations and chest pressure",
            "tightness in my chest and I feel breathless",
            "my heart is racing and I have chest discomfort",
            "sharp pain in chest that worsens with breathing",
        ];
        const specialties: string[] = [];
        for (const p of phrasings) {
            const { status, body } = await ai.recommend(p, user.token);
            expect(status).toBe(200);
            specialties.push(body.recommendedSpecialty);
        }
        const unique = new Set(specialties);
        await allure.parameter("Phrasings tested", String(phrasings.length));
        await allure.parameter("Specialties returned", [...unique].join(", "));
        expect(unique.size).toBe(1);
    });

    test("metamorphic: skin symptoms in 5 phrasings → same specialty @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const phrasings = [
            "skin rash and itching all over body",
            "red patches on skin with intense itching",
            "I have a rash that won't go away and it itches",
            "red itchy skin rash on my arms",
            "skin irritation with redness and flaking",
        ];
        const specialties: string[] = [];
        for (const p of phrasings) {
            const { status, body } = await ai.recommend(p, user.token);
            expect(status).toBe(200);
            specialties.push(body.recommendedSpecialty);
        }
        const unique = new Set(specialties);
        await allure.parameter("Phrasings tested", String(phrasings.length));
        await allure.parameter("Specialties returned", [...unique].join(", "));
        expect(unique.size).toBe(1);
    });

    test("metamorphic: pediatric symptoms in 5 phrasings → same specialty @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const phrasings = [
            "my child needs a vaccination",
            "my toddler has a temperature and won't eat",
            "my 5-year-old child has growth concerns",
            "my kid has been feverish for two days",
            "my infant has a high temperature and seems unwell",
        ];
        const specialties: string[] = [];
        for (const p of phrasings) {
            const { status, body } = await ai.recommend(p, user.token);
            expect(status).toBe(200);
            specialties.push(body.recommendedSpecialty);
        }
        const unique = new Set(specialties);
        await allure.parameter("Phrasings tested", String(phrasings.length));
        await allure.parameter("Specialties returned", [...unique].join(", "));
        expect(unique.size).toBe(1);
    });
});

test.describe("POST /api/v1/ai/recommend-doctor — ai-service unreachable @api", () => {
    test.beforeEach(() => {
        // Requires SUT started with AI_SERVICE_DEGRADE=true (points to port 9999)
        if (!process.env.AI_SERVICE_DEGRADE) test.skip();
    });

    test("503 AI_SERVICE_UNAVAILABLE: ai-service unreachable @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const { status, body } = await ai.recommend("chest pain", user.token);
        expect(status).toBe(503);
        expect(body.errorCode).toBe("AI_SERVICE_UNAVAILABLE");
        expect(body.requestId).toBeTruthy();
    });
});

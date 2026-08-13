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

const AI_RATE_LIMIT_MAX = parseInt(process.env.AI_RATE_LIMIT_MAX ?? '5', 10);

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
        ];
        for (const symptoms of symptomsList) {
            const { status, body } = await ai.recommend(symptoms, user.token);
            expect(status).toBe(200);
            expect(ALLOWED_SPECIALTIES).toContain(body.recommendedSpecialty);
        }
    });

    test("200: recommendation for seeded specialty includes non-empty doctors list @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const { status, body } = await ai.recommend("chest pain and shortness of breath", user.token);
        expect(status).toBe(200);
        expect(body.recommendedSpecialty).toBe("Cardiologist");
        expect(body.doctors.length).toBeGreaterThan(0);
    });

    test("404 DOCTORS_UNAVAILABLE: specialty in knowledge base but no doctors in DB @api", async ({ request, user }) => {
        // "baby" + "vaccination" = Pediatrician score 2, all others 0 — unambiguous retrieval
        // Pediatrician is in the knowledge base but has no seeded doctors
        const ai = new AiRecommendClient(request);
        const { status, body } = await ai.recommend("my baby needs vaccination", user.token);
        expect(status).toBe(404);
        expect(body.errorCode).toBe("DOCTORS_UNAVAILABLE");
        expect(body.message).toBeTruthy();
        expect(body.requestId).toBeTruthy();
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

    test("400 VALIDATION_ERROR: symptoms exceed 500 characters @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const { status, body } = await ai.recommend("a".repeat(501), user.token);
        expect(status).toBe(400);
        expect(body.errorCode).toBe("VALIDATION_ERROR");
    });

    test("429 RATE_LIMITED after exceeding per-token limit @api @rate-limit", async ({ request, user }) => {
        test.skip(AI_RATE_LIMIT_MAX > 10, `AI_RATE_LIMIT_MAX=${AI_RATE_LIMIT_MAX}; set it to 5 on the SUT and in tests/.env to run`);
        const ai = new AiRecommendClient(request);
        for (let i = 0; i < AI_RATE_LIMIT_MAX; i++) {
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

    // Metamorphic relation: same condition rephrased → same observable answer.
    //
    // The answer is compared as an outcome, not as a status code: since the B-06 fix a specialty that
    // exists in the knowledge base but has no seeded doctors legitimately returns 404
    // DOCTORS_UNAVAILABLE. Asserting 200 made this test depend on seed data rather than on the
    // relation it is meant to check — rephrasing must not change what the system answers, whatever
    // that answer is. Tests retrieval-layer consistency in mock mode; LLM consistency with a real key.
    const outcomeOf = (status: number, body: { recommendedSpecialty?: string; errorCode?: string }): string =>
        status === 200 ? `200:${body.recommendedSpecialty}` : `${status}:${body.errorCode}`;
    test("metamorphic: cardiac symptoms in 5 phrasings → same specialty @api", async ({ request, user }) => {
        const ai = new AiRecommendClient(request);
        const phrasings = [
            "chest pain and shortness of breath",
            "heart palpitations and chest pressure",
            "tightness in my chest and I feel breathless",
            "my heart is racing and I have chest discomfort",
            "sharp pain in chest that worsens with breathing",
        ];
        const outcomes: string[] = [];
        for (const p of phrasings) {
            const { status, body } = await ai.recommend(p, user.token);
            outcomes.push(outcomeOf(status, body));
        }
        const unique = new Set(outcomes);
        await allure.parameter("Phrasings tested", String(phrasings.length));
        await allure.parameter("Outcomes returned", [...unique].join(", "));
        expect(unique.size, "rephrasing must not change the answer").toBe(1);
        // Cardiologist is seeded, so cardiac symptoms must also stay bookable, not just consistent.
        expect([...unique][0], "cardiac symptoms must map to a bookable Cardiologist").toBe("200:Cardiologist");
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
        const outcomes: string[] = [];
        for (const p of phrasings) {
            const { status, body } = await ai.recommend(p, user.token);
            outcomes.push(outcomeOf(status, body));
        }
        const unique = new Set(outcomes);
        await allure.parameter("Phrasings tested", String(phrasings.length));
        await allure.parameter("Outcomes returned", [...unique].join(", "));
        expect(unique.size, "rephrasing must not change the answer").toBe(1);
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
        const outcomes: string[] = [];
        for (const p of phrasings) {
            const { status, body } = await ai.recommend(p, user.token);
            outcomes.push(outcomeOf(status, body));
        }
        const unique = new Set(outcomes);
        await allure.parameter("Phrasings tested", String(phrasings.length));
        await allure.parameter("Outcomes returned", [...unique].join(", "));
        expect(unique.size, "rephrasing must not change the answer").toBe(1);
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

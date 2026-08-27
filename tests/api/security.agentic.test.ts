// OWASP Top 10 for Agentic Applications (published 2025-12-09) against the one AI surface this API
// has: POST /api/v1/ai/recommend-doctor.
//
// The applicability mapping — which of the ten categories this system can have, which it cannot, and
// what would have to be built for the rest to apply — is `docs/OWASP_AGENTIC.md`. Reading the list
// as a checklist to satisfy would produce theatre here: the endpoint is a single model call with
// keyword retrieval, no tools, no memory, no second agent. What it does have is a route that spends
// money at a third party on a caller's behalf, and that is enough to make three of the ten real.
//
// Covered here (the deterministic ones — no model call, so these run in ordinary CI):
//   ASI03  Identity & Privilege Abuse — the delegated action is performed for an identified caller.
//   ASI09  Human-Agent Trust Exploitation — what the answer claims about its own authority.
//
// Covered elsewhere:
//   ASI01  Agent Goal Hijack — `ai.recommend.test.ts` @rag (adversarial inputs; the enum in the
//          structured-output schema is the structural half of the mitigation).
//   ASI04  Agentic Supply Chain — `sut/src/__tests__/aiSupplyChain.test.js` (the SUT re-checks the
//          specialty the standalone service sends).
//   ASI06  Memory & Context Poisoning — `tests/unit/knowledge-integrity.test.ts` (the retrieval
//          corpus is the context, and it is interpolated into the prompt).
//   ASI08  Cascading Failures — partly. The two failure paths are covered in `ai.recommend.test.ts`
//          ("Claude unreachable", "ai-service unreachable"); the circuit breaker that is supposed to
//          stop the retry cascade is not covered anywhere. See docs/OWASP_AGENTIC.md.

import { test, expect } from '../../fixtures';
import { AiRecommendClient } from '../../api/AiRecommendClient';
import { assertSchema } from '../../utils/schemaValidator';
import { validateError } from '../../data/schemas/errorSchema';

const SYMPTOMS = 'chest pain and shortness of breath';

test.describe('ASI03 — the model is only reached on behalf of an identified caller @security', () => {
    test("POST /api/v1/ai/recommend-doctor — 401 AUTH_REQUIRED with no token @api @security", async ({ request }) => {
        // Until 2026-08-27 this answered 200. Every other domain route in the API required a token;
        // the one route that spends money at a third party did not.
        const ai = new AiRecommendClient(request);

        const { status, body } = await ai.recommendAnonymously(SYMPTOMS);

        expect(status).toBe(401);
        assertSchema(body, validateError);
        expect(body.errorCode).toBe('AUTH_REQUIRED');
    });

    test("POST /api/v1/ai/recommend-doctor — 401 AUTH_INVALID with a malformed token @api @security", async ({ request }) => {
        // The distinction matters for this route specifically: an unparsed token was previously
        // indistinguishable from a valid one, so a caller needed no credential, not even a stolen
        // one.
        const ai = new AiRecommendClient(request);

        const { status, body } = await ai.recommendWithRawToken(SYMPTOMS, 'garbage.token.here');

        expect(status).toBe(401);
        assertSchema(body, validateError);
        expect(body.errorCode).toBe('AUTH_INVALID');
    });

    test("POST /api/v1/ai/recommend-doctor — 200 for an authenticated patient @api @security", async ({ request, user }) => {
        // The counterpart: a gate that refuses everyone passes the two tests above.
        const ai = new AiRecommendClient(request);

        const { status } = await ai.recommend(SYMPTOMS, user.token);

        expect(status).toBe(200);
    });
});

test.describe('ASI09 — what the recommendation claims about its own authority @security', () => {
    test("POST /api/v1/ai/recommend-doctor — 200 returns a routing specialty, never a diagnosis field @api @security", async ({ request, user }) => {
        // ASI09 is about a human over-trusting the output. The API cannot stop that on its own, but
        // it can refuse to supply the vocabulary that invites it: this response routes a patient to a
        // specialty, and it must not grow a field that reads as a clinical finding.
        //
        // What this test does NOT assert: that the response carries a disclosure notice. It does not
        // — recorded in docs/OWASP_AGENTIC.md as an open gap, since EU AI Act Art. 13 transparency
        // is tested on the mobile client and has no server-side counterpart. Adding the field is a
        // product decision, so this test pins the contract as it stands rather than inventing one.
        const ai = new AiRecommendClient(request);

        const { status, body } = await ai.recommend(SYMPTOMS, user.token);

        expect(status).toBe(200);
        expect(Object.keys(body).sort()).toEqual(['doctors', 'reasoning', 'recommendedSpecialty']);
    });
});

// What identifies a recorded Anthropic request.
//
// These exist because the first version of `cassetteKey` hashed a body it had accidentally emptied:
// `JSON.stringify(body, Object.keys(body).sort())` treats its second parameter as an allow-list of
// property names applied at every depth, not as a sort order, so passing the top-level keys deleted
// everything nested under them. The body being hashed was
// `{"max_tokens":256,"messages":[{}],"model":"…","output_config":{}}` — no prompt in it at all.
//
// The consequence is the one a replay suite cannot survive: every request in the run shares one key,
// so a cassette answers questions it was never asked. The `@rag` layer would have gone green in CI
// against answers matched to the wrong symptoms.
//
// The first test below is the one that would have caught it. It is also the cheapest test in the
// repository, which is the point worth keeping.

import { test, expect } from '@playwright/test';
import { cassetteKey, type CassetteRequest } from '../../utils/claudeCassette';

function request(prompt: string, overrides: Partial<CassetteRequest> = {}): CassetteRequest {
    return {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
        output_config: { format: { type: 'json_schema', schema: { type: 'object' } } },
        ...overrides,
    };
}

test.describe('cassetteKey identifies a request by everything in it @unit', () => {
    test('two different prompts do not share a key @unit', () => {
        const chest = cassetteKey(request('chest pain and shortness of breath'));
        const knee = cassetteKey(request('knee pain after running'));

        expect(chest).not.toBe(knee);
    });

    test('the same prompt gives the same key @unit', () => {
        expect(cassetteKey(request('chest pain'))).toBe(cassetteKey(request('chest pain')));
    });

    test('a different model misses the recording @unit', () => {
        const haiku = cassetteKey(request('chest pain'));
        const sonnet = cassetteKey(request('chest pain', { model: 'claude-sonnet-5' }));

        expect(haiku).not.toBe(sonnet);
    });

    test('a changed response schema misses the recording @unit', () => {
        const withEnum = cassetteKey(
            request('chest pain', {
                output_config: { format: { type: 'json_schema', schema: { enum: ['Cardiologist'] } } },
            })
        );

        expect(withEnum).not.toBe(cassetteKey(request('chest pain')));
    });

    test('key order in the body does not change the key @unit', () => {
        const one: CassetteRequest = {
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 256,
            messages: [{ role: 'user', content: 'chest pain' }],
        };
        const other: CassetteRequest = {
            messages: [{ content: 'chest pain', role: 'user' }],
            max_tokens: 256,
            model: 'claude-haiku-4-5-20251001',
        };

        expect(cassetteKey(one)).toBe(cassetteKey(other));
    });

    test('key order nested inside the schema does not change the key either @unit', () => {
        // The nested case is separate from the one above on purpose: a top-level-only sort passes
        // that test and fails this one, which is the shape of the original defect.
        const one = request('chest pain', {
            output_config: { format: { type: 'json_schema', schema: { required: ['a'], type: 'object' } } },
        });
        const other = request('chest pain', {
            output_config: { format: { schema: { type: 'object', required: ['a'] }, type: 'json_schema' } },
        });

        expect(cassetteKey(one)).toBe(cassetteKey(other));
    });
});

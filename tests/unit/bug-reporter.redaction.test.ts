// The third place patient data can leave the SUT's orbit: the AI bug reporter.
//
// It sends a failed test's error message and stack to Anthropic, writes them to `bug-reports/`, and
// attaches them to the Allure report. Playwright builds an assertion message out of the values it
// compared, so a failed AI test carries the symptoms and a failed auth test carries an address and a
// bearer token. Unlike the two paths inside the SUT, this one hands the text to a third party.
//
// These run without a key and without a network call, because `buildBugReportPrompt` is the seam:
// the redaction happens before the transport, so it can be asserted on the string itself.

import { test, expect } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import { redactPhi } from '../../utils/phi';
import { buildBugReportPrompt } from '../../utils/aiBugReporter';

/** A value no fixture produces, so finding it in the output is unambiguous. */
const SYMPTOM = 'zqx7marker9931 chest pain';

test.describe('redactPhi removes what identifies a person @unit', () => {
    test('a symptoms field in a quoted body is replaced, not merely truncated @unit', () => {
        const out = redactPhi(`Expected: {"symptoms": "${SYMPTOM}", "specialty": "Cardiologist"}`);

        expect(out).not.toContain('zqx7marker9931');
        expect(out).toContain('[redacted]');
        // The rest of the body survives: a report that says only "[redacted]" is not a report.
        expect(out).toContain('Cardiologist');
    });

    test('single quotes and a bare key are the same case @unit', () => {
        expect(redactPhi(`symptoms: '${SYMPTOM}'`)).not.toContain('zqx7marker9931');
        expect(redactPhi(`email: 'patient@example.com'`)).not.toContain('patient@example.com');
    });

    test('an address on its own, outside any field, still goes @unit', () => {
        const out = redactPhi('Registration failed for patient-4471@clinic.example.com after 3 tries');

        expect(out).not.toContain('patient-4471@clinic.example.com');
        expect(out).toContain('after 3 tries');
    });

    test('a bearer token is censored and stays recognisable as a bearer token @unit', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiJ9.bWFya2VyLTg4MjM.c2lnbmF0dXJlLXZhbHVl';
        const out = redactPhi(`Authorization: Bearer ${jwt}`);

        expect(out).not.toContain('bWFya2VyLTg4MjM');
        // Which credential shape failed is diagnostic; its value is not.
        expect(out).toContain('Bearer [redacted]');
    });

    test('a bare token with no scheme in front of it goes too @unit', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiJ9.bWFya2VyLTg4MjM.c2lnbmF0dXJlLXZhbHVl';

        expect(redactPhi(`token was ${jwt}`)).not.toContain('bWFya2VyLTg4MjM');
    });

    test('text with nothing personal in it is returned unchanged @unit', () => {
        const message = 'Expected: 200\nReceived: 503\n  at tests/api/ai.recommend.test.ts:41:24';

        expect(redactPhi(message)).toBe(message);
    });

    test('a camelCase key ending in a sensitive word is not mistaken for one @unit', () => {
        // `name` is on the list and matching is case-insensitive, so `fileName` is the collision that
        // would quietly strip the most useful line in a stack.
        const out = redactPhi('fileName: "tests/api/ai.recommend.test.ts"');

        expect(out).toContain('ai.recommend.test.ts');
    });
});

test.describe('the prompt sent to Anthropic carries no patient data @unit', () => {
    /** A TestInfo with only the fields the reporter reads. */
    function failedTest(message: string, stack: string): TestInfo {
        return {
            title: 'POST /ai/recommend-doctor — wrong specialty',
            file: `${process.cwd()}/tests/api/ai.recommend.test.ts`,
            duration: 812,
            status: 'failed',
            errors: [{ message, stack }],
        } as unknown as TestInfo;
    }

    test('symptoms quoted by a failing assertion do not reach the prompt @unit', () => {
        const prompt = buildBugReportPrompt(
            failedTest(
                `Expected: "Cardiologist"\nReceived: "Neurologist"\nRequest: {"symptoms": "${SYMPTOM}"}`,
                `Error: assertion failed\n    at tests/api/ai.recommend.test.ts:41:24`
            )
        );

        expect(prompt).not.toContain('zqx7marker9931');
        // Everything a developer needs is still there — the test, the file, the two values compared.
        expect(prompt).toContain('POST /ai/recommend-doctor — wrong specialty');
        expect(prompt).toContain('tests/api/ai.recommend.test.ts');
        expect(prompt).toContain('Neurologist');
    });

    test('an address and a token in the stack do not reach the prompt @unit', () => {
        const prompt = buildBugReportPrompt(
            failedTest(
                'Login failed for patient-4471@clinic.example.com',
                'Error: 401\n    at AuthClient.verifyLogin (api/AuthClient.ts:6:30)\n    Bearer eyJhbGciOiJIUzI1NiJ9.bWFya2VyLTg4MjM.c2lnbmF0dXJlLXZhbHVl'
            )
        );

        expect(prompt).not.toContain('patient-4471@clinic.example.com');
        expect(prompt).not.toContain('bWFya2VyLTg4MjM');
        expect(prompt).toContain('AuthClient.verifyLogin');
    });
});

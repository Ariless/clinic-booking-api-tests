# Failure mode: raw URL in test file

## What happened

CLAUDE.md rule: "Never call `request.post` with raw URLs in test files — use a client method."

Agent wrote `ai.recommend.test.ts` — a new test file for the AI recommendation endpoint. The file contained 15 direct calls:

```typescript
// What the agent generated — 15 times across the file
const response = await request.post(endpoints.aiRecommendDoctor, {
    data: JSON.stringify({ symptom }),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
});
```

Every test passed. CI stayed green. The rule was in CLAUDE.md.

## Why it wasn't caught automatically

- No lint rule blocked raw `request.post` calls in test files
- TypeScript compiled without errors
- Playwright ran all tests successfully
- The violation is architectural, not functional — the code did the right thing, just in the wrong layer

Found manually during a review, several days after the file was written.

## What the correct version looks like

```typescript
// AiRecommendClient.ts — created as the fix
export class AiRecommendClient extends BaseClient {
    async recommend(symptom: string, opts: RequestOpts = {}) {
        const response = await this.request.post(endpoints.aiRecommendDoctor, {
            data: JSON.stringify({ symptom }),
            headers: { "Content-Type": "application/json", ...opts.headers },
        });
        return this.parseResponse(response);
    }
}

// In the test file — after the fix
const { status, body } = await ai.recommend(symptom, { headers: auth });
```

15 repeated blocks collapsed into one method. The test file no longer knows about URLs or headers.

## The lesson

Writing the rule is not enough. The agent reads CLAUDE.md at session start, decides it knows the conventions, and proceeds — without re-checking every decision against every rule.

Rules that must be enforced automatically need an automatic delivery mechanism, not just documentation.

See: `~/.claude/settings.json` — UserPromptSubmit hook that injects CLAUDE.md content before the agent responds.

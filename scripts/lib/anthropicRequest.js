// One HTTP path to the Messages API, for everything in this repository that is not a test.
//
// There were six copies of this function before 2026-08-28 — `ai-ci-summary`, `ai-gap-analysis`,
// `ai-test-generator`, `impact-analysis`, `flakiness-classifier` and `utils/aiBugReporter.ts` —
// identical apart from `max_tokens`. Each one ended the same way:
//
//     else resolve(parsed.content[0].text);
//
// which is where the token counts went. The API returns `usage` on every response; six copies threw
// it away six times, and that is the whole reason the suite could not say what a run cost. Fixing
// the accounting in one place first required there to be one place.
//
// Raw `https` rather than the SDK, deliberately: these are plain `node` scripts with no build step
// and no bundler, and the request is one POST with three headers. The tests that call the model use
// the SDK through `utils/claudeTestClient.ts`, which does its own ledger accounting.

const https = require("https");

const ledger = require("../../utils/tokenLedger");
const models = require("../../config/models.json");

const DEFAULT_MAX_TOKENS = 1024;

/**
 * Calls the model and returns the text of the first content block.
 *
 * The signature keeps the old callers working unchanged: `callClaude(prompt, apiKey)`. Options are
 * additive — `maxTokens` because the callers genuinely differ (a CI summary is 1,024 tokens, a
 * generated test file is 4,096), and `label` because a ledger line that says which script spent the
 * money is worth the one argument.
 */
function callClaude(prompt, apiKey, { maxTokens = DEFAULT_MAX_TOKENS, model, label } = {}) {
  return callClaudeWithUsage(prompt, apiKey, { maxTokens, model, label }).then((r) => r.text);
}

/** The same call, returning the usage alongside the text for a caller that wants to report it. */
function callClaudeWithUsage(prompt, apiKey, { maxTokens = DEFAULT_MAX_TOKENS, model, label } = {}) {
  const requestedModel = model || process.env.CLAUDE_TOOLING_MODEL || models.tooling;
  const body = JSON.stringify({
    model: requestedModel,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              reject(new Error(parsed.error.message));
              return;
            }
            // Recorded before the text is handed back, so a caller that throws on a malformed
            // response still leaves the spend on the books. The call was billed either way.
            ledger.record({
              model: parsed.model || requestedModel,
              usage: parsed.usage,
              label: label || "tooling",
            });
            resolve({ text: parsed.content[0].text, usage: parsed.usage, model: parsed.model });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = { callClaude, callClaudeWithUsage, DEFAULT_MAX_TOKENS };

// What a run spends on the Anthropic API, in tokens and in dollars.
//
// Before 2026-08-28 nothing here read `usage` at all. Six copies of the same `callClaude` — five in
// `scripts/`, one in `utils/aiBugReporter.ts` — resolved `parsed.content[0].text` and dropped the
// rest of the response on the floor, so the token counts arrived and were discarded on every call.
// `max_tokens` was the only ceiling in the repository, and it caps one response, not a run: a suite
// that makes 40 calls of 256 tokens and a suite that makes 4,000 look identical to it. The `@rag`
// layer was blocked for a week by "credit balance too low" (BACKLOG, Pending verification) without
// anything able to say what the previous runs had cost.
//
// CommonJS on purpose. The scripts in `scripts/` are plain `node` with no build step and the tests
// are TypeScript through Playwright; JSON and CJS are the two formats both halves read. Same reason
// `config/models.json` exists — see the comment at the top of `config/models.ts`.
//
// Append-only JSONL rather than an in-memory counter, because Playwright runs tests in several
// worker processes and the scripts run as separate `node` invocations entirely. A counter in one
// process would report a fraction of the run and call it the total.

const fs = require("fs");
const path = require("path");

const pricing = require("../config/pricing.json");
const budget = require("../config/budget.json");

const DEFAULT_LEDGER = path.resolve(__dirname, "../test-results/token-usage.jsonl");

/** Where this run's entries are written. Overridable so a test can point it at a scratch file. */
function ledgerPath() {
  return process.env.CLAUDE_TOKEN_LEDGER || DEFAULT_LEDGER;
}

/**
 * Records one API call.
 *
 * `usage` is the object the Messages API returns; every field is read defensively because a
 * recorded cassette or a proxy may replay a response without one. A call whose usage is missing is
 * still recorded — with zero tokens and `usageMissing: true` — because the *count* of calls is a
 * budget signal in its own right, and a silently skipped entry is how a ledger starts lying.
 */
function record({ model, usage, label }) {
  const entry = {
    at: new Date().toISOString(),
    label: label || "unlabelled",
    model: model || "unknown",
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    // Present only when prompt caching is in play. Nothing in this repository sets `cache_control`
    // — the prompts are far below the minimum cacheable prefix — so a non-zero value here means
    // something changed and the pricing below no longer describes the bill. Surfaced, not priced.
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
    usageMissing: !usage,
  };

  const file = ledgerPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // One `appendFileSync` of a single line under the pipe-buffer size is the ordinary way concurrent
  // writers share a log file; the alternative is a lock the workers would have to agree on.
  fs.appendFileSync(file, JSON.stringify(entry) + "\n");
  return entry;
}

/** USD for one entry. An unpriced model contributes 0 and is named in `unpricedModels`. */
function costOf(entry) {
  const rates = pricing.models[entry.model];
  if (!rates) return 0;
  return (
    (entry.inputTokens / 1_000_000) * rates.input +
    (entry.outputTokens / 1_000_000) * rates.output
  );
}

/** Reads the ledger and totals it. Returns zeroes when no call was made — that is a valid run. */
function summarise() {
  const file = ledgerPath();
  if (!fs.existsSync(file)) {
    return { calls: 0, totalUsd: 0, inputTokens: 0, outputTokens: 0, byModel: {}, unpricedModels: [], cachedTokens: 0, usageMissingCalls: 0 };
  }

  const entries = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const byModel = {};
  const unpriced = new Set();
  let totalUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let usageMissingCalls = 0;

  for (const e of entries) {
    const usd = costOf(e);
    if (!pricing.models[e.model]) unpriced.add(e.model);
    totalUsd += usd;
    inputTokens += e.inputTokens;
    outputTokens += e.outputTokens;
    cachedTokens += (e.cacheReadTokens ?? 0) + (e.cacheWriteTokens ?? 0);
    if (e.usageMissing) usageMissingCalls += 1;

    const m = (byModel[e.model] ??= { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0 });
    m.calls += 1;
    m.inputTokens += e.inputTokens;
    m.outputTokens += e.outputTokens;
    m.usd += usd;
  }

  return {
    calls: entries.length,
    totalUsd,
    inputTokens,
    outputTokens,
    cachedTokens,
    usageMissingCalls,
    byModel,
    unpricedModels: [...unpriced],
  };
}

/**
 * Compares the run against `config/budget.json`.
 *
 * Returns the verdict rather than throwing: what a suite should do when it overspends is a decision
 * for the caller — the teardown prints and fails the run, a unit test asserts on the fields.
 */
function checkBudget(summary = summarise()) {
  const maxUsd = Number(process.env.CLAUDE_RUN_BUDGET_USD ?? budget.maxUsd);
  const maxCalls = Number(process.env.CLAUDE_RUN_BUDGET_CALLS ?? budget.maxCalls);
  const reasons = [];

  if (summary.totalUsd > maxUsd) {
    reasons.push(`spend $${summary.totalUsd.toFixed(4)} exceeds the $${maxUsd.toFixed(2)} budget`);
  }
  if (summary.calls > maxCalls) {
    reasons.push(`${summary.calls} calls exceed the ${maxCalls}-call budget`);
  }
  // An unpriced model is not a budget breach, but it does mean the dollar figure is an
  // undercount — the run spent money this ledger cannot see.
  if (summary.unpricedModels.length > 0) {
    reasons.push(
      `no price recorded for ${summary.unpricedModels.join(", ")} — the total is an undercount; add it to config/pricing.json`
    );
  }

  return { withinBudget: reasons.length === 0, maxUsd, maxCalls, reasons, summary };
}

/** Human-readable one-block report. Used by the teardown and by `npm run tokens`. */
function formatReport(summary = summarise()) {
  if (summary.calls === 0) return "[tokens] no Anthropic API calls recorded this run";

  const lines = [
    `[tokens] ${summary.calls} call(s) · ${summary.inputTokens} in / ${summary.outputTokens} out · $${summary.totalUsd.toFixed(4)}`,
  ];
  for (const [model, m] of Object.entries(summary.byModel)) {
    lines.push(
      `[tokens]   ${model}: ${m.calls} call(s), ${m.inputTokens} in / ${m.outputTokens} out, $${m.usd.toFixed(4)}`
    );
  }
  if (summary.cachedTokens > 0) {
    lines.push(`[tokens]   ${summary.cachedTokens} cached token(s) seen — not priced here, see utils/tokenLedger.js`);
  }
  if (summary.usageMissingCalls > 0) {
    lines.push(`[tokens]   ${summary.usageMissingCalls} call(s) reported no usage (replayed or proxied)`);
  }
  return lines.join("\n");
}

/** Clears the ledger. Called once per run by global-setup, so a run reports its own spend. */
function reset() {
  const file = ledgerPath();
  if (fs.existsSync(file)) fs.rmSync(file);
}

module.exports = { record, summarise, checkBudget, formatReport, reset, costOf, ledgerPath };

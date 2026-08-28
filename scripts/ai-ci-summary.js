#!/usr/bin/env node
// Reads Playwright JSON report → asks Claude Haiku for a readable CI summary
// → saves ci-summary/summary.md as a CI artifact
//
// Usage:
//   node scripts/ai-ci-summary.js
//   ANTHROPIC_API_KEY=<key> node scripts/ai-ci-summary.js
//   RESULTS_PATH=custom/path/results.json node scripts/ai-ci-summary.js

// The key lives in .env like every other secret in this repo; without this the documented
// `npm run ai:*` commands died with "ANTHROPIC_API_KEY is not set" unless you pasted the key
// onto the command line by hand. Added 2026-08-21. { quiet: true } keeps the banner out of
// generated report output.
require("dotenv").config({ quiet: true });

const fs = require("fs");
const path = require("path");
// One place names the models this repository uses; see config/models.ts for what each role is for.
const MODEL = process.env.CLAUDE_TOOLING_MODEL || require("../config/models.json").tooling;
const { callClaude: sharedCallClaude } = require("./lib/anthropicRequest");

const ROOT = path.join(__dirname, "..");
const RESULTS_PATH = process.env.RESULTS_PATH ?? path.join(ROOT, "test-results.json");
const OUTPUT_DIR = path.join(ROOT, "ci-summary");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "summary.md");

// ── flatten suite tree ────────────────────────────────────────────────────────

function collectSpecs(suites, file = "") {
    const specs = [];
    for (const suite of suites ?? []) {
        const f = suite.file || file;
        for (const spec of suite.specs ?? []) {
            specs.push({ file: f, title: spec.title, ok: spec.ok, tests: spec.tests });
        }
        specs.push(...collectSpecs(suite.suites, f));
    }
    return specs;
}

function firstError(tests) {
    for (const t of tests ?? []) {
        for (const r of t.results ?? []) {
            for (const e of r.errors ?? []) {
                const msg = e.message ?? "";
                return msg.split("\n")[0].slice(0, 200);
            }
        }
    }
    return null;
}

// ── Claude call ───────────────────────────────────────────────────────────────

// The transport lives in `scripts/lib/anthropicRequest.js` — one copy for all five scripts and
// the bug reporter. It records `usage` in the token ledger, which six local copies of this
// function used to discard along with the rest of the response.
function callClaude(prompt, apiKey) {
    return sharedCallClaude(prompt, apiKey, { maxTokens: 1024, model: MODEL, label: "ci-summary" });
}

// ── fallback: plain stats ─────────────────────────────────────────────────────

function buildFallbackSummary(stats, failures, runLabel) {
    const passed = stats.expected ?? 0;
    const failed = stats.unexpected ?? 0;
    const skipped = stats.skipped ?? 0;
    const durationSec = ((stats.duration ?? 0) / 1000).toFixed(1);
    const status = failed === 0 ? "✅ All tests passed" : `❌ ${failed} test(s) failed`;

    const lines = [
        `# CI Run Summary — ${runLabel}`,
        "",
        `**${status}**  `,
        `Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped} | Duration: ${durationSec}s`,
        "",
    ];

    if (failures.length > 0) {
        lines.push("## Failures", "");
        for (const f of failures) {
            lines.push(`### ${f.title}`);
            lines.push(`*${f.file}*`);
            if (f.error) lines.push("", `> ${f.error}`);
            lines.push("");
        }
    }

    lines.push("---", "*AI summary unavailable — ANTHROPIC_API_KEY not set or balance zero.*");
    return lines.join("\n");
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
    if (!fs.existsSync(RESULTS_PATH)) {
        console.error(`[ai-ci-summary] Results file not found: ${RESULTS_PATH}`);
        console.error("[ai-ci-summary] Make sure the Playwright JSON reporter is enabled.");
        process.exit(1);
    }

    const report = JSON.parse(fs.readFileSync(RESULTS_PATH, "utf-8"));
    const stats = report.stats ?? {};
    const specs = collectSpecs(report.suites);
    const failures = specs
        .filter((s) => !s.ok)
        .map((s) => ({ file: s.file, title: s.title, error: firstError(s.tests) }));

    const passed = stats.expected ?? 0;
    const failed = stats.unexpected ?? 0;
    const skipped = stats.skipped ?? 0;
    const durationSec = ((stats.duration ?? 0) / 1000).toFixed(1);
    const runLabel = new Date(stats.startTime ?? Date.now()).toISOString().slice(0, 19).replace("T", " ") + " UTC";

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        console.log("[ai-ci-summary] No ANTHROPIC_API_KEY — writing plain summary.");
        fs.writeFileSync(OUTPUT_PATH, buildFallbackSummary(stats, failures, runLabel));
        console.log(`[ai-ci-summary] Saved: ${OUTPUT_PATH}`);
        return;
    }

    const failureLinesForPrompt = failures
        .slice(0, 20)
        .map((f, i) => `${i + 1}. [${f.file}] ${f.title}${f.error ? `\n   Error: ${f.error}` : ""}`)
        .join("\n");

    const prompt = [
        "You are a senior QA engineer reviewing a Playwright test run.",
        "Write a concise, actionable CI summary for the team.",
        "",
        `Run: ${runLabel}`,
        `Results: ${passed} passed, ${failed} failed, ${skipped} skipped (${durationSec}s total)`,
        "",
        failures.length === 0
            ? "All tests passed."
            : `Failed tests (${failures.length}):\n${failureLinesForPrompt}`,
        "",
        "Respond in markdown with exactly these sections:",
        "## Status",
        "(one line: overall pass/fail and counts)",
        "",
        "## Failures",
        "(if any — group related failures by pattern, explain what they likely mean)",
        "",
        "## Recommendation",
        "(1-3 bullets: what to investigate first, any patterns, safe to merge?)",
        "",
        "Keep it under 300 words. Be specific — use the test titles as evidence.",
    ].join("\n");

    try {
        console.log("[ai-ci-summary] Calling Claude Haiku...");
        const summary = await callClaude(prompt, apiKey);
        const full = `# CI Run Summary — ${runLabel}\n\n${summary}\n\n---\n*Generated by Claude Haiku from Playwright JSON report.*\n`;
        fs.writeFileSync(OUTPUT_PATH, full);
        console.log(`[ai-ci-summary] AI summary saved: ${OUTPUT_PATH}`);
    } catch (err) {
        console.log(`[ai-ci-summary] Claude unavailable (${err.message}) — writing plain summary.`);
        fs.writeFileSync(OUTPUT_PATH, buildFallbackSummary(stats, failures, runLabel));
        console.log(`[ai-ci-summary] Fallback summary saved: ${OUTPUT_PATH}`);
    }
}

main().catch((err) => {
    console.error("[ai-ci-summary] Fatal:", err.message);
    process.exit(1);
});

#!/usr/bin/env node
// Reads bug-reports/*.md → groups by test name → calls Claude Haiku to classify
// flakiness cause: timing / state-leak / environment / randomness / genuine-bug
//
// Usage:
//   node scripts/flakiness-classifier.js
//   ANTHROPIC_API_KEY=<key> node scripts/flakiness-classifier.js
//   REPORTS_DIR=custom/path node scripts/flakiness-classifier.js

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
const REPORTS_DIR = process.env.REPORTS_DIR ?? path.join(ROOT, "bug-reports");
const OUTPUT_DIR = path.join(ROOT, "flakiness-report");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "flakiness-report.md");

// ── parse a single bug report ─────────────────────────────────────────────────

function parseReport(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const testMatch = content.match(/^Test:\s+(.+)$/m);
    const errorMatch = content.match(/^Error:\s+(.+)$/m);
    // fall back to filename slug when content lacks "Test:" line
    const testName = testMatch?.[1]?.trim()
        ?? path.basename(filePath, ".md").replace(/_2\d{3}-\d{2}-\d{2}T.*$/, "").replace(/_/g, " ");
    const error = errorMatch?.[1]?.trim() ?? "";
    return { testName, error: error.slice(0, 300) };
}

// ── group all reports by test name ────────────────────────────────────────────

function groupReports() {
    if (!fs.existsSync(REPORTS_DIR)) {
        console.error(`[flakiness] Reports dir not found: ${REPORTS_DIR}`);
        process.exit(1);
    }
    const files = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith(".md")).sort();
    const groups = new Map();
    for (const file of files) {
        const report = parseReport(path.join(REPORTS_DIR, file));
        if (!groups.has(report.testName)) groups.set(report.testName, []);
        groups.get(report.testName).push({ file, error: report.error });
    }
    return groups;
}

// ── Claude call ───────────────────────────────────────────────────────────────

// The transport lives in `scripts/lib/anthropicRequest.js` — one copy for all five scripts and
// the bug reporter. It records `usage` in the token ledger, which six local copies of this
// function used to discard along with the rest of the response.
function callClaude(prompt, apiKey) {
    return sharedCallClaude(prompt, apiKey, { maxTokens: 2048, model: MODEL, label: "flakiness-classifier" });
}

// ── fallback: plain list without AI ──────────────────────────────────────────

function buildFallbackReport(flaky, stableCount, totalCount) {
    const lines = [
        "# Flakiness Report",
        "",
        `**Flaky tests:** ${flaky.length} | **Stable (1 report):** ${stableCount} | **Total unique tests:** ${totalCount}`,
        "",
    ];
    if (flaky.length > 0) {
        lines.push("## Flaky tests (appeared in multiple runs)", "");
        for (const { testName, count, errors } of flaky) {
            lines.push(`### ${testName}`);
            lines.push(`*${count} bug reports*  `);
            for (const e of errors) {
                if (e) lines.push(`> ${e}`);
            }
            lines.push("");
        }
    } else {
        lines.push("No flaky tests detected — every test has exactly one report.", "");
    }
    lines.push("---", "*AI classification unavailable — ANTHROPIC_API_KEY not set or balance zero.*");
    return lines.join("\n");
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
    const groups = groupReports();
    const flaky = [];
    let stableCount = 0;

    for (const [testName, reports] of groups) {
        const errors = [...new Set(reports.map((r) => r.error).filter(Boolean))];
        if (reports.length > 1) {
            flaky.push({ testName, count: reports.length, errors });
        } else {
            stableCount++;
        }
    }

    console.log(
        `[flakiness] ${groups.size} unique tests | ${flaky.length} flaky candidates | ${stableCount} stable`
    );

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        console.log("[flakiness] No ANTHROPIC_API_KEY — writing plain report.");
        fs.writeFileSync(OUTPUT_PATH, buildFallbackReport(flaky, stableCount, groups.size));
        console.log(`[flakiness] Saved: ${OUTPUT_PATH}`);
        return;
    }

    if (flaky.length === 0) {
        const report = [
            "# Flakiness Report",
            "",
            "No flaky tests detected — every test has exactly one bug report.",
            "",
            "---",
            "*Generated by Claude Haiku from bug-reports/*.md*",
        ].join("\n");
        fs.writeFileSync(OUTPUT_PATH, report);
        console.log("[flakiness] No flaky tests. Saved: " + OUTPUT_PATH);
        return;
    }

    const flakyBlock = flaky
        .slice(0, 25) // cap at 25 to stay within token budget
        .map(({ testName, count, errors }, i) => {
            const errorLines = errors.length
                ? errors.map((e) => `  Error: ${e}`).join("\n")
                : "  Error: (no error captured)";
            return `${i + 1}. "${testName}" (${count} reports)\n${errorLines}`;
        })
        .join("\n\n");

    const prompt = [
        "You are a senior QA engineer analysing test flakiness in a Playwright + TypeScript API/UI test suite.",
        "Classify each flaky test by its most likely root cause.",
        "",
        "Categories (pick exactly one per test):",
        "- **timing** — test races against async ops, uses fixed waits, or depends on execution speed",
        "- **state-leak** — previous test or run left DB/session data that affects this test",
        "- **environment** — depends on external service, network port, or CI vs local differences",
        "- **randomness** — uses non-deterministic data (timestamps, random IDs) without proper isolation",
        "- **genuine-bug** — error is consistent and looks like a real code defect, not intermittent",
        "",
        "Flaky tests to classify:",
        flakyBlock,
        "",
        "For each test respond with exactly:",
        "### <test name>",
        "**Category:** <one category>",
        "**Evidence:** one sentence — which part of the error points to this category",
        "**Fix:** one concrete suggestion",
        "",
        "Keep total response under 700 words.",
    ].join("\n");

    try {
        console.log(`[flakiness] Calling Claude Haiku for ${flaky.length} flaky test(s)...`);
        const analysis = await callClaude(prompt, apiKey);
        const runLabel = new Date().toISOString().slice(0, 10);
        const full = [
            `# Flakiness Report — ${runLabel}`,
            "",
            `**Flaky:** ${flaky.length} | **Stable:** ${stableCount} | **Total unique tests:** ${groups.size}`,
            "",
            analysis,
            "",
            "---",
            "*Generated by Claude Haiku from bug-reports/*.md*",
        ].join("\n");
        fs.writeFileSync(OUTPUT_PATH, full);
        console.log(`[flakiness] Report saved: ${OUTPUT_PATH}`);
    } catch (err) {
        console.log(`[flakiness] Claude unavailable (${err.message}) — writing plain report.`);
        fs.writeFileSync(OUTPUT_PATH, buildFallbackReport(flaky, stableCount, groups.size));
        console.log(`[flakiness] Fallback saved: ${OUTPUT_PATH}`);
    }
}

main().catch((err) => {
    console.error("[flakiness] Fatal:", err.message);
    process.exit(1);
});

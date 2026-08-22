#!/usr/bin/env node
// Reads a list of changed files → asks Claude which test files are impacted
// → writes impact-tests.txt (space-separated paths for `npx playwright test`)
//
// Usage (in CI):
//   git diff --name-only origin/$BASE_BRANCH...HEAD > changed-files.txt
//   ANTHROPIC_API_KEY=<key> node scripts/impact-analysis.js
//
// Fallback (no key): writes ALL test files — safe, runs everything.

// The key lives in .env like every other secret in this repo; without this the documented
// `npm run ai:*` commands died with "ANTHROPIC_API_KEY is not set" unless you pasted the key
// onto the command line by hand. Added 2026-08-21. { quiet: true } keeps the banner out of
// generated report output.
require("dotenv").config({ quiet: true });

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const CHANGED_FILES_PATH = path.join(ROOT, "changed-files.txt");
const OUTPUT_PATH = path.join(ROOT, "impact-tests.txt");

// ── discover test files ───────────────────────────────────────────────────────

function discoverTestFiles() {
    const results = execSync(`find tests -name "*.test.ts" | sort`, { cwd: ROOT })
        .toString()
        .trim()
        .split("\n")
        .filter(Boolean);
    return results;
}

function categorize(files) {
    const api = files.filter((f) => f.startsWith("tests/api/") && !f.includes("/pact/") && !f.includes("/concurrency/"));
    const pact = files.filter((f) => f.includes("/pact/"));
    const concurrency = files.filter((f) => f.includes("/concurrency/"));
    const e2e = files.filter((f) => f.startsWith("tests/e2e/"));
    const ui = files.filter((f) => f.startsWith("tests/ui/"));
    const unit = files.filter((f) => f.startsWith("tests/unit/"));
    return { api, pact, concurrency, e2e, ui, unit };
}

// ── Claude call ───────────────────────────────────────────────────────────────

function callClaude(prompt, apiKey) {
    const body = JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
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
                        if (parsed.error) reject(new Error(parsed.error.message));
                        else resolve(parsed.content[0].text);
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

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
    const allTests = discoverTestFiles();
    const { api, pact, concurrency, e2e, ui, unit } = categorize(allTests);

    // Read changed files
    const changedFiles = fs.existsSync(CHANGED_FILES_PATH)
        ? fs.readFileSync(CHANGED_FILES_PATH, "utf-8").trim().split("\n").filter(Boolean)
        : [];

    if (changedFiles.length === 0) {
        console.log("[impact-analysis] No changed files found — running all tests.");
        fs.writeFileSync(OUTPUT_PATH, allTests.join(" "));
        return;
    }

    console.log(`[impact-analysis] Changed files (${changedFiles.length}):\n  ${changedFiles.join("\n  ")}`);

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        console.log("[impact-analysis] No ANTHROPIC_API_KEY — running all tests (safe fallback).");
        fs.writeFileSync(OUTPUT_PATH, allTests.join(" "));
        return;
    }

    const prompt = [
        "You are a QA engineer doing impact analysis for a pull request in a clinic booking API test suite.",
        "",
        "Changed files in this PR:",
        changedFiles.map((f) => `  - ${f}`).join("\n"),
        "",
        "All test files in the project:",
        `  API tests: ${api.join(", ")}`,
        `  Concurrency tests: ${concurrency.join(", ")}`,
        `  Pact tests: ${pact.join(", ")}`,
        `  E2E tests: ${e2e.join(", ")}`,
        `  UI tests: ${ui.join(", ")}`,
        `  Unit tests: ${unit.join(", ")}`,
        "",
        "Project structure rules for reasoning:",
        "  - api/XxxClient.ts → HTTP client for a resource; if changed, run tests/* that exercise that resource",
        "  - utils/xxx.ts → shared utility; if changed, run all tests that likely import it",
        "  - pages/XxxPage.ts → Page Object for UI; if changed, run ui/* and e2e/* tests for that page",
        "  - data/testData.ts or data/seedAccounts.ts → used by all tests; if changed, run all tests",
        "  - fixtures/ → Playwright fixtures; if changed, run all tests",
        "  - playwright.config.ts or package.json → config; if changed, run all tests",
        "  - tests/api/*.test.ts → direct: include that file",
        "  - tests/ui/*.test.ts → direct: include that file",
        "  - tests/e2e/*.test.ts → direct: include that file",
        "  - scripts/ or docs/ or *.md → no tests needed",
        "",
        "Select the MINIMUM set of test files to run. Be conservative — include a file if in doubt.",
        "Return ONLY a JSON array of test file paths, no explanation, no markdown:",
        '["tests/api/auth.login.test.ts"]',
        "",
        "If only docs/scripts/config-unrelated files changed, return: []",
    ].join("\n");

    try {
        console.log("[impact-analysis] Calling Claude Haiku to determine impacted tests...");
        const raw = await callClaude(prompt, apiKey);
        console.log("[impact-analysis] Claude response:", raw.slice(0, 300));

        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) throw new Error("No JSON array in Claude response");

        const selected = JSON.parse(match[0]);
        // Validate: only include files that actually exist
        const valid = selected.filter((f) => allTests.includes(f));
        const invalid = selected.filter((f) => !allTests.includes(f));

        if (invalid.length > 0) {
            console.warn(`[impact-analysis] Ignoring ${invalid.length} non-existent file(s) from Claude: ${invalid.join(", ")}`);
        }

        if (valid.length === 0) {
            console.log("[impact-analysis] Claude: no tests impacted by these changes.");
            fs.writeFileSync(OUTPUT_PATH, "");
        } else {
            console.log(`[impact-analysis] Selected ${valid.length} test file(s):\n  ${valid.join("\n  ")}`);
            fs.writeFileSync(OUTPUT_PATH, valid.join(" "));
        }
    } catch (err) {
        console.warn(`[impact-analysis] Claude call failed (${err.message}) — running all tests.`);
        fs.writeFileSync(OUTPUT_PATH, allTests.join(" "));
    }
}

main().catch((err) => {
    console.error("[impact-analysis] Fatal:", err.message);
    // On any fatal error — write all tests so CI doesn't silently skip everything
    const allTests = discoverTestFiles();
    fs.writeFileSync(OUTPUT_PATH, allTests.join(" "));
    process.exit(0);
});

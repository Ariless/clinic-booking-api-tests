#!/usr/bin/env node
// Reads openapi.yaml + test file names → asks Claude Haiku for a gap analysis
// → saves docs/AI_GAP_ANALYSIS.md
//
// Usage:
//   ANTHROPIC_API_KEY=<key> node scripts/ai-gap-analysis.js
//   ANTHROPIC_API_KEY=<key> OPENAPI_PATH=/custom/path/openapi.yaml node scripts/ai-gap-analysis.js

const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OPENAPI_PATH =
    process.env.OPENAPI_PATH ??
    path.join(ROOT, "..", "sut", "openapi", "openapi.yaml");
const TESTS_DIR = path.join(ROOT, "tests");
const OUTPUT_PATH = path.join(ROOT, "docs", "AI_GAP_ANALYSIS.md");

// ── helpers ──────────────────────────────────────────────────────────────────

function extractPathsBlock(yaml) {
    const start = yaml.indexOf("\npaths:");
    const end = yaml.indexOf("\ncomponents:");
    return yaml.slice(start, end > -1 ? end : undefined).trim();
}

function extractTestNames(fileContent) {
    const names = [];
    for (const m of fileContent.matchAll(
        /(?:test\.describe|describe)\(\s*['"`]([^'"`\n]+)['"`]/g
    )) {
        names.push(`  [describe] ${m[1]}`);
    }
    for (const m of fileContent.matchAll(/\btest\(\s*['"`]([^'"`\n]+)['"`]/g)) {
        names.push(`  [test] ${m[1]}`);
    }
    return names;
}

function collectTestInventory(dir, base = dir) {
    const lines = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            lines.push(...collectTestInventory(full, base));
        } else if (entry.name.endsWith(".test.js")) {
            const rel = path.relative(base, full);
            const names = extractTestNames(fs.readFileSync(full, "utf8"));
            lines.push(`### ${rel}`);
            lines.push(...(names.length ? names : ["  (no named tests found)"]));
        }
    }
    return lines;
}

function callClaude(prompt, apiKey) {
    const body = JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
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
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    const parsed = JSON.parse(data);
                    if (parsed.error) reject(new Error(parsed.error.message));
                    else resolve(parsed.content[0].text);
                });
            }
        );
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error("Error: ANTHROPIC_API_KEY is not set.");
        process.exit(1);
    }

    if (!fs.existsSync(OPENAPI_PATH)) {
        console.error(`Error: OpenAPI spec not found at ${OPENAPI_PATH}`);
        console.error("Set OPENAPI_PATH env var to override.");
        process.exit(1);
    }

    console.log("Reading OpenAPI spec...");
    const yaml = fs.readFileSync(OPENAPI_PATH, "utf8");
    const pathsBlock = extractPathsBlock(yaml);

    console.log("Collecting test inventory...");
    const inventory = collectTestInventory(TESTS_DIR).join("\n");

    const prompt = `You are a QA coverage analyst. Analyze an OpenAPI spec against a test suite inventory and produce a gap analysis.

## OpenAPI paths (YAML):

\`\`\`yaml
${pathsBlock}
\`\`\`

## Test inventory (file → test/describe names):

${inventory}

## Task

Produce a markdown document with these sections. Use tables where possible.

### 1. Coverage summary
A short table: endpoint count, documented error codes total, endpoints with at least one test, endpoints with zero tests.

### 2. Endpoints with no test coverage
Table: Method | Path | Documented status codes | Risk (High/Medium/Low)
Include only endpoints that have zero test coverage. Assign risk based on: authenticated routes with side effects = High; read-only with auth = Medium; unauthenticated read-only = Low.

### 3. Error codes not exercised
Table: Endpoint | Status code | Error condition | Priority
List only status codes that appear in the spec but are not covered by any test. Priority = High if it's a security boundary (401/403) or data integrity issue (409/422), otherwise Medium/Low.

### 4. Additional test scenarios worth adding
Table: Area | Scenario | Rationale
Focus on: validation boundaries (missing required fields, wrong types), RBAC edge cases, idempotency, concurrency, state machine completeness.

### 5. What is well covered
3–5 bullet points. Acknowledge the strongest parts of the suite.

Be specific — always name the exact endpoint and status code. Do not pad or repeat yourself.`;

    console.log("Calling Claude Haiku...");
    const analysis = await callClaude(prompt, apiKey);

    const now = new Date().toISOString().slice(0, 10);
    const output = `# AI Gap Analysis — clinic-booking-api-tests

> **Generated:** ${now}
> **Model:** claude-haiku-4-5-20251001
> **Source:** openapi.yaml (${Object.keys(yaml.match(/operationId:/g) ?? {}).length ?? "~30"} operations) + ${TESTS_DIR.split("/").slice(-2).join("/")} test suite
> **How to regenerate:** \`ANTHROPIC_API_KEY=<key> node scripts/ai-gap-analysis.js\`

---

${analysis}

---

*This document is generated by AI and reviewed by a human before use. The model identifies structural gaps from names and spec only — it does not run tests or read test bodies.*
`;

    fs.writeFileSync(OUTPUT_PATH, output, "utf8");
    console.log(`\nSaved: ${OUTPUT_PATH}`);
}

main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});

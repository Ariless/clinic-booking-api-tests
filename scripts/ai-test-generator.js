#!/usr/bin/env node
// Reads openapi.yaml → asks Claude Haiku to generate a Playwright test file draft
// for a specific API tag. Student reviews and edits the output.
//
// Usage:
//   node scripts/ai-test-generator.js --tag Auth
//   node scripts/ai-test-generator.js --tag Appointments --out tests/api/generated-appointments.test.ts
//   ANTHROPIC_API_KEY=<key> node scripts/ai-test-generator.js --tag Doctors
//   OPENAPI_PATH=../sut/openapi/openapi.yaml node scripts/ai-test-generator.js --tag AI

// The key lives in .env like every other secret in this repo; without this the documented
// `npm run ai:*` commands died with "ANTHROPIC_API_KEY is not set" unless you pasted the key
// onto the command line by hand. Added 2026-08-21. { quiet: true } keeps the banner out of
// generated report output.
require("dotenv").config({ quiet: true });

const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OPENAPI_PATH =
    process.env.OPENAPI_PATH ?? path.join(ROOT, "../sut/openapi/openapi.yaml");

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const tag = args[args.indexOf("--tag") + 1] ?? null;
    const outIdx = args.indexOf("--out");
    const out = outIdx !== -1 ? args[outIdx + 1] : null;
    return { tag, out };
}

// ── extract available tags from spec ─────────────────────────────────────────

function extractTags(specText) {
    const tagMatches = specText.matchAll(/^\s{2}-\s+name:\s+(\S+)/gm);
    return [...tagMatches].map((m) => m[1]);
}

// ── extract endpoint blocks for a specific tag ────────────────────────────────

function extractTagSection(specText, tag) {
    // Keeps the path blocks whose operations carry the requested tag, in either OpenAPI form:
    // `tags: [Auth]` on one line, or `tags:` followed by `- Auth`.
    //
    // A line-by-line first pass used to sit here, building a `result` array and tracking `inPath`,
    // `pathIndent` and `capture`. Nothing read any of it — the function has always returned the
    // block filter below, so the loop was dead weight that looked like the real logic. Removed
    // 2026-08-22; behaviour is unchanged.
    const blocks = specText.split(/\n(?= {2}\/)/);
    return blocks
        .filter((block) => {
            const tagPattern = new RegExp(`tags:\\s*\\[${tag}\\]|tags:[^\\n]*\\n[^\\n]*-\\s*${tag}\\b`);
            return tagPattern.test(block);
        })
        .join("\n");
}

// ── Claude call ───────────────────────────────────────────────────────────────

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

// ── fallback stub when no API key ─────────────────────────────────────────────

function buildFallbackStub(tag) {
    return [
        `// AI-generated test stub for tag: ${tag}`,
        `// Run with ANTHROPIC_API_KEY set to generate real tests.`,
        `//`,
        `// IMPORTANT: This is a draft. Review and edit before committing:`,
        `//   - Replace placeholder assertions with real schema/value checks`,
        `//   - Wire in fixtures from ../../fixtures`,
        `//   - Adjust test names to follow METHOD /path — STATUS desc @tag convention`,
        "",
        `import { test, expect } from "@playwright/test";`,
        "",
        `test.describe("${tag} — generated stub", () => {`,
        `  test("TODO: replace with real test @api", async ({ request }) => {`,
        `    // TODO: implement`,
        `  });`,
        `});`,
    ].join("\n");
}

// ── build the generation prompt ───────────────────────────────────────────────

function buildPrompt(tag, specSection) {
    return [
        `You are a senior QA engineer writing Playwright API tests in TypeScript.`,
        `Generate a draft test file for the "${tag}" API tag based on the OpenAPI spec below.`,
        "",
        "Project conventions (follow exactly):",
        "- Test naming: `METHOD /path — STATUS description @tag`",
        "  Examples: `POST /auth/login — 200 returns token @api @smoke`",
        "            `POST /auth/login — 401 wrong password @api`",
        "- Tags to use: `@api` always; add `@smoke` for the main happy path only",
        "- Use `request` fixture from Playwright (`{ request }` destructure in test)",
        "- For assertions: first check `response.ok()` or `response.status()`, then `await response.json()`",
        "- Assert response shape with targeted field checks, e.g. `expect(body).toHaveProperty('token')`",
        "- Error cases: assert `body.errorCode` equals the documented error code",
        "- Auth: for protected endpoints use `Authorization: Bearer <token>` header",
        "  Get token via POST /api/v1/auth/login with `{ email: 'patient@example.com', password: 'password' }`",
        "- Base URL: `process.env.BASE_URL ?? 'http://localhost:3000'`",
        "- No shared state between tests — each test is independent",
        "",
        "Output format:",
        "- A single TypeScript file, no markdown fences, no explanation before or after the code",
        "- Start with imports, then `const BASE = ...`, then `test.describe(...)` blocks",
        "- Add a `// TODO:` comment on any line that needs manual review (e.g. required request body fields)",
        "- Keep tests focused: one behaviour per test",
        "",
        `OpenAPI spec for "${tag}" endpoints:`,
        "```yaml",
        specSection.slice(0, 6000), // cap to stay within token budget
        "```",
    ].join("\n");
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
    const { tag, out } = parseArgs();

    if (!fs.existsSync(OPENAPI_PATH)) {
        console.error(`[test-gen] OpenAPI spec not found: ${OPENAPI_PATH}`);
        console.error("[test-gen] Set OPENAPI_PATH env var or start from the tests/ directory.");
        process.exit(1);
    }

    const specText = fs.readFileSync(OPENAPI_PATH, "utf-8");
    const availableTags = extractTags(specText);

    if (!tag) {
        console.log("[test-gen] Available tags:", availableTags.join(", "));
        console.log("[test-gen] Usage: node scripts/ai-test-generator.js --tag <tag>");
        process.exit(0);
    }

    if (!availableTags.includes(tag)) {
        console.error(`[test-gen] Unknown tag "${tag}". Available: ${availableTags.join(", ")}`);
        process.exit(1);
    }

    const specSection = extractTagSection(specText, tag);
    if (!specSection.trim()) {
        console.error(`[test-gen] Could not extract spec section for tag "${tag}".`);
        process.exit(1);
    }

    const outputPath = out
        ? path.resolve(out)
        : path.join(ROOT, `tests/api/generated-${tag.toLowerCase()}.test.ts`);

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        console.log("[test-gen] No ANTHROPIC_API_KEY — writing stub file.");
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buildFallbackStub(tag));
        console.log(`[test-gen] Stub saved: ${outputPath}`);
        console.log("[test-gen] Set ANTHROPIC_API_KEY to generate real tests.");
        return;
    }

    console.log(`[test-gen] Generating tests for tag "${tag}"...`);
    const prompt = buildPrompt(tag, specSection);

    try {
        const generated = await callClaude(prompt, apiKey);
        // strip markdown code fences if Claude added them
        const code = generated
            .replace(/^```(?:typescript|ts)?\n?/m, "")
            .replace(/\n?```\s*$/m, "")
            .trim();

        const header = [
            `// AI-generated test draft for tag: ${tag}`,
            `// Generated: ${new Date().toISOString().slice(0, 10)}`,
            `//`,
            `// IMPORTANT: Review before committing:`,
            `//   - Check TODO comments`,
            `//   - Replace raw request calls with API client methods where they exist`,
            `//   - Wire in fixtures from ../../fixtures for user/slot setup`,
            `//   - Verify test names follow project naming convention`,
            "",
        ].join("\n");

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, header + code + "\n");
        console.log(`[test-gen] Draft saved: ${outputPath}`);
        console.log("[test-gen] Next: review TODOs, run tsc --noEmit, adjust assertions.");
    } catch (err) {
        console.log(`[test-gen] Claude unavailable (${err.message}) — writing stub.`);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, buildFallbackStub(tag));
        console.log(`[test-gen] Stub saved: ${outputPath}`);
    }
}

main().catch((err) => {
    console.error("[test-gen] Fatal:", err.message);
    process.exit(1);
});

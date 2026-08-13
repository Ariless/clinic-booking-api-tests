#!/usr/bin/env node
// Guards the claims this repo makes about itself.
//
// Two kinds of claim drift, both real incidents in this project:
//   1. A convention documented as done but not enforced — fixture injection for
//      page objects lived in README, CLAUDE.md and TEST_STRATEGY for three months
//      while 121 `new XPage(page)` calls sat in the tests (fixed 2026-08-11).
//   2. A number that was true once — test and file counts quoted in prose age
//      silently as the suite changes.
//
// Usage:
//   node scripts/check-conventions.js          # all checks
//   node scripts/check-conventions.js --fast   # skip the playwright --list count

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const FAST = process.argv.includes("--fast");
const failures = [];

function fail(rule, message) {
    failures.push({ rule, message });
}

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else if (/\.(ts|js)$/.test(entry.name)) out.push(full);
    }
    return out;
}

// ── 1. Page objects come from the fixture, never from `new` in a test file ────
{
    const dirs = ["tests/ui", "tests/e2e"].map((d) => path.join(ROOT, d));
    const offenders = [];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        for (const file of walk(dir)) {
            const lines = fs.readFileSync(file, "utf8").split("\n");
            lines.forEach((line, i) => {
                if (/new\s+[A-Z][A-Za-z]*Page\s*\(/.test(line)) {
                    offenders.push(`${path.relative(ROOT, file)}:${i + 1}`);
                }
            });
        }
    }
    if (offenders.length) {
        fail(
            "page-objects-via-fixture",
            `page objects must be destructured from fixtures/pages.ts, not instantiated:\n      ` +
                offenders.join("\n      "),
        );
    }
}

// ── 2. The fixture barrel actually re-exports the page fixtures ──────────────
{
    const indexPath = path.join(ROOT, "fixtures/index.ts");
    const index = fs.readFileSync(indexPath, "utf8");
    if (!/from\s+"\.\/pages"/.test(index)) {
        fail(
            "fixture-barrel-exports-pages",
            "fixtures/index.ts does not re-export ./pages — tests importing from '../../fixtures' would not get page objects",
        );
    }
}

// ── 3. Countable claims in docs/FACTS.json still match reality ──────────────
{
    const factsPath = path.join(ROOT, "docs/FACTS.json");
    const facts = JSON.parse(fs.readFileSync(factsPath, "utf8"));

    // Counted from git, not from the disk: gitignored suites (pact, course demos) exist on some
    // machines and not in CI, so a disk walk gives a different answer depending on where it runs —
    // and a claim that only holds in one environment is not a claim.
    const trackedTests = execSync("git ls-files tests", {
        cwd: ROOT,
        encoding: "utf8",
    })
        .split("\n")
        .filter((f) => /\.test\.(ts|js)$/.test(f));

    if (trackedTests.length !== facts.testFiles) {
        fail(
            "facts-test-files",
            `docs/FACTS.json says ${facts.testFiles} test files, found ${trackedTests.length}`,
        );
    }

    const pageObjects = fs
        .readdirSync(path.join(ROOT, "pages"))
        .filter((f) => /Page\.ts$/.test(f) && f !== "BasePage.ts").length;
    if (pageObjects !== facts.pageObjects) {
        fail(
            "facts-page-objects",
            `docs/FACTS.json says ${facts.pageObjects} page objects, found ${pageObjects}`,
        );
    }

    if (!FAST) {
        // Same reason as above: list only the tracked suites, so the counts match everywhere.
        const listed = execSync(
            `npx playwright test --list ${trackedTests.map((f) => JSON.stringify(f)).join(" ")}`,
            {
                cwd: ROOT,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
            },
        );
        const unique = (listed.match(/^\s+\[chromium\]/gm) || []).length;
        const total = Number((listed.match(/Total:\s+(\d+)\s+tests/) || [])[1] || 0);

        if (unique !== facts.uniqueTests) {
            fail(
                "facts-unique-tests",
                `docs/FACTS.json says ${facts.uniqueTests} unique tests, found ${unique}`,
            );
        }
        if (total !== facts.testRunsAllProjects) {
            fail(
                "facts-total-runs",
                `docs/FACTS.json says ${facts.testRunsAllProjects} runs across projects, found ${total}`,
            );
        }
    }
}

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length) {
    console.error("\nConvention check failed:\n");
    for (const f of failures) console.error(`  [${f.rule}] ${f.message}\n`);
    console.error(
        "A claim this repo makes about itself is no longer true. Fix the code, or update docs/FACTS.json and the prose that quotes it.\n",
    );
    process.exit(1);
}

console.log("Convention check passed — documented claims match the code.");

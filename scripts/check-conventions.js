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

// ── 2. The fixture barrel actually reaches the page fixtures ────────────────
// Until 2026-08-22 this looked for a literal `from "./pages"` in fixtures/index.ts. But the barrel
// is a chain — userFixture → slotFixture → twoUsersFixture → pages → unstaffedSpecialty — and
// index.ts re-exports only its last link. Adding a link at the end (unstaffedSpecialtyFixture)
// made the literal disappear while the barrel kept working exactly as documented, so the check
// failed on a healthy repository. It now walks the chain: what matters is that fixtures/pages.ts
// is reachable from the barrel, not which file happens to name it.
{
    const fixturesDir = path.join(ROOT, "fixtures");
    const pagesModule = path.join(fixturesDir, "pages.ts");

    const resolveLink = (fromFile, spec) => {
        const base = path.resolve(path.dirname(fromFile), spec);
        for (const candidate of [`${base}.ts`, path.join(base, "index.ts")]) {
            if (fs.existsSync(candidate)) return candidate;
        }
        return null;
    };

    // Two ways a link carries the fixture forward: a re-export, or the `test as base` import that
    // every fixture in the chain uses to extend the one before it. Plain imports are ignored — a
    // fixture may import a page object as a type without putting it on the barrel.
    const linksOf = (file) => {
        const src = fs.readFileSync(file, "utf8");
        const specs = [
            ...[...src.matchAll(/export\s+(?:\*|type\s*\{[^}]*\}|\{[^}]*\})\s+from\s+["'](\.[^"']+)["']/g)],
            ...[...src.matchAll(/import\s*\{[^}]*\btest\s+as\s+base\b[^}]*\}\s*from\s+["'](\.[^"']+)["']/g)],
        ].map((m) => m[1]);
        return specs.map((spec) => resolveLink(file, spec)).filter(Boolean);
    };

    const seen = new Set();
    const queue = [path.join(fixturesDir, "index.ts")];
    let reachesPages = false;
    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        if (file === pagesModule) {
            reachesPages = true;
            break;
        }
        queue.push(...linksOf(file));
    }

    if (!reachesPages) {
        fail(
            "fixture-barrel-exports-pages",
            "fixtures/index.ts does not reach fixtures/pages.ts through its export chain — tests importing from '../../fixtures' would not get page objects",
        );
    }
}

let facts;

// ── 3. Countable claims in docs/FACTS.json still match reality ──────────────
{
    const factsPath = path.join(ROOT, "docs/FACTS.json");
    facts = JSON.parse(fs.readFileSync(factsPath, "utf8"));

    // Counted from git, not from the disk: gitignored suites (pact, AI demos) exist on some
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

// ── 4. Doc-level counts: the register, the matrix, the visual suite ─────────
// Added 2026-08-21. The three numbers below had all drifted in prose: README said 5 fixed bugs
// against a register holding 23 closed entries, 120 requirements against a matrix totalling 121,
// and 10 visual tests against a file holding 7. Nothing was wrong with the docs' structure — the
// counts simply aged, exactly the failure mode this script exists to catch.
{
    const knownIssues = fs.readFileSync(path.join(ROOT, "docs/KNOWN_ISSUES.md"), "utf8");
    const summary = knownIssues.slice(knownIssues.indexOf("## Summary table"));
    const count = (re) => (summary.match(re) || []).length;

    const closed = count(/✅ (Fixed|Addressed)/g);
    const open = count(/🔴 Open/g);
    const debt = count(/⚠️ Design debt/g);

    if (closed !== facts.knownIssuesClosed) {
        fail("facts-issues-closed", `docs/FACTS.json says ${facts.knownIssuesClosed} closed register entries, summary table has ${closed}`);
    }
    if (open !== facts.knownIssuesOpen) {
        fail("facts-issues-open", `docs/FACTS.json says ${facts.knownIssuesOpen} open register entries, summary table has ${open}`);
    }
    if (debt !== facts.knownIssuesDesignDebt) {
        fail("facts-issues-debt", `docs/FACTS.json says ${facts.knownIssuesDesignDebt} design debt entries, summary table has ${debt}`);
    }

    const rtm = fs.readFileSync(path.join(ROOT, "docs/RTM.md"), "utf8");
    const totalRow = rtm.match(/\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*\*\*(\d+)/);
    if (!totalRow) {
        fail("facts-rtm-row", "docs/RTM.md has no **Total** row to read requirement counts from");
    } else {
        if (Number(totalRow[1]) !== facts.rtmRequirements) {
            fail("facts-rtm-requirements", `docs/FACTS.json says ${facts.rtmRequirements} requirements, RTM total row says ${totalRow[1]}`);
        }
        if (Number(totalRow[2]) !== facts.rtmCovered) {
            fail("facts-rtm-covered", `docs/FACTS.json says ${facts.rtmCovered} covered, RTM total row says ${totalRow[2]}`);
        }
    }

    // README quotes the closed-entry count in prose; tie it to the same number so the two cannot
    // drift apart again — the exact failure this whole section exists to prevent.
    const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
    const quoted = readme.match(/\*\*(\d+) closed entries\*\*/);
    if (!quoted) {
        fail("facts-readme-register", "README.md no longer quotes the register size as '**N closed entries**' — update the check or restore the phrasing");
    } else if (Number(quoted[1]) !== facts.knownIssuesClosed) {
        fail("facts-readme-register", `README.md says ${quoted[1]} closed entries, docs/FACTS.json says ${facts.knownIssuesClosed}`);
    }

    const visual = fs.readFileSync(path.join(ROOT, "tests/ui/visual.test.ts"), "utf8");
    const visualTests = (visual.match(/^\s+test\(/gm) || []).length;
    if (visualTests !== facts.visualTests) {
        fail("facts-visual-tests", `docs/FACTS.json says ${facts.visualTests} visual tests, tests/ui/visual.test.ts has ${visualTests}`);
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

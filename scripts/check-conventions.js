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
    // The row states three counts, not one. Only the closed count was tied to FACTS.json, so
    // "4 design debt" survived two new debt entries (D-04, D-05) that existed as cards and were
    // missing from the summary table — a number can only stay true if something reads it.
    const quoted = readme.match(/\*\*(\d+) closed entries\*\*, (\d+) open, (\d+) design debt/);
    if (!quoted) {
        fail("facts-readme-register", "README.md no longer quotes the register as '**N closed entries**, N open, N design debt' — update the check or restore the phrasing");
    } else {
        const [, closedQuoted, openQuoted, debtQuoted] = quoted.map(Number);
        if (closedQuoted !== facts.knownIssuesClosed) {
            fail("facts-readme-register", `README.md says ${closedQuoted} closed entries, docs/FACTS.json says ${facts.knownIssuesClosed}`);
        }
        if (openQuoted !== facts.knownIssuesOpen) {
            fail("facts-readme-register", `README.md says ${openQuoted} open entries, docs/FACTS.json says ${facts.knownIssuesOpen}`);
        }
        if (debtQuoted !== facts.knownIssuesDesignDebt) {
            fail("facts-readme-register", `README.md says ${debtQuoted} design debt entries, docs/FACTS.json says ${facts.knownIssuesDesignDebt}`);
        }
    }

    // The header table quotes three more totals, and they are the first thing anyone opening the
    // repository reads. They had aged to 350/415/80 against a FACTS.json holding 364/429/82, and
    // the register line above was the only prose this section guarded — so the check stayed green
    // over a README that undersold the suite by 14 tests. Guard every number the table states.
    const suiteRow = readme.match(
        /\|\s*\*\*Suite\*\*\s*\|\s*(\d+) unique tests · (\d+) runs across projects · (\d+) test files\s*\|/,
    );
    if (!suiteRow) {
        fail(
            "facts-readme-suite",
            "README.md no longer states the suite as 'N unique tests · N runs across projects · N test files' — update the check or restore the phrasing",
        );
    } else {
        const [, unique, runs, files] = suiteRow.map(Number);
        if (unique !== facts.uniqueTests || runs !== facts.testRunsAllProjects || files !== facts.testFiles) {
            fail(
                "facts-readme-suite",
                `README.md says ${unique} unique / ${runs} runs / ${files} files, docs/FACTS.json says ${facts.uniqueTests} / ${facts.testRunsAllProjects} / ${facts.testFiles}`,
            );
        }
    }

    const reqRow = readme.match(/\|\s*\*\*Requirements\*\*\s*\|\s*(\d+) of (\d+) covered/);
    if (!reqRow) {
        fail(
            "facts-readme-requirements",
            "README.md no longer states requirement coverage as 'N of N covered' — update the check or restore the phrasing",
        );
    } else if (Number(reqRow[1]) !== facts.rtmCovered || Number(reqRow[2]) !== facts.rtmRequirements) {
        fail(
            "facts-readme-requirements",
            `README.md says ${reqRow[1]} of ${reqRow[2]} requirements covered, docs/FACTS.json says ${facts.rtmCovered} of ${facts.rtmRequirements}`,
        );
    }

    // RTM.md restates the same totals under a "verified" date, which is worse than stating them
    // once: a stale number that claims to have been checked reads as a checked number.
    const rtmToday = rtm.match(/\*\*Today:\*\* (\d+) unique tests \/ (\d+) runs across (\d+) files/);
    if (!rtmToday) {
        fail(
            "facts-rtm-today",
            "docs/RTM.md no longer states 'Today: N unique tests / N runs across N files' — update the check or restore the phrasing",
        );
    } else {
        const [, unique, runs, files] = rtmToday.map(Number);
        if (unique !== facts.uniqueTests || runs !== facts.testRunsAllProjects || files !== facts.testFiles) {
            fail(
                "facts-rtm-today",
                `docs/RTM.md says ${unique} unique / ${runs} runs / ${files} files, docs/FACTS.json says ${facts.uniqueTests} / ${facts.testRunsAllProjects} / ${facts.testFiles}`,
            );
        }
    }

    const visual = fs.readFileSync(path.join(ROOT, "tests/ui/visual.test.ts"), "utf8");
    const visualTests = (visual.match(/^\s+test\(/gm) || []).length;
    if (visualTests !== facts.visualTests) {
        fail("facts-visual-tests", `docs/FACTS.json says ${facts.visualTests} visual tests, tests/ui/visual.test.ts has ${visualTests}`);
    }
}

// ── 5. Per-file test counts quoted in prose ──────────────────────────────────
// FACTS.json guards the totals; this guards the counts written next to a specific
// file ("`doctors.schedule.test.ts` — 10 tests"). Those drift the same way and are
// worse, because they read as precise. Found 2026-08-26: TEST_STRATEGY claimed 11
// tests for content.stress.test.ts, which has 10.
//
// Counted statically rather than through `playwright --list` so the rule survives
// --fast: test(), test.skip(), test.fixme(), it() — but not test.describe/beforeEach/step.
{
    // The title argument is what separates a test from a suite-level guard: Playwright's
    // `test.skip(condition, reason)` inside a describe takes a boolean first and declares
    // nothing. Requiring a string literal after the paren keeps those out of the count —
    // it cost a false positive on doctors.cache.test.ts before the check was tightened.
    const TEST_DECL = /(?:^|\s)(?:test|it)(?:\.(?:skip|fixme|only|fail))?\s*\(\s*['"`]/gm;

    // A table-driven file declares `test(...)` once inside a loop and produces one test per
    // row, so counting declarations undercounts it — http.methods.test.ts reads as 5 and runs
    // as 10. Rather than guess the row count, the rule declines to judge such files: a check
    // that is right about 70 files and quietly wrong about one is worse than a narrower check.
    const PARAMETRISED = /^(?:for\s*\(|\w[\w.]*\.forEach\()/m;

    function countTests(relPath) {
        const abs = path.join(ROOT, relPath);
        if (!fs.existsSync(abs)) return null;
        const source = fs.readFileSync(abs, "utf8");
        if (PARAMETRISED.test(source)) return null; // table-driven — see above
        return (source.match(TEST_DECL) || []).length;
    }

    /** Resolve a bare filename to a tracked path, if it is unambiguous.
     *  git-tracked only, for the same reason FACTS.json counts that way: an
     *  untracked work-in-progress file must not make the check fail differently
     *  here than it does in CI. */
    const byName = new Map();
    const tracked = execSync("git ls-files tests", { cwd: ROOT, encoding: "utf8" })
        .split("\n")
        .filter((f) => /\.test\.ts$/.test(f));
    for (const rel of tracked) {
        const base = path.basename(rel);
        if (byName.has(base)) byName.set(base, null); // ambiguous — skip it
        else byName.set(base, rel);
    }

    const docs = ["README.md", "CLAUDE.md"].concat(
        fs.existsSync(path.join(ROOT, "docs"))
            ? fs.readdirSync(path.join(ROOT, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)
            : [],
    );

    for (const doc of docs) {
        const abs = path.join(ROOT, doc);
        if (!fs.existsSync(abs)) continue;
        fs.readFileSync(abs, "utf8").split("\n").forEach((line, i) => {
            // Only a count that follows the filename directly — "`x.test.ts` — 8 tests",
            // "(10 tests," — is a claim about the file. Prose like "in all 4 tests that
            // create slots" or "4 tests in `x.test.ts`" describes a subset and is left alone;
            // both wordings exist in these docs and both are correct.
            const fileMatch = line.match(
                /`([\w./-]*?([\w.-]+\.test\.ts))`[^`]{0,3}?[—:(-]\s*(\d+)\s+tests\b/,
            );
            if (!fileMatch) return;

            const rel = byName.get(fileMatch[2]);
            if (!rel) return; // unknown or ambiguous filename — not this rule's business

            const actual = countTests(rel);
            const quoted = Number(fileMatch[3]);
            if (actual !== null && actual !== quoted) {
                fail(
                    "file-test-count",
                    `${doc}:${i + 1} says ${quoted} tests for ${fileMatch[2]}, the file declares ${actual}`,
                );
            }
        });
    }
}

// ── 6. Runners named in prose have to exist ──────────────────────────────────
// TEST_STRATEGY described `npm run test:unit` as "jest — 14 tests" for long enough
// that nobody noticed jest was never a dependency; the script is playwright. A
// wrong runner sends a reader to the wrong docs and the wrong debugging.
{
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const RUNNERS = ["jest", "mocha", "vitest", "ava", "jasmine"];
    const absent = RUNNERS.filter((r) => !Object.keys(deps).some((d) => d === r || d.endsWith(`/${r}`)));

    const docs = ["README.md", "CLAUDE.md"].concat(
        fs.existsSync(path.join(ROOT, "docs"))
            ? fs.readdirSync(path.join(ROOT, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)
            : [],
    );

    for (const doc of docs) {
        const abs = path.join(ROOT, doc);
        if (!fs.existsSync(abs)) continue;
        fs.readFileSync(abs, "utf8").split("\n").forEach((line, i) => {
            // Only where prose describes how a command runs, not prose about the tools themselves.
            if (!/npm run |npx /.test(line)) return;
            for (const runner of absent) {
                if (new RegExp(`\\b${runner}\\b`, "i").test(line)) {
                    fail(
                        "runner-not-installed",
                        `${doc}:${i + 1} describes a command as ${runner}, which is not a dependency of this project`,
                    );
                }
            }
        });
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

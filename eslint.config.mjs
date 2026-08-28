// The SUT has had a lint config since the start; this repository never did, so its own
// conventions lived only in CLAUDE.md and in review. The rules below are the ones that can
// be checked mechanically — the rest of the conventions stay prose.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      "allure-results/**",
      "allure-report/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "bug-reports/**",
      "ci-summary/**",
      "flakiness-report/**",
      "pacts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      // args: "none" — Playwright fixtures are requested by destructuring them, and the
      // fixture name is the API: `async ({ page })` in a test that never touches `page`
      // is what makes the browser start at all. Renaming it to `_page` would silently
      // stop requesting the fixture. Unused variables inside a body are still errors.
      "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
      // CLAUDE.md WON'T: `any` — use `unknown` plus a type guard, or an explicit type.
      "@typescript-eslint/no-explicit-any": "error",
      // `async ({}, use)` and `async ({}, testInfo)` are how Playwright says "this hook
      // needs no fixtures". The empty pattern is the API, not an oversight.
      "no-empty-pattern": "off",
      // CLAUDE.md WON'T: waitForTimeout — use auto-waiting or waitForResponse. A sleep in a
      // test does not fail when it is wrong, it just makes the suite slower and flakier.
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message: "waitForTimeout is banned (CLAUDE.md): use Playwright auto-waiting or waitForResponse.",
        },
      ],
    },
  },
  {
    // Scripts are Node CommonJS utilities, not part of the typed test suite: require() is
    // how they are written, so the TS rule banning it does not apply here. `utils/**/*.js` is in
    // the same category and for a specific reason: `utils/tokenLedger.js` is read by both halves of
    // the repository — the TypeScript tests through `require`, and the plain-`node` scripts in
    // `scripts/`, which have no build step. Same argument as `config/models.json`.
    files: ["scripts/**/*.js", "utils/**/*.js", "*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      // Base rule off: the typescript-eslint version above already reports these, and having
      // both on made every unused variable in a script show up twice.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // k6 scripts run in the k6 runtime, not in Node: __ENV and friends come from there,
    // and the file is never imported by the suite.
    files: ["k6/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { __ENV: "readonly", __VU: "readonly", __ITER: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

---
name: config
description: Environment variables, baseUrl, and configuration access in tests. Use when: changing the base URL or port the tests hit; adding a new environment variable to the test suite; running tests against a non-default environment.
triggers:
  - changing the base URL or port the tests hit
  - adding a new environment variable to the test suite
  - running tests against a non-default environment
  - unsure how to access config values in a test or client
---

# Skill: Config

## WHEN to load this skill

Load when the task involves:
- Adding a new environment variable needed in tests
- Changing where `baseUrl` comes from
- Running the suite against staging, Docker, or a non-standard port
- Debugging a test that hardcodes `localhost:3000`

---

## WHY

Hardcoded URLs and port numbers in tests mean the suite only works on one machine. All env-specific values go through `config/env.ts` so the suite works locally, in Docker, and in CI without changing test code — only env vars change.

---

## HOW

### Single source of config — `config/env.ts`

```ts
export const config = {
  baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
};
```

**Import in clients and fixtures:**
```ts
import { config } from '../../config/env';
// use: config.baseUrl
```

Never call `process.env.BASE_URL` directly in test files — always go through `config/env.ts`.

### Adding a new variable

1. Add to `config/env.ts`:
   ```ts
   export const config = {
     baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
     featureFlag: process.env.MY_FLAG === 'true',   // ← new
   };
   ```
2. Use in tests: `config.featureFlag`
3. Document in this SKILL.md and in the project README

### Overriding for a single run

```bash
BASE_URL=http://localhost:3001 npm test
PAYMENT_MODE=mock_success npm test
CHAOS_ENABLED=true CHAOS_SEED=42 npm test
```

### Known env flags

| Variable | Default | Purpose |
|----------|---------|---------|
| `BASE_URL` | `http://localhost:3000` | SUT base URL |
| `PAYMENT_MODE` | `disabled` | `disabled \| mock_success \| mock_fail` |
| `CHAOS_ENABLED` | `false` | Enable chaos middleware in SUT |
| `CHAOS_SEED` | random | Deterministic RNG for chaos |
| `ANTHROPIC_API_KEY` | — | Required for @rag tests |
| `KAFKA_BROKER` | — | Required for Kafka producer tests |

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| Access base URL | `config.baseUrl` | `'http://localhost:3000'` hardcoded |
| New env var | add to `config/env.ts` with default | `process.env.VAR` directly in test |
| Flag for optional feature | `process.env.FLAG === 'true'` in config | boolean env var without default |
| Run against staging | `BASE_URL=https://staging npm test` | change code to point to staging |

---

## See Also

- `config/env.ts` — the config object
- `playwright.config.ts` — Playwright-level config (workers, timeout, reporters)

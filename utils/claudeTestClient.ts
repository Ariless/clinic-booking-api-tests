import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_PROXY_PORT } from './claudeReplayProxy';

// The token ledger is CommonJS so the plain-`node` scripts in `scripts/` can read it too — the same
// arrangement as `config/models.json`; see the comment in `config/models.ts`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ledger = require('./tokenLedger') as {
  record: (entry: { model?: string; usage?: unknown; label?: string }) => unknown;
};

/**
 * Wraps `messages.create` so every call this suite makes lands in the run's token ledger.
 *
 * Patching the method rather than asking each caller to report is the point: the judge runs three
 * times per judged test and the adversarial generator once per injection test, and a reporting call
 * that a caller can forget is a ledger that quietly under-reports. A response with no `usage` — a
 * replayed cassette, say — is still recorded, as a call with zero tokens.
 */
function withLedger(client: Anthropic): Anthropic {
  const create = client.messages.create.bind(client.messages);
  client.messages.create = (async (...args: Parameters<typeof create>) => {
    const response = await create(...args);
    // Streaming returns a stream, not a message; nothing here streams, and a stream carries no
    // usage to read at this point, so it is left alone rather than counted as zero.
    if (response && typeof response === 'object' && 'usage' in response) {
      const message = response as { model?: string; usage?: unknown };
      ledger.record({
        model: message.model ?? (args[0] as { model?: string })?.model,
        usage: message.usage,
        label: 'test-suite',
      });
    }
    return response;
  }) as typeof client.messages.create;
  return client;
}

/**
 * The Anthropic client for tests that call the model directly — the LLM judge and the adversarial
 * input generator. Both used to construct their own client against the real API, which is why they
 * could only ever run with a funded key.
 *
 * Routed through the proxy when the run is recording or replaying, so those two calls are captured
 * and reproduced like every call the SUT makes. When no proxy mode is set the client is exactly what
 * it was before: the real API with the real key.
 */
export function isProxiedRun(): boolean {
    const mode = process.env.CLAUDE_PROXY_MODE;
    return mode === 'record' || mode === 'replay';
}

/** True when this run needs no funded key — replay answers from disk. */
export function isReplayRun(): boolean {
    return process.env.CLAUDE_PROXY_MODE === 'replay';
}

export function claudeTestClient(): Anthropic {
    if (!isProxiedRun()) {
        return withLedger(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
    }

    const port = process.env.CLAUDE_PROXY_PORT ?? String(DEFAULT_PROXY_PORT);
    return withLedger(new Anthropic({
        // Nothing authenticates downstream in replay — the proxy answers from a file — but an
        // explicit placeholder keeps the client off whatever ANTHROPIC_API_KEY the machine happens
        // to have. (Checked 2026-08-28: the SDK constructs fine without a key and fails at request
        // time; this is about which key is used, not about being able to build the client.)
        // Recording uses the real key.
        apiKey: process.env.ANTHROPIC_API_KEY || 'replay-mode-placeholder-key',
        baseURL: `http://127.0.0.1:${port}`,
        // A missing cassette is a 404 and a decision to make, not a blip to paper over.
        maxRetries: 0,
    }));
}

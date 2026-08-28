import { DEFAULT_PROXY_PORT, startReplayProxy, type ProxyMode } from './utils/claudeReplayProxy';

// CommonJS, so the plain-`node` scripts in `scripts/` read the same ledger — see `config/models.ts`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ledger = require('./utils/tokenLedger') as { reset: () => void };

/**
 * Brings up the Claude record/replay proxy when the run asks for one, and does nothing otherwise.
 *
 * Doing nothing is the important half: with `CLAUDE_PROXY_MODE` unset the suite behaves exactly as
 * it did before — `@rag` gated on a real key, everything else untouched. `model-drift.yml` depends
 * on that, since its whole purpose is to reach the live API.
 */
async function globalSetup(): Promise<(() => Promise<void>) | void> {
    // Before the early return below: every run reports its own spend, including the runs that use
    // no proxy at all. A ledger carried over from the previous run would bill this one for it.
    ledger.reset();

    const mode = process.env.CLAUDE_PROXY_MODE as ProxyMode | undefined;
    if (mode !== 'record' && mode !== 'replay') return;

    const port = Number(process.env.CLAUDE_PROXY_PORT ?? DEFAULT_PROXY_PORT);
    const proxy = await startReplayProxy({ mode, port });

    console.log(`[claude-proxy] ${mode} mode on ${proxy.url}`);
    if (mode === 'record') {
        console.log('[claude-proxy] recording real API calls — this run costs money');
    }

    // Playwright runs global teardown from the returned function, in this same process, so the
    // proxy object stays in scope and no global state is needed to find it again.
    return async () => {
        const { matched, recorded, missed } = proxy.stats;
        console.log(`[claude-proxy] matched ${matched} · recorded ${recorded} · missed ${missed}`);
        if (mode === 'replay' && missed > 0) {
            // Loud, because a miss becomes a 503 by the time a test sees it, and the test then
            // reports a broken endpoint rather than a stale recording.
            console.error(`[claude-proxy] ${missed} request(s) had no recording — re-record with 'npm run rag:record'`);
        }
        await proxy.close();
    };
}

export default globalSetup;

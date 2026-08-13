import 'dotenv/config';

/**
 * Optional SUT capabilities that tests can require. The SUT decides whether these are on; the test
 * process only knows what it was told, so each flag mirrors the environment variable used to start
 * the SUT. Tests gated on these use `test.skip(...)` rather than failing — a suite that goes red
 * because of how the SUT was launched teaches people to ignore red.
 */

/** Mirrors `ENABLE_DEBUG_ROUTES` on the SUT — exposes /api/v1/debug/* (development only). */
export const debugRoutesEnabled: boolean =
  ['1', 'true', 'yes', 'on'].includes(String(process.env.ENABLE_DEBUG_ROUTES).toLowerCase());

/** Mirrors `ASSERT_INVARIANTS` on the SUT — runtime invariant contract answering 500 on violation. */
export const assertInvariantsEnabled: boolean =
  ['1', 'true', 'yes', 'on'].includes(String(process.env.ASSERT_INVARIANTS).toLowerCase());

export const DEBUG_ROUTES_SKIP_MSG =
  'Requires SUT debug routes: NODE_ENV=development ENABLE_DEBUG_ROUTES=true npm run dev, then run with ENABLE_DEBUG_ROUTES=true';

export const INVARIANTS_SKIP_MSG =
  'Requires the invariant contract: NODE_ENV=development ENABLE_DEBUG_ROUTES=true ASSERT_INVARIANTS=true npm run dev, then run with both set';

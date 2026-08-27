import type { APIRequestContext } from '@playwright/test';

/** Read an in-process counter from the SUT's /metrics endpoint. */
async function readCounter(request: APIRequestContext, name: string): Promise<number> {
  const response = await request.get('/metrics');
  const body = (await response.json()) as { counters: Record<string, number> };
  return body.counters[name] ?? 0;
}

export { readCounter };

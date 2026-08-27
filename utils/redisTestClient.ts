import Redis from 'ioredis';

// Direct access to the cache from tests. Asserting through the API alone cannot distinguish
// "answered from cache" from "answered from the database with the same data" — the interesting
// failures (a stale entry, a missed invalidation, a missing TTL) are only visible from this side.
function createRedisTestClient(): Redis {
  return new Redis(process.env.REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 1 });
}

const cacheKeys = {
  doctorsAll: () => 'doctors:all',
  doctorSlots: (doctorId: number | string) => `doctors:${doctorId}:slots`,
};

export { createRedisTestClient, cacheKeys };

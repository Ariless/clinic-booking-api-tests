import { test, expect } from '../../fixtures';
import { DoctorsClient } from '../../api/DoctorsClient';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { createRedisTestClient, cacheKeys } from '../../utils/redisTestClient';
import { nextSeedSlotWindow } from '../../data/seedAccounts';
import type Redis from 'ioredis';

// To run these tests:
//   docker compose -f sut/docker-compose.redis.yml up -d --wait
//   REDIS_URL=redis://localhost:6379 npm start          (in the sut/ directory)
//   REDIS_URL=redis://localhost:6379 npx playwright test doctors.cache.test.ts
//
// The cache is read-through with a 30s TTL. What is worth testing is not the hit — it is every path
// that makes a cached answer wrong: a booking, a cancellation, a new slot, a deleted slot. A cache
// that is never invalidated still passes a "does it return 200" test.

const REDIS_CONFIGURED = Boolean(process.env.REDIS_URL);
const SKIP_MSG =
  'Requires Redis: docker compose -f sut/docker-compose.redis.yml up -d, then REDIS_URL=redis://localhost:6379 npm start';

test.describe('doctors — response cache @cache', () => {
  test.skip(!REDIS_CONFIGURED, SKIP_MSG);

  let redis: Redis;

  test.beforeAll(async () => {
    if (!REDIS_CONFIGURED) return;
    redis = createRedisTestClient();
    await redis.connect();
  });

  test.afterAll(async () => {
    if (!REDIS_CONFIGURED) return;
    await redis?.quit();
  });

  test('GET /doctors/:id/slots — first read populates the cache with a bounded TTL @cache', async ({ request, slot }) => {
    const doctors = new DoctorsClient(request);
    const key = cacheKeys.doctorSlots(slot.doctor.doctorRecordId);
    await redis.del(key);

    const { status } = await doctors.listPublicSlots(slot.doctor.doctorRecordId);
    expect(status).toBe(200);

    const cached = await redis.get(key);
    expect(cached, 'the read should have populated the cache').not.toBeNull();

    const ttl = await redis.ttl(key);
    // -1 means "no expiry": an entry that never expires turns a missed invalidation into a
    // permanently wrong answer instead of one that heals in 30 seconds
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(30);
  });

  test('GET /doctors/:id/slots — the answer really comes from the cache @cache', async ({ request, slot }) => {
    const doctors = new DoctorsClient(request);
    const key = cacheKeys.doctorSlots(slot.doctor.doctorRecordId);

    // plant a value the database could never produce; if the API returns it, the read is served
    // by the cache rather than by SQLite
    const planted = [{ id: -999, startTime: 'planted', endTime: 'planted', isAvailable: 1 }];
    await redis.set(key, JSON.stringify(planted), 'EX', 30);

    const { status, body } = await doctors.listPublicSlots(slot.doctor.doctorRecordId);
    expect(status).toBe(200);
    expect(body).toEqual(planted);

    await redis.del(key);
  });

  test('booking a slot invalidates the cached slot list @cache', async ({ request, user, slot }) => {
    const doctors = new DoctorsClient(request);
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const key = cacheKeys.doctorSlots(slot.doctor.doctorRecordId);

    const { body: before } = await doctors.listPublicSlots(slot.doctor.doctorRecordId);
    expect((before as { id: number }[]).some((s) => s.id === slot.slot.id)).toBe(true);
    expect(await redis.get(key), 'cache should be warm before the booking').not.toBeNull();

    const { status } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(status).toBe(201);

    // without invalidation the next caller is offered a slot that is already taken, and two
    // patients race for it until the TTL expires
    expect(await redis.get(key), 'booking must drop the cached slot list').toBeNull();

    const { body: after } = await doctors.listPublicSlots(slot.doctor.doctorRecordId);
    expect((after as { id: number }[]).some((s) => s.id === slot.slot.id)).toBe(false);
  });

  test('cancelling puts the slot back into the cached list @cache', async ({ request, user, slot }) => {
    const doctors = new DoctorsClient(request);
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: bookStatus, body: booking } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    // warm the cache while the slot is taken, so a stale entry would hide the cancellation
    const { body: whileTaken } = await doctors.listPublicSlots(slot.doctor.doctorRecordId);
    expect((whileTaken as { id: number }[]).some((s) => s.id === slot.slot.id)).toBe(false);

    const { status: cancelStatus } = await appointments.cancelAppointment(booking.id, patientAuth);
    expect(cancelStatus).toBe(200);

    const { body: afterCancel } = await doctors.listPublicSlots(slot.doctor.doctorRecordId);
    expect((afterCancel as { id: number }[]).some((s) => s.id === slot.slot.id)).toBe(true);
  });

  test('creating and deleting a slot invalidates the cached list @cache', async ({ request, slot }) => {
    const doctors = new DoctorsClient(request);
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };

    // warm
    await doctors.listPublicSlots(slot.doctor.doctorRecordId);

    const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
    const { status, body: created } = await doctors.createSlot(
      slot.doctor.doctorRecordId,
      seedSlotStart,
      seedSlotEnd,
      true,
      doctorAuth,
    );
    expect(status).toBe(201);

    try {
      const { body: afterCreate } = await doctors.listPublicSlots(slot.doctor.doctorRecordId);
      expect((afterCreate as { id: number }[]).some((s) => s.id === created.id)).toBe(true);

      const { status: delStatus } = await doctors.deleteSlot(created.id, doctorAuth);
      expect(delStatus).toBe(204);

      const { body: afterDelete } = await doctors.listPublicSlots(slot.doctor.doctorRecordId);
      expect((afterDelete as { id: number }[]).some((s) => s.id === created.id)).toBe(false);
    } catch (e) {
      await doctors.deleteSlot(created.id, doctorAuth).catch(() => {});
      throw e;
    }
  });

  test('the cache never answers for an unknown doctor @cache', async ({ request }) => {
    const doctors = new DoctorsClient(request);
    // a cached entry must not be able to turn a 404 into a 200 — the guards run before the lookup
    const { status } = await doctors.listPublicSlots(999999);
    expect(status).toBe(404);
    expect(await redis.get(cacheKeys.doctorSlots(999999))).toBeNull();
  });
});

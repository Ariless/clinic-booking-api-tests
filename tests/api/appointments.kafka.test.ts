import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import {
  startEventRecorder,
  ensureKafkaTopics,
  cleanupTestConsumerGroups,
  type EventRecorder,
} from '../../utils/kafkaTestConsumer';
import { nextSeedSlotWindow } from '../../data/seedAccounts';

// To run these tests:
//   docker compose -f sut/docker-compose.kafka.yml up -d --wait
//   KAFKA_BROKER=localhost:9092 npm start          (in the sut/ directory)
//   KAFKA_BROKER=localhost:9092 npx playwright test appointments.kafka.test.ts
//
// One recorder listens to every appointment topic for the whole suite and each test claims its own
// event by appointment or series id. Per-test consumers were the previous design; see the header of
// utils/kafkaTestConsumer.ts for why that failed once a real broker was involved.

const KAFKA_CONFIGURED = Boolean(process.env.KAFKA_BROKER);
const SKIP_MSG =
  'Requires Kafka: docker compose -f sut/docker-compose.kafka.yml up -d, then KAFKA_BROKER=localhost:9092 npm start';

const TOPIC = {
  booked: 'clinic.appointment.booked',
  cancelled: 'clinic.appointment.cancelled',
  confirmed: 'clinic.appointment.confirmed',
  rejected: 'clinic.appointment.rejected',
  rescheduled: 'clinic.appointment.rescheduled',
  completed: 'clinic.appointment.completed',
  recurringBooked: 'clinic.appointment.recurring_booked',
  seriesCancelled: 'clinic.appointment.series_cancelled',
} as const;

// Correlate on the request id, not on the appointment id. Appointment ids are reused: the account
// teardown of one test deletes its booking, and SQLite hands the freed rowid to the next test, so
// `appointmentId: 1` describes a different patient's record several times per run. Matching on it
// let a test claim the cancellation event emitted by the previous test's teardown.
const byRequest = (headers: Record<string, string>) => {
  const requestId = headers['x-request-id'];
  expect(requestId, 'SUT must return X-Request-Id for event correlation').toBeTruthy();
  return (payload: Record<string, unknown>) => payload.requestId === requestId;
};

test.describe('appointments — Kafka events @kafka', () => {
  test.skip(!KAFKA_CONFIGURED, SKIP_MSG);

  let events: EventRecorder;

  test.beforeAll(async () => {
    if (!KAFKA_CONFIGURED) return;
    // topics first: on a clean broker auto-creation races the subscribe and answers with an error
    await ensureKafkaTopics();
    await cleanupTestConsumerGroups();
    events = await startEventRecorder();
  });

  test.afterAll(async () => {
    if (!KAFKA_CONFIGURED) return;
    await events?.stop();
  });

  test('POST /appointments — publishes clinic.appointment.booked @smoke @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status, body, headers } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(status).toBe(201);

    const payload = await events.waitFor(TOPIC.booked, byRequest(headers));
    expect(payload.appointmentId).toBe(body.id);
    expect(payload.patientId).toBe(user.user.id);
    expect(payload.slotId).toBe(slot.slot.id);
    expect(payload.status).toBe('pending');
    expect(typeof payload.timestamp).toBe('string');
    expect(typeof payload.requestId).toBe('string');
  });

  test('PATCH /:id/cancel — publishes clinic.appointment.cancelled with cancelledBy: patient @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status, headers } = await appointments.cancelAppointment(bookBody.id, patientAuth);
    expect(status).toBe(200);

    const payload = await events.waitFor(TOPIC.cancelled, byRequest(headers));
    expect(payload.appointmentId).toBe(bookBody.id);
    expect(payload.patientId).toBe(user.user.id);
    expect(payload.cancelledBy).toBe('patient');
    expect(payload.status).toBe('cancelled');
    expect(typeof payload.timestamp).toBe('string');
    expect(typeof payload.requestId).toBe('string');
  });

  test('PATCH /:id/confirm — publishes clinic.appointment.confirmed @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status, headers } = await appointments.confirmAppointment(bookBody.id, doctorAuth);
    expect(status).toBe(200);

    const payload = await events.waitFor(TOPIC.confirmed, byRequest(headers));
    expect(payload.appointmentId).toBe(bookBody.id);
    expect(payload.patientId).toBe(user.user.id);
    expect(payload.doctorId).toBe(slot.doctor.doctorRecordId);
    expect(payload.status).toBe('confirmed');
    expect(typeof payload.timestamp).toBe('string');
    expect(typeof payload.requestId).toBe('string');
  });

  test('PATCH /:id/reject — publishes clinic.appointment.rejected @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { status, headers } = await appointments.rejectAppointment(bookBody.id, doctorAuth);
    expect(status).toBe(200);

    const payload = await events.waitFor(TOPIC.rejected, byRequest(headers));
    expect(payload.appointmentId).toBe(bookBody.id);
    expect(payload.patientId).toBe(user.user.id);
    expect(payload.doctorId).toBe(slot.doctor.doctorRecordId);
    expect(payload.status).toBe('rejected');
    expect(typeof payload.timestamp).toBe('string');
    expect(typeof payload.requestId).toBe('string');
  });

  test('PATCH /:id/reschedule — publishes clinic.appointment.rescheduled @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
    const { status: slotStatus, body: newSlot } = await doctors.createSlot(
      slot.doctor.doctorRecordId,
      seedSlotStart,
      seedSlotEnd,
      true,
      doctorAuth,
    );
    expect(slotStatus).toBe(201);

    try {
      const { status, headers } = await appointments.rescheduleAppointment(bookBody.id, newSlot.id, patientAuth);
      expect(status).toBe(200);

      const payload = await events.waitFor(TOPIC.rescheduled, byRequest(headers));
      expect(payload.appointmentId).toBe(bookBody.id);
      expect(payload.patientId).toBe(user.user.id);
      expect(payload.newSlotId).toBe(newSlot.id);
      expect(payload.status).toBe('pending');
      expect(typeof payload.timestamp).toBe('string');
      expect(typeof payload.requestId).toBe('string');
    } finally {
      await doctors.deleteSlot(newSlot.id, doctorAuth);
    }
  });

  test('PATCH /:id/complete — publishes clinic.appointment.completed @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);
    const { status: confirmStatus } = await appointments.confirmAppointment(bookBody.id, doctorAuth);
    expect(confirmStatus).toBe(200);

    const { status, headers } = await appointments.completeAppointment(bookBody.id, doctorAuth);
    expect(status).toBe(200);

    const payload = await events.waitFor(TOPIC.completed, byRequest(headers));
    expect(payload.appointmentId).toBe(bookBody.id);
    expect(payload.patientId).toBe(user.user.id);
    expect(payload.doctorId).toBe(slot.doctor.doctorRecordId);
    expect(payload.status).toBe('completed');
    expect(typeof payload.timestamp).toBe('string');
    expect(typeof payload.requestId).toBe('string');
  });

  test('POST /recurring — publishes clinic.appointment.recurring_booked @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const doctors = new DoctorsClient(request);
    const appointments = new AppointmentsClient(request);

    // second slot exactly 7 days later — same weekday and time, as the "weekly" pattern requires
    const startSlotStart = new Date(slot.seedSlotStart);
    const weekLater = new Date(startSlotStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekLaterEnd = new Date(weekLater.getTime() + 60 * 60 * 1000);

    const { status: slotStatus, body: weekSlot } = await doctors.createSlot(
      slot.doctor.doctorRecordId,
      weekLater.toISOString(),
      weekLaterEnd.toISOString(),
      true,
      doctorAuth,
    );
    expect(slotStatus).toBe(201);

    try {
      const { status, body, headers } = await appointments.bookRecurring(slot.slot.id, 'weekly', 2, patientAuth);
      expect(status).toBe(201);

      const payload = await events.waitFor(TOPIC.recurringBooked, byRequest(headers));
      expect(payload.seriesId).toBe((body as { seriesId: string }).seriesId);
      expect(payload.patientId).toBe(user.user.id);
      expect(payload.bookedCount).toBe(body.bookedCount);
      expect(Array.isArray(payload.appointmentIds)).toBe(true);
      expect((payload.appointmentIds as number[]).length).toBeGreaterThanOrEqual(1);
      expect(typeof payload.requestId).toBe('string');

      // cancel the series before dropping the slot: deleteOwnedSlotIfUnused refuses a slot that
      // still carries an active appointment, so without this the slot survives the run and later
      // tests collide with it as SLOT_OVERLAP — the doctor and the slot windows are shared
      await appointments.cancelSeries((body as { seriesId: string }).seriesId, patientAuth);
    } finally {
      await doctors.deleteSlot(weekSlot.id, doctorAuth);
    }
  });

  test('PATCH /series/:seriesId/cancel — publishes clinic.appointment.series_cancelled @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const doctors = new DoctorsClient(request);
    const appointments = new AppointmentsClient(request);

    const startSlotStart = new Date(slot.seedSlotStart);
    const weekLater = new Date(startSlotStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekLaterEnd = new Date(weekLater.getTime() + 60 * 60 * 1000);

    const { status: slotStatus, body: weekSlot } = await doctors.createSlot(
      slot.doctor.doctorRecordId,
      weekLater.toISOString(),
      weekLaterEnd.toISOString(),
      true,
      doctorAuth,
    );
    expect(slotStatus).toBe(201);

    try {
      const { status: bookStatus, body: bookBody } = await appointments.bookRecurring(slot.slot.id, 'weekly', 2, patientAuth);
      expect(bookStatus).toBe(201);
      const { seriesId } = bookBody as { seriesId: string };

      const { status, headers } = await appointments.cancelSeries(seriesId, patientAuth);
      expect(status).toBe(200);

      const payload = await events.waitFor(TOPIC.seriesCancelled, byRequest(headers));
      expect(payload.seriesId).toBe(seriesId);
      expect(payload.patientId).toBe(user.user.id);
      expect(typeof payload.cancelledCount).toBe('number');
      expect(payload.cancelledCount as number).toBeGreaterThanOrEqual(1);
      expect(typeof payload.requestId).toBe('string');
    } finally {
      await doctors.deleteSlot(weekSlot.id, doctorAuth);
    }
  });

  test('no KAFKA_BROKER — SUT starts and API calls succeed without errors @smoke @kafka', async ({ request, user, slot }) => {
    // reminder doc: without KAFKA_BROKER the SUT degrades gracefully and the API is unaffected.
    // This run has a broker, so all it can assert is that the suite itself is healthy.
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status, body } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(status).toBe(201);
    expect(body.id).toBeDefined();
  });
});

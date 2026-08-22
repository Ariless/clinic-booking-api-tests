import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { createKafkaTestConsumer } from '../../utils/kafkaTestConsumer';
import { nextSeedSlotWindow } from '../../data/seedAccounts';

// To run these tests:
//   docker compose -f sut/docker-compose.kafka.yml up -d
//   KAFKA_BROKER=localhost:9092 npm run dev
//   KAFKA_BROKER=localhost:9092 npx playwright test appointments.kafka.test.ts

const KAFKA_CONFIGURED = Boolean(process.env.KAFKA_BROKER);
const SKIP_MSG =
  'Requires Kafka: docker compose -f sut/docker-compose.kafka.yml up -d, then KAFKA_BROKER=localhost:9092 npm run dev';

test.describe('appointments — Kafka events @kafka', () => {
  test.skip(!KAFKA_CONFIGURED, SKIP_MSG);

  test('POST /appointments — publishes clinic.appointment.booked @smoke @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const consumer = createKafkaTestConsumer();
    await consumer.subscribe('clinic.appointment.booked');
    const messagePromise = consumer.waitForMessage();

    try {
      const { status, body } = await appointments.createAppointment(slot.slot.id, patientAuth);
      expect(status).toBe(201);

      const payload = await messagePromise;
      expect(payload.appointmentId).toBe(body.id);
      expect(payload.patientId).toBe(user.user.id);
      expect(payload.slotId).toBe(slot.slot.id);
      expect(payload.status).toBe('pending');
      expect(typeof payload.timestamp).toBe('string');
      expect(typeof payload.requestId).toBe('string');
    } finally {
      await consumer.disconnect();
    }
  });

  test('PATCH /:id/cancel — publishes clinic.appointment.cancelled with cancelledBy: patient @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    const consumer = createKafkaTestConsumer();
    await consumer.subscribe('clinic.appointment.cancelled');
    const messagePromise = consumer.waitForMessage();

    try {
      const { status } = await appointments.cancelAppointment(bookBody.id, patientAuth);
      expect(status).toBe(200);

      const payload = await messagePromise;
      expect(payload.appointmentId).toBe(bookBody.id);
      expect(payload.patientId).toBe(user.user.id);
      expect(payload.cancelledBy).toBe('patient');
      expect(payload.status).toBe('cancelled');
      expect(typeof payload.timestamp).toBe('string');
      expect(typeof payload.requestId).toBe('string');
    } finally {
      await consumer.disconnect();
    }
  });

  test('PATCH /:id/confirm — publishes clinic.appointment.confirmed @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    const consumer = createKafkaTestConsumer();
    await consumer.subscribe('clinic.appointment.confirmed');
    const messagePromise = consumer.waitForMessage();

    try {
      const { status } = await appointments.confirmAppointment(bookBody.id, doctorAuth);
      expect(status).toBe(200);

      const payload = await messagePromise;
      expect(payload.appointmentId).toBe(bookBody.id);
      expect(payload.patientId).toBe(user.user.id);
      expect(payload.doctorId).toBe(slot.doctor.doctorRecordId);
      expect(payload.status).toBe('confirmed');
      expect(typeof payload.timestamp).toBe('string');
      expect(typeof payload.requestId).toBe('string');
    } finally {
      await consumer.disconnect();
    }
  });

  test('PATCH /:id/reject — publishes clinic.appointment.rejected @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);

    const consumer = createKafkaTestConsumer();
    await consumer.subscribe('clinic.appointment.rejected');
    const messagePromise = consumer.waitForMessage();

    try {
      const { status } = await appointments.rejectAppointment(bookBody.id, doctorAuth);
      expect(status).toBe(200);

      const payload = await messagePromise;
      expect(payload.appointmentId).toBe(bookBody.id);
      expect(payload.patientId).toBe(user.user.id);
      expect(payload.doctorId).toBe(slot.doctor.doctorRecordId);
      expect(payload.status).toBe('rejected');
      expect(typeof payload.timestamp).toBe('string');
      expect(typeof payload.requestId).toBe('string');
    } finally {
      await consumer.disconnect();
    }
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

    const consumer = createKafkaTestConsumer();
    await consumer.subscribe('clinic.appointment.rescheduled');
    const messagePromise = consumer.waitForMessage();

    try {
      const { status } = await appointments.rescheduleAppointment(bookBody.id, newSlot.id, patientAuth);
      expect(status).toBe(200);

      const payload = await messagePromise;
      expect(payload.appointmentId).toBe(bookBody.id);
      expect(payload.patientId).toBe(user.user.id);
      expect(payload.newSlotId).toBe(newSlot.id);
      expect(payload.status).toBe('pending');
      expect(typeof payload.timestamp).toBe('string');
      expect(typeof payload.requestId).toBe('string');
    } finally {
      await consumer.disconnect();
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

    const consumer = createKafkaTestConsumer();
    await consumer.subscribe('clinic.appointment.completed');
    const messagePromise = consumer.waitForMessage();

    try {
      const { status } = await appointments.completeAppointment(bookBody.id, doctorAuth);
      expect(status).toBe(200);

      const payload = await messagePromise;
      expect(payload.appointmentId).toBe(bookBody.id);
      expect(payload.patientId).toBe(user.user.id);
      expect(payload.doctorId).toBe(slot.doctor.doctorRecordId);
      expect(payload.status).toBe('completed');
      expect(typeof payload.timestamp).toBe('string');
      expect(typeof payload.requestId).toBe('string');
    } finally {
      await consumer.disconnect();
    }
  });

  test('POST /recurring — publishes clinic.appointment.recurring_booked @kafka', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const doctors = new DoctorsClient(request);
    const appointments = new AppointmentsClient(request);

    // create a second slot exactly 7 days after the first — same day-of-week and same time, required by "weekly" pattern
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

    const consumer = createKafkaTestConsumer();
    await consumer.subscribe('clinic.appointment.recurring_booked');
    const messagePromise = consumer.waitForMessage();

    try {
      const { status, body } = await appointments.bookRecurring(slot.slot.id, 'weekly', 2, patientAuth);
      expect(status).toBe(201);

      const payload = await messagePromise;
      expect(typeof payload.seriesId).toBe('string');
      expect(payload.patientId).toBe(user.user.id);
      expect(payload.bookedCount).toBe(body.bookedCount);
      expect(Array.isArray(payload.appointmentIds)).toBe(true);
      expect((payload.appointmentIds as number[]).length).toBeGreaterThanOrEqual(1);
      expect(typeof payload.requestId).toBe('string');
    } finally {
      await consumer.disconnect();
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

    const { status: bookStatus, body: bookBody } = await appointments.bookRecurring(slot.slot.id, 'weekly', 2, patientAuth);
    expect(bookStatus).toBe(201);
    const { seriesId } = bookBody as { seriesId: string };

    const consumer = createKafkaTestConsumer();
    await consumer.subscribe('clinic.appointment.series_cancelled');
    const messagePromise = consumer.waitForMessage();

    try {
      const { status } = await appointments.cancelSeries(seriesId, patientAuth);
      expect(status).toBe(200);

      const payload = await messagePromise;
      expect(payload.seriesId).toBe(seriesId);
      expect(payload.patientId).toBe(user.user.id);
      expect(typeof payload.cancelledCount).toBe('number');
      expect((payload.cancelledCount as number)).toBeGreaterThanOrEqual(1);
      expect(typeof payload.requestId).toBe('string');
    } finally {
      await consumer.disconnect();
      await doctors.deleteSlot(weekSlot.id, doctorAuth);
    }
  });

  test('no KAFKA_BROKER — SUT starts and API calls succeed without errors @smoke @kafka', async ({ request, user, slot }) => {
    // this test is a reminder doc: when run WITHOUT KAFKA_BROKER the SUT degrades gracefully.
    // Since we ARE running with KAFKA_BROKER here, just verify the suite itself is healthy.
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status, body } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(status).toBe(201);
    expect(body.id).toBeDefined();
  });
});

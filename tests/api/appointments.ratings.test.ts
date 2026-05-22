import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { UserClient } from '../../api/UserClient';

test.describe('appointment ratings @api', () => {

  // ── Happy paths ────────────────────────────────────────────────────────────

  test('POST /appointments/:id/rate — 201 creates rating on completed appointment @smoke @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.confirmAppointment(appt.id, doctorAuth);
    await appointments.completeAppointment(appt.id, doctorAuth);

    const { status, body } = await appointments.rateAppointment(appt.id, 4, 'Great experience', patientAuth);
    expect(status).toBe(201);
    expect(body.appointmentId).toBe(appt.id);
    expect(body.patientId).toBe(user.user.id);
    expect(body.score).toBe(4);
    expect(body.comment).toBe('Great experience');
    expect(typeof body.createdAt).toBe('string');
    expect(typeof body.requestId).toBe('string');
  });

  test('GET /doctors/:id/rating — 200 returns aggregate average and count @smoke @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.confirmAppointment(appt.id, doctorAuth);
    await appointments.completeAppointment(appt.id, doctorAuth);
    await appointments.rateAppointment(appt.id, 5, undefined, patientAuth);

    const { status, body } = await doctors.getDoctorRating(slot.doctor.doctorRecordId);
    expect(status).toBe(200);
    expect(typeof body.average).toBe('number');
    expect(body.average).toBeGreaterThanOrEqual(1);
    expect(body.average).toBeLessThanOrEqual(5);
    expect(typeof body.count).toBe('number');
    expect(body.count).toBeGreaterThan(0);
  });

  // ── Error paths ────────────────────────────────────────────────────────────

  test('POST /appointments/:id/rate — 401 without token @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    const { status, body } = await appointments.rateAppointment(appt.id, 4, undefined, {});
    expect(status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  test('POST /appointments/:id/rate — 403 patient does not own appointment @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.confirmAppointment(appt.id, doctorAuth);
    await appointments.completeAppointment(appt.id, doctorAuth);

    const users = new UserClient(request);
    const { body: reg } = await users.registerPatient({ email: `test_rater_${Date.now()}@example.com`, password: 'pass123', name: 'Intruder' });
    const intruderAuth = { headers: { Authorization: `Bearer ${reg.token as string}` } };

    const { status, body } = await appointments.rateAppointment(appt.id, 5, undefined, intruderAuth);
    expect(status).toBe(403);
    expect(body.errorCode).toBe('FORBIDDEN');
  });

  test('POST /appointments/:id/rate — 400 score out of range @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    const { status, body } = await appointments.rateAppointment(appt.id, 6, undefined, patientAuth);
    expect(status).toBe(400);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  test('POST /appointments/:id/rate — 404 non-existent appointment @api', async ({ request, user }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status, body } = await appointments.rateAppointment(999999, 4, undefined, patientAuth);
    expect(status).toBe(404);
    expect(body.errorCode).toBe('APPOINTMENT_NOT_FOUND');
  });

  test('POST /appointments/:id/rate — 422 rating non-completed appointment @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.confirmAppointment(appt.id, doctorAuth);

    const { status, body } = await appointments.rateAppointment(appt.id, 4, undefined, patientAuth);
    expect(status).toBe(422);
    expect(body.errorCode).toBe('INVALID_STATUS');
  });

  test('POST /appointments/:id/rate — 409 duplicate rating rejected @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.confirmAppointment(appt.id, doctorAuth);
    await appointments.completeAppointment(appt.id, doctorAuth);
    await appointments.rateAppointment(appt.id, 4, undefined, patientAuth);

    const { status, body } = await appointments.rateAppointment(appt.id, 5, undefined, patientAuth);
    expect(status).toBe(409);
    expect(body.errorCode).toBe('DUPLICATE_RATING');
  });

  test('GET /doctors/:id/rating — 200 response does not expose individual rater identities @api @security', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);
    const doctors = new DoctorsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.confirmAppointment(appt.id, doctorAuth);
    await appointments.completeAppointment(appt.id, doctorAuth);
    await appointments.rateAppointment(appt.id, 4, 'Good', patientAuth);

    const { body } = await doctors.getDoctorRating(slot.doctor.doctorRecordId);
    expect(body.ratings).toBeUndefined();
    expect(typeof body.average).toBe('number');
    expect(typeof body.count).toBe('number');
  });
});

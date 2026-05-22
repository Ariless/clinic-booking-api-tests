import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { UserClient } from '../../api/UserClient';

test.describe('appointment notes @api', () => {

  // ── Happy paths ────────────────────────────────────────────────────────────

  test('POST /appointments/:id/notes — 201 creates note on confirmed appointment @smoke @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { status: bookStatus, body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    expect(bookStatus).toBe(201);
    await appointments.confirmAppointment(appt.id, doctorAuth);

    const { status, body } = await appointments.addNote(appt.id, 'Patient tolerated procedure well', patientAuth);
    expect(status).toBe(201);
    expect(body.appointmentId).toBe(appt.id);
    expect(body.content).toBe('Patient tolerated procedure well');
    expect(body.authorId).toBe(user.user.id);
    expect(typeof body.createdAt).toBe('string');
    expect(typeof body.requestId).toBe('string');
  });

  test('GET /appointments/:id/notes — 200 returns notes list for own appointment @smoke @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.confirmAppointment(appt.id, doctorAuth);
    await appointments.addNote(appt.id, 'First note', patientAuth);
    await appointments.addNote(appt.id, 'Second note', patientAuth);

    const { status, body } = await appointments.getNotes(appt.id, patientAuth);
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].content).toBe('First note');
    expect(body.data[1].content).toBe('Second note');
  });

  test('POST /appointments/:id/notes — 401 without token @api', async ({ request, slot, user }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    const { status, body } = await appointments.addNote(appt.id, 'note', {});
    expect(status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  test('POST /appointments/:id/notes — 403 patient does not own appointment @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);

    // second independent patient tries to add note
    const users = new UserClient(request);
    const { body: reg } = await users.registerPatient({ email: `test_intruder_${Date.now()}@example.com`, password: 'pass123', name: 'Intruder' });
    const intruderAuth = { headers: { Authorization: `Bearer ${reg.token as string}` } };

    const { status, body } = await appointments.addNote(appt.id, 'hacking', intruderAuth);
    expect(status).toBe(403);
    expect(body.errorCode).toBe('FORBIDDEN');
  });

  test('POST /appointments/:id/notes — 400 empty content @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    const { status, body } = await appointments.addNote(appt.id, '', patientAuth);
    expect(status).toBe(400);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  test('POST /appointments/:id/notes — 404 non-existent appointment @api', async ({ request, user }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status, body } = await appointments.addNote(999999, 'note', patientAuth);
    expect(status).toBe(404);
    expect(body.errorCode).toBe('APPOINTMENT_NOT_FOUND');
  });

  test('POST /appointments/:id/notes — 422 note on cancelled appointment @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.cancelAppointment(appt.id, patientAuth);

    const { status, body } = await appointments.addNote(appt.id, 'ghost note', patientAuth);
    expect(status).toBe(422);
    expect(body.errorCode).toBe('INVALID_STATUS');
  });

  test('POST /appointments/:id/notes — 400 XSS payload rejected @api @security', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.confirmAppointment(appt.id, doctorAuth);

    const { status, body } = await appointments.addNote(
      appt.id,
      '<script>alert(document.cookie)</script>',
      patientAuth,
    );
    expect(status).toBe(400);
    expect(body.errorCode).toBe('UNSAFE_CONTENT');
  });

  test('GET /appointments/:id/notes — 403 another patient cannot read private notes @api @security', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.confirmAppointment(appt.id, doctorAuth);
    await appointments.addNote(appt.id, 'private medical note', patientAuth);

    const users = new UserClient(request);
    const { body: reg } = await users.registerPatient({ email: `test_idor_${Date.now()}@example.com`, password: 'pass123', name: 'Attacker' });
    const attackerAuth = { headers: { Authorization: `Bearer ${reg.token as string}` } };

    const { status, body } = await appointments.getNotes(appt.id, attackerAuth);
    expect(status).toBe(403);
    expect(body.errorCode).toBe('FORBIDDEN');
  });
});

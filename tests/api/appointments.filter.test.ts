import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { AuthClient } from '../../api/AuthClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { seedDoctors, nextSeedSlotWindow } from '../../data/seedAccounts';

test.describe('appointment filter @api', () => {

  // ── Status filter ──────────────────────────────────────────────────────────

  test('GET /appointments/my?status=pending — 200 results contain only pending status @smoke @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);

    const { status, body } = await appointments.listMyFiltered({ status: 'pending' }, patientAuth);
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.data.every((a: Record<string, unknown>) => a.status === 'pending')).toBe(true);
    expect(body.data.some((a: Record<string, unknown>) => a.id === appt.id)).toBe(true);
  });

  test('GET /appointments/my?status=confirmed — 200 results contain only confirmed status @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const doctorAuth  = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);
    await appointments.confirmAppointment(appt.id, doctorAuth);

    const { status, body } = await appointments.listMyFiltered({ status: 'confirmed' }, patientAuth);
    expect(status).toBe(200);
    expect(body.data.every((a: Record<string, unknown>) => a.status === 'confirmed')).toBe(true);
    expect(body.data.some((a: Record<string, unknown>) => a.id === appt.id)).toBe(true);
  });

  test('GET /appointments/my?status=completed — 200 empty data when status has no match @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    await appointments.createAppointment(slot.slot.id, patientAuth);

    const { status, body } = await appointments.listMyFiltered({ status: 'completed' }, patientAuth);
    expect(status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.data).toHaveLength(0);
  });

  // ── doctorId filter ────────────────────────────────────────────────────────

  test('GET /appointments/my?doctorId=<id> — 200 returns only that doctor appointments @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt1 } = await appointments.createAppointment(slot.slot.id, patientAuth);

    const auth = new AuthClient(request);
    const doctor2 = seedDoctors[1];
    const { body: loginBody } = await auth.verifyLogin(doctor2.email, doctor2.password);
    const doctorAuth2 = { headers: { Authorization: `Bearer ${loginBody.token}` } };

    const doctors = new DoctorsClient(request);
    const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
    const { body: slot2 } = await doctors.createSlot(doctor2.doctorRecordId, seedSlotStart, seedSlotEnd, true, doctorAuth2);

    const { body: appt2 } = await appointments.createAppointment(slot2.id, patientAuth);

    try {
      const { status, body } = await appointments.listMyFiltered(
        { doctorId: String(slot.doctor.doctorRecordId) },
        patientAuth,
      );
      expect(status).toBe(200);
      const ids = body.data.map((a: Record<string, unknown>) => a.id);
      expect(ids).toContain(appt1.id);
      expect(ids).not.toContain(appt2.id);
    } finally {
      await appointments.cancelAppointment(appt2.id, patientAuth);
      await doctors.deleteSlot(slot2.id, doctorAuth2);
    }
  });

  // ── Date range filters ─────────────────────────────────────────────────────

  test('GET /appointments/my?from=<after slot start> — 200 excludes appointments before from date @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    await appointments.createAppointment(slot.slot.id, patientAuth);

    // from = 2 hours after slot start → appointment's slot is BEFORE this → excluded
    const afterSlot = new Date(new Date(slot.seedSlotStart).getTime() + 2 * 60 * 60 * 1000).toISOString();

    const { status, body } = await appointments.listMyFiltered({ from: afterSlot }, patientAuth);
    expect(status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.data).toHaveLength(0);
  });

  test('GET /appointments/my?to=<before slot start> — 200 excludes appointments after to date @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    await appointments.createAppointment(slot.slot.id, patientAuth);

    // to = 2 hours before slot start → appointment's slot is AFTER this → excluded
    const beforeSlot = new Date(new Date(slot.seedSlotStart).getTime() - 2 * 60 * 60 * 1000).toISOString();

    const { status, body } = await appointments.listMyFiltered({ to: beforeSlot }, patientAuth);
    expect(status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.data).toHaveLength(0);
  });

  // ── Combined filters ───────────────────────────────────────────────────────

  test('GET /appointments/my?status=pending&doctorId=<id> — 200 combined filters narrow results @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { body: appt } = await appointments.createAppointment(slot.slot.id, patientAuth);

    const { status, body } = await appointments.listMyFiltered(
      { status: 'pending', doctorId: String(slot.doctor.doctorRecordId) },
      patientAuth,
    );
    expect(status).toBe(200);
    expect(body.data.every((a: Record<string, unknown>) => a.status === 'pending')).toBe(true);
    expect(body.data.some((a: Record<string, unknown>) => a.id === appt.id)).toBe(true);
  });

  // ── Pagination total integrity ─────────────────────────────────────────────

  test('GET /appointments/my — 200 total reflects filtered count not overall count @api', async ({ request, user, slot }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    // appt1 stays pending
    await appointments.createAppointment(slot.slot.id, patientAuth);

    // appt2 with doctor2, confirmed
    const auth = new AuthClient(request);
    const doctor2 = seedDoctors[1];
    const { body: loginBody } = await auth.verifyLogin(doctor2.email, doctor2.password);
    const doctorAuth2 = { headers: { Authorization: `Bearer ${loginBody.token}` } };

    const doctors = new DoctorsClient(request);
    const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
    const { status: slotStatus, body: slot2 } = await doctors.createSlot(doctor2.doctorRecordId, seedSlotStart, seedSlotEnd, true, doctorAuth2);
    expect(slotStatus, `slot2 setup failed: ${JSON.stringify(slot2)}`).toBe(201);
    const { body: appt2 } = await appointments.createAppointment(slot2.id as number, patientAuth);
    await appointments.confirmAppointment(appt2.id as number, doctorAuth2);

    try {
      const { body: pendingResult } = await appointments.listMyFiltered({ status: 'pending' }, patientAuth);
      expect(pendingResult.total).toBe(1);
      expect(pendingResult.data).toHaveLength(1);

      const { body: confirmedResult } = await appointments.listMyFiltered({ status: 'confirmed' }, patientAuth);
      expect(confirmedResult.total).toBe(1);
      expect(confirmedResult.data).toHaveLength(1);
    } finally {
      await appointments.cancelAppointment(appt2.id, doctorAuth2);
      await doctors.deleteSlot(slot2.id, doctorAuth2);
    }
  });

  // ── Validation errors ──────────────────────────────────────────────────────

  test('GET /appointments/my?status=BOGUS — 400 VALIDATION_ERROR for unknown status @api', async ({ request, user }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status, body } = await appointments.listMyFiltered({ status: 'BOGUS' }, patientAuth);
    expect(status).toBe(400);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  test('GET /appointments/my?doctorId=abc — 400 VALIDATION_ERROR for non-integer doctorId @api', async ({ request, user }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status, body } = await appointments.listMyFiltered({ doctorId: 'abc' }, patientAuth);
    expect(status).toBe(400);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

  test('GET /appointments/my?from=not-a-date — 400 VALIDATION_ERROR for invalid from date @api', async ({ request, user }) => {
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const appointments = new AppointmentsClient(request);

    const { status, body } = await appointments.listMyFiltered({ from: 'not-a-date' }, patientAuth);
    expect(status).toBe(400);
    expect(body.errorCode).toBe('VALIDATION_ERROR');
  });

});

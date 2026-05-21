import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '../sut/data/clinic.db');

async function globalTeardown() {
  const db = new Database(DB_PATH);

  try {
    const testUsers = db
      .prepare("SELECT id FROM users WHERE email LIKE 'test_%@example.com'")
      .all() as { id: number }[];

    if (testUsers.length === 0) return;

    const ids = testUsers.map(u => u.id);
    const ph = ids.map(() => '?').join(',');

    db.prepare(`DELETE FROM payments WHERE patientId IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM consultations WHERE patientId IN (${ph})`).run(...ids);
    db.prepare(`
      DELETE FROM ratings WHERE appointmentId IN (
        SELECT id FROM appointments WHERE patientId IN (${ph})
      )
    `).run(...ids);
    db.prepare(`
      DELETE FROM appointment_notes WHERE appointmentId IN (
        SELECT id FROM appointments WHERE patientId IN (${ph})
      )
    `).run(...ids);

    // Free slots still held by test appointments (cancelled/completed already freed by SUT)
    db.prepare(`
      UPDATE slots SET isAvailable = 1
      WHERE id IN (
        SELECT slotId FROM appointments
        WHERE patientId IN (${ph}) AND status IN ('pending', 'confirmed')
      )
    `).run(...ids);

    db.prepare(`DELETE FROM appointments WHERE patientId IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM slot_waitlist WHERE patientId IN (${ph})`).run(...ids);
    db.prepare("DELETE FROM users WHERE email LIKE 'test_%@example.com'").run();

    // Remove orphaned test slots (future-dated, no seed patient appointments).
    // These accumulate when fixture teardowns fail silently (e.g. SLOT_IN_USE).
    // The seed data uses 2026-04-21 dates; any future slot is test-created.
    const seedCutoff = "2026-05-01T00:00:00.000Z";
    db.prepare(`
      DELETE FROM waitlist_offers WHERE slotId IN (
        SELECT id FROM slots WHERE startTime > ?
      )
    `).run(seedCutoff);
    db.prepare(`
      DELETE FROM appointments WHERE slotId IN (
        SELECT id FROM slots WHERE startTime > ?
      )
    `).run(seedCutoff);
    db.prepare("DELETE FROM slots WHERE startTime > ?").run(seedCutoff);

    // Clear doctor schedules set during tests (doctors.schedule.test.ts).
    // Seed data has no schedules; any schedule in doctor_schedules is test-created.
    db.prepare("DELETE FROM doctor_schedules").run();

    console.log(`[global-teardown] removed ${testUsers.length} orphaned test user(s)`);
  } catch (err: any) {
    // In CI the DB is owned by the Docker container (root) — host runner has no write access.
    // The DB is ephemeral there anyway, so skipping cleanup is safe.
    if (err?.code === 'SQLITE_READONLY') {
      console.log('[global-teardown] DB is readonly — skipping cleanup (CI ephemeral DB)');
      return;
    }
    throw err;
  } finally {
    db.close();
  }
}

export default globalTeardown;

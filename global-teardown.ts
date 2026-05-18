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

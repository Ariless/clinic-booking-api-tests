import path from 'path';
import Database from 'better-sqlite3';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ledger = require('./utils/tokenLedger') as {
  formatReport: () => string;
  checkBudget: () => { withinBudget: boolean; maxUsd: number; reasons: string[] };
};

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '../sut/data/clinic.db');

async function cleanupDatabase() {
  const db = new Database(DB_PATH);

  try {
    const testUsers = db
      .prepare("SELECT id FROM users WHERE email LIKE 'test_%@example.com'")
      .all() as { id: number }[];

    // Reset doctor schedules to seed state (09:00–18:00 every day for doctors 1–3).
    // Always runs — doctors.schedule.test.ts clears schedules during its run, and the
    // slotFixture also mutates them. Restore here so the next run starts clean.
    db.prepare("DELETE FROM doctor_schedules").run();
    const insertSched = db.prepare(
      "INSERT INTO doctor_schedules (doctorId, dayOfWeek, startTime, endTime) VALUES (?, ?, ?, ?)"
    );
    for (const doctorId of [1, 2, 3]) {
      for (let dow = 0; dow <= 6; dow++) {
        insertSched.run(doctorId, dow, "09:00", "18:00");
      }
    }

    if (testUsers.length === 0) {
      console.log(`[global-teardown] schedules reset; no orphaned test users`);
      return;
    }

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

    console.log(`[global-teardown] removed ${testUsers.length} orphaned test user(s)`);
  } catch (err: unknown) {
    // In CI the DB is owned by the Docker container (root) — host runner has no write access.
    // The DB is ephemeral there anyway, so skipping cleanup is safe.
    const code = (err as { code?: string } | null)?.code;
    if (code === 'SQLITE_READONLY') {
      console.log('[global-teardown] DB is readonly — skipping cleanup (CI ephemeral DB)');
      return;
    }
    throw err;
  } finally {
    db.close();
  }
}

/**
 * Runs after the whole suite: reports what the run spent on the Anthropic API, then cleans the DB.
 *
 * The report is printed before the cleanup and the budget is enforced after it, so an overspent run
 * still leaves the database in the state the next run expects — a failing gate that also corrupts
 * the fixtures would cost more than it saves. `max_tokens` caps one response; this caps the run.
 */
async function globalTeardown() {
  console.log(ledger.formatReport());
  const verdict = ledger.checkBudget();

  const overspend = verdict.withinBudget
    ? null
    : new Error(
        `[tokens] run exceeded its API budget — ${verdict.reasons.join('; ')}. ` +
          `Raise it deliberately with CLAUDE_RUN_BUDGET_USD, or see config/budget.json.`
      );

  // Not a `throw` inside `finally`: that would swallow whatever the cleanup threw, and a lost
  // SQLITE error is a worse outcome than a delayed budget failure. The cleanup runs either way;
  // its own failure wins, and the overspend is still printed before it.
  try {
    await cleanupDatabase();
  } catch (err) {
    if (overspend) console.error(overspend.message);
    throw err;
  }

  if (overspend) throw overspend;
}

export default globalTeardown;

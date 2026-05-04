const path = require("path");
const Database = require("better-sqlite3");

// DB_PATH resolves to the SUT's SQLite file.
// Default assumes test repo and SUT repo sit side by side under workspace/.
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, "../../sut/data/clinic.db");

let _db;

function db() {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true });
  }
  return _db;
}

const dbClient = {
  getSlotById(id) {
    return db().prepare("SELECT * FROM slots WHERE id = ?").get(id);
  },

  getAppointmentById(id) {
    return db().prepare("SELECT * FROM appointments WHERE id = ?").get(id);
  },

  getActiveAppointmentsForSlot(slotId) {
    return db()
      .prepare("SELECT * FROM appointments WHERE slotId = ? AND status IN ('pending', 'confirmed')")
      .all(slotId);
  },

  getWaitlistByPatient(patientId) {
    return db().prepare("SELECT * FROM slot_waitlist WHERE patientId = ?").all(patientId);
  },

  getWaitlistByDoctor(doctorId) {
    return db().prepare("SELECT * FROM slot_waitlist WHERE doctorId = ?").all(doctorId);
  },

  getConsultationById(id) {
    return db().prepare("SELECT * FROM consultations WHERE id = ?").get(id);
  },

  getConsultationsByPatient(patientId) {
    return db().prepare("SELECT * FROM consultations WHERE patientId = ?").all(patientId);
  },

  getPaymentByConsultationId(consultationId) {
    return db().prepare("SELECT * FROM payments WHERE consultationId = ?").get(consultationId);
  },

  getPaymentsByPatient(patientId) {
    return db().prepare("SELECT * FROM payments WHERE patientId = ?").all(patientId);
  },

  countPaymentsByIdempotencyKey(idempotencyKey, patientId) {
    return db()
      .prepare("SELECT COUNT(*) as count FROM payments WHERE idempotencyKey = ? AND patientId = ?")
      .get(idempotencyKey, patientId).count;
  },
};

module.exports = { dbClient };

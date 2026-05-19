import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve(__dirname, '../../sut/data/clinic.db');

interface SlotRow {
  id: number;
  doctorId: number;
  startTime: string;
  endTime: string;
  isAvailable: number;
  [key: string]: unknown;
}

interface AppointmentRow {
  id: number;
  slotId: number;
  patientId: number;
  status: string;
  createdAt: string;
  [key: string]: unknown;
}

interface WaitlistRow {
  id: number;
  patientId: number;
  doctorId: number;
  [key: string]: unknown;
}

interface ConsultationRow {
  id: number;
  patientId: number;
  [key: string]: unknown;
}

interface PaymentRow {
  id: number;
  consultationId: number;
  patientId: number;
  idempotencyKey: string;
  [key: string]: unknown;
}

interface CountRow {
  count: number;
}

interface ScheduleRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  [key: string]: unknown;
}

interface UserRow {
  id: number;
  email: string;
  role: string;
  name: string;
  deletedAt: string | null;
  [key: string]: unknown;
}

let _db: Database.Database | undefined;

function db(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true });
  }
  return _db;
}

const dbClient = {
  getSlotById(id: number): SlotRow | undefined {
    return db().prepare('SELECT * FROM slots WHERE id = ?').get(id) as SlotRow | undefined;
  },

  getAppointmentById(id: number): AppointmentRow | undefined {
    return db().prepare('SELECT * FROM appointments WHERE id = ?').get(id) as AppointmentRow | undefined;
  },

  getActiveAppointmentsForSlot(slotId: number): AppointmentRow[] {
    return db()
      .prepare("SELECT * FROM appointments WHERE slotId = ? AND status IN ('pending', 'confirmed')")
      .all(slotId) as AppointmentRow[];
  },

  getWaitlistByPatient(patientId: number): WaitlistRow[] {
    return db().prepare('SELECT * FROM slot_waitlist WHERE patientId = ?').all(patientId) as WaitlistRow[];
  },

  getWaitlistByDoctor(doctorId: number): WaitlistRow[] {
    return db().prepare('SELECT * FROM slot_waitlist WHERE doctorId = ?').all(doctorId) as WaitlistRow[];
  },

  getConsultationById(id: number): ConsultationRow | undefined {
    return db().prepare('SELECT * FROM consultations WHERE id = ?').get(id) as ConsultationRow | undefined;
  },

  getConsultationsByPatient(patientId: number): ConsultationRow[] {
    return db().prepare('SELECT * FROM consultations WHERE patientId = ?').all(patientId) as ConsultationRow[];
  },

  getPaymentByConsultationId(consultationId: number): PaymentRow | undefined {
    return db().prepare('SELECT * FROM payments WHERE consultationId = ?').get(consultationId) as PaymentRow | undefined;
  },

  getPaymentsByPatient(patientId: number): PaymentRow[] {
    return db().prepare('SELECT * FROM payments WHERE patientId = ?').all(patientId) as PaymentRow[];
  },

  countPaymentsByIdempotencyKey(idempotencyKey: string, patientId: number): number {
    const row = db()
      .prepare('SELECT COUNT(*) as count FROM payments WHERE idempotencyKey = ? AND patientId = ?')
      .get(idempotencyKey, patientId) as CountRow;
    return row.count;
  },

  getScheduleByDoctorId(doctorId: number): ScheduleRow[] {
    return db()
      .prepare('SELECT dayOfWeek, startTime, endTime FROM doctor_schedules WHERE doctorId = ? ORDER BY dayOfWeek')
      .all(doctorId) as ScheduleRow[];
  },

  // Reads user regardless of soft-delete status — for verifying deletedAt is set.
  getUserById(id: number): UserRow | undefined {
    return db().prepare('SELECT id, email, role, name, deletedAt FROM users WHERE id = ?').get(id) as UserRow | undefined;
  },
};

export { dbClient };
export type { SlotRow, AppointmentRow, WaitlistRow, ConsultationRow, PaymentRow, ScheduleRow, UserRow };

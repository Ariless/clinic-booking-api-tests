import { ajv } from '../../utils/schemaValidator';

const appointmentSchema = {
  type: 'object',
  required: ['id', 'slotId', 'patientId', 'status', 'createdAt'],
  additionalProperties: true,
  properties: {
    id:        { type: 'integer' },
    slotId:    { type: 'integer' },
    patientId: { type: 'integer' },
    status:    { type: 'string', enum: ['pending', 'confirmed', 'rejected', 'cancelled'] },
    createdAt: { type: 'string' },
  },
} as const;

const appointmentListSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'slotId', 'patientId', 'status', 'createdAt'],
    additionalProperties: true,
    properties: {
      id:        { type: 'integer' },
      slotId:    { type: 'integer' },
      patientId: { type: 'integer' },
      status:    { type: 'string' },
      createdAt: { type: 'string' },
    },
  },
} as const;

const paginatedAppointmentsSchema = {
  type: 'object',
  required: ['data', 'total', 'page', 'limit', 'totalPages'],
  additionalProperties: true,
  properties: {
    data:       { type: 'array' },
    total:      { type: 'integer', minimum: 0 },
    page:       { type: 'integer', minimum: 1 },
    limit:      { type: 'integer', minimum: 1 },
    totalPages: { type: 'integer', minimum: 0 },
  },
} as const;

const validateAppointment = ajv.compile(appointmentSchema);
const validateAppointmentList = ajv.compile(appointmentListSchema);
const validatePaginatedAppointments = ajv.compile(paginatedAppointmentsSchema);

export { validateAppointment, appointmentSchema, validateAppointmentList, validatePaginatedAppointments };

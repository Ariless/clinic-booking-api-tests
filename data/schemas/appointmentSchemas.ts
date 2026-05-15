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

const validateAppointment = ajv.compile(appointmentSchema);

export { validateAppointment, appointmentSchema };

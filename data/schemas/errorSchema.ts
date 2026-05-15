import { ajv } from '../../utils/schemaValidator';

const errorSchema = {
  type: 'object',
  required: ['errorCode', 'message', 'requestId'],
  additionalProperties: true,
  properties: {
    errorCode: { type: 'string', minLength: 1 },
    message:   { type: 'string', minLength: 1 },
    requestId: { type: 'string', minLength: 1 },
  },
} as const;

const validateError = ajv.compile(errorSchema);

export { validateError, errorSchema };

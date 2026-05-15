import { ajv } from '../../utils/schemaValidator';

const tokenResponseSchema = {
  type: 'object',
  required: ['token', 'refreshToken', 'user'],
  additionalProperties: true,
  properties: {
    token:        { type: 'string', minLength: 1 },
    refreshToken: { type: 'string', minLength: 1 },
    user: {
      type: 'object',
      required: ['id', 'email', 'role', 'name'],
      additionalProperties: true,
      properties: {
        id:    { type: 'integer' },
        email: { type: 'string', minLength: 1 },
        role:  { type: 'string', enum: ['patient', 'doctor'] },
        name:  { type: 'string', minLength: 1 },
      },
    },
  },
} as const;

const validateTokenResponse = ajv.compile(tokenResponseSchema);

export { validateTokenResponse, tokenResponseSchema };

import Ajv, { ValidateFunction } from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: true });

function assertSchema(data: unknown, validate: ValidateFunction, label = ''): void {
  const ok = validate(data);
  if (!ok) {
    throw new Error(
      `Schema validation failed${label ? ` [${label}]` : ''}:\n${JSON.stringify(validate.errors, null, 2)}`
    );
  }
}

export { ajv, assertSchema };

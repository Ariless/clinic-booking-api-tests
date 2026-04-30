const Ajv = require("ajv");

const ajv = new Ajv({ allErrors: true, strict: true });

function assertSchema(data, validate, label = "") {
  const ok = validate(data);
  if (!ok) {
    throw new Error(
      `Schema validation failed${label ? ` [${label}]` : ""}:\n${JSON.stringify(validate.errors, null, 2)}`
    );
  }
}

module.exports = { ajv, assertSchema };
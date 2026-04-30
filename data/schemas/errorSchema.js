const { ajv } = require("../../utils/schemaValidator");

const errorSchema = {
  type: "object",
  required: ["errorCode", "message", "requestId"],
  additionalProperties: true,
  properties: {
    errorCode: { type: "string", minLength: 1 },
    message:   { type: "string", minLength: 1 },
    requestId: { type: "string", minLength: 1 },
  },
};

const validateError = ajv.compile(errorSchema);

module.exports = { validateError, errorSchema };
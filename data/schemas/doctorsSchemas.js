const Ajv = require("ajv");

const ajv = new Ajv({ allErrors: true, strict: true });

const doctorsListSchema = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    required: ["id", "name", "specialty"],
    additionalProperties: true,
    properties: {
      id: { type: "integer" },
      name: { type: "string", minLength: 1 },
      specialty: { type: "string", minLength: 1 },
    },
  },
};

const validateDoctorsList = ajv.compile(doctorsListSchema);

module.exports = { validateDoctorsList, doctorsListSchema };

const { ajv } = require("../../utils/schemaValidator");

const appointmentSchema = {
  type: "object",
  required: ["id", "slotId", "patientId", "status", "createdAt"],
  additionalProperties: true,
  properties: {
    id:        { type: "integer" },
    slotId:    { type: "integer" },
    patientId: { type: "integer" },
    status:    { type: "string", enum: ["pending", "confirmed", "rejected", "cancelled"] },
    createdAt: { type: "string" },
  },
};

const validateAppointment = ajv.compile(appointmentSchema);

module.exports = { validateAppointment, appointmentSchema };
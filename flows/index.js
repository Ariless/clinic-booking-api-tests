const DoctorFlows = require("./DoctorFlows");
const AppointmentFlows = require("./AppointmentFlows");
const AuthFlows = require("./AuthFlows");

module.exports = {
    ...DoctorFlows,
    ...AppointmentFlows,
    ...AuthFlows,
};
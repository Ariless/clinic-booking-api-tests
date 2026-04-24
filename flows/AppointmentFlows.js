const { AppointmentsClient } = require("../api/AppointmentsClient");
const { authHeader } = require("../flows/utils/authHeader");

async function bookAppointment(request, slotId, patientToken) {
    const api = new AppointmentsClient(request);

    const { status, body } = await api.createAppointment(
        slotId,
        authHeader(patientToken)
    );

    if (status !== 201) throw new Error("Booking failed");

    return body;
}

async function cancelAppointment(request, appointmentId, token) {
    const api = new AppointmentsClient(request);

    const { status, body } = await api.cancelAppointment(
        appointmentId,
        authHeader(token)
    );

    return { status, body };
}

module.exports = {
    bookAppointment,
    cancelAppointment,
};
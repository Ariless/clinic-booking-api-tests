import { AppointmentsClient } from "../api/AppointmentsClient";
import { authHeader } from "./utils/authHeader";
import type { APIRequestContext } from "@playwright/test";

export async function bookAppointment(request: APIRequestContext, slotId: number, patientToken: string) {
    const api = new AppointmentsClient(request);
    const { status, body } = await api.createAppointment(slotId, authHeader(patientToken));
    if (status !== 201) throw new Error("Booking failed");
    return body;
}

export async function cancelAppointment(request: APIRequestContext, appointmentId: number, token: string) {
    const api = new AppointmentsClient(request);
    const { status, body } = await api.cancelAppointment(appointmentId, authHeader(token));
    return { status, body };
}

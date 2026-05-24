// New code: import from enums/ by area for typed constants + error codes.
// This file is kept for backward compatibility — existing tests continue to work.
const API_V1 = "/api/v1";

export const endpoints = {
    health: "/health",
    metrics: "/metrics",

    v1Meta: API_V1,
    v1ErrorTest: `${API_V1}/error-test`,

    authRegister: `${API_V1}/auth/register`,
    login: `${API_V1}/auth/login`,
    authRefresh: `${API_V1}/auth/refresh`,
    authMe: `${API_V1}/auth/me`,

    aiRecommendDoctor: `${API_V1}/ai/recommend-doctor`,

    doctors: `${API_V1}/doctors`,
    doctor: (id: number | string) => `${API_V1}/doctors/${id}`,
    doctorSlots: (id: number | string) => `${API_V1}/doctors/${id}/slots`,
    doctorsMeSlots: `${API_V1}/doctors/me/slots`,
    doctorsMeSlot: (slotId: number | string) => `${API_V1}/doctors/me/slots/${slotId}`,
    doctorSlotsCreate: (doctorRecordId: number | string) => `${API_V1}/doctors/${doctorRecordId}/slots`,
    doctorSchedule: (id: number | string) => `${API_V1}/doctors/${id}/schedule`,
    doctorsMeSchedule: `${API_V1}/doctors/me/schedule`,

    appointments: `${API_V1}/appointments`,
    appointmentsMy: `${API_V1}/appointments/my`,
    appointmentsDoctor: `${API_V1}/appointments/doctor`,
    appointmentsWaitlistJoin: `${API_V1}/appointments/waitlist`,
    appointmentsWaitlistMe: `${API_V1}/appointments/waitlist/me`,
    appointmentsWaitlistDelete: (waitlistId: number | string) => `${API_V1}/appointments/waitlist/${waitlistId}`,
    appointmentsWaitlistOffers: `${API_V1}/appointments/waitlist-offers`,
    appointmentsWaitlistOfferAccept: (offerId: number | string) => `${API_V1}/appointments/waitlist-offers/${offerId}/accept`,
    appointmentsWaitlistOfferDecline: (offerId: number | string) => `${API_V1}/appointments/waitlist-offers/${offerId}/decline`,

    appointment: (id: number | string) => `${API_V1}/appointments/${id}`,
    appointmentCancel: (id: number | string) => `${API_V1}/appointments/${id}/cancel`,
    appointmentConfirm: (id: number | string) => `${API_V1}/appointments/${id}/confirm`,
    appointmentReject: (id: number | string) => `${API_V1}/appointments/${id}/reject`,
    appointmentCancelAsDoctor: (id: number | string) => `${API_V1}/appointments/${id}/cancel-as-doctor`,
    appointmentComplete: (id: number | string) => `${API_V1}/appointments/${id}/complete`,
    appointmentReschedule: (id: number | string) => `${API_V1}/appointments/${id}/reschedule`,
    appointmentNotes: (id: number | string) => `${API_V1}/appointments/${id}/notes`,
    appointmentRate: (id: number | string) => `${API_V1}/appointments/${id}/rate`,
    doctorRating: (id: number | string) => `${API_V1}/doctors/${id}/rating`,
    appointmentsRecurring: `${API_V1}/appointments/recurring`,
    appointmentSeriesCancel: (seriesId: string) => `${API_V1}/appointments/series/${seriesId}/cancel`,

    consultations: `${API_V1}/consultations`,
    consultationsMe: `${API_V1}/consultations/me`,

    debugSimulateConcurrentBooking: `${API_V1}/debug/simulate-concurrent-booking`,
};

// Re-export area-specific constants for new tests
export { AuthEndpoints, AuthErrors }             from "../enums/auth";
export { AppointmentEndpoints, AppointmentErrors } from "../enums/appointments";
export { DoctorEndpoints, DoctorErrors }         from "../enums/doctors";
export { AiEndpoints, AiErrors, ALLOWED_SPECIALTIES } from "../enums/ai";
export { ConsultationEndpoints, ConsultationErrors } from "../enums/consultations";

const API_V1 = "/api/v1";

export const DoctorEndpoints = {
    list:           `${API_V1}/doctors`,
    byId:           (id: number | string) => `${API_V1}/doctors/${id}`,
    slots:          (id: number | string) => `${API_V1}/doctors/${id}/slots`,
    rating:         (id: number | string) => `${API_V1}/doctors/${id}/rating`,
    schedule:       (id: number | string) => `${API_V1}/doctors/${id}/schedule`,
    meSlots:        `${API_V1}/doctors/me/slots`,
    meSlot:         (slotId: number | string) => `${API_V1}/doctors/me/slots/${slotId}`,
    meSchedule:     `${API_V1}/doctors/me/schedule`,
    createSlot:     (doctorRecordId: number | string) => `${API_V1}/doctors/${doctorRecordId}/slots`,
} as const;

export const DoctorErrors = {
    DOCTOR_NOT_FOUND: "DOCTOR_NOT_FOUND",
    FORBIDDEN:        "FORBIDDEN",
    VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

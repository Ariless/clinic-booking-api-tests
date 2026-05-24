const API_V1 = "/api/v1";

export const ConsultationEndpoints = {
    list: `${API_V1}/consultations`,
    my:   `${API_V1}/consultations/me`,
} as const;

export const ConsultationErrors = {
    PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
    FORBIDDEN:        "FORBIDDEN",
    VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

const API_V1 = "/api/v1";

export const AuthEndpoints = {
    register:  `${API_V1}/auth/register`,
    login:     `${API_V1}/auth/login`,
    refresh:   `${API_V1}/auth/refresh`,
    me:        `${API_V1}/auth/me`,
} as const;

export const AuthErrors = {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    FORBIDDEN:        "FORBIDDEN",
    INTERNAL_ERROR:   "INTERNAL_ERROR",
} as const;

// Пути относительно `use.baseURL` в `playwright.config.js` (корень SUT, не только /api).
// Источник правды по контракту: SUT `API_ENDPOINTS.md`, детали — OpenAPI.
const API_V1 = "/api/v1";

const endpoints = {
  // --- вне /api/v1 (сервис / инфра) ---
  health: "/health",
  metrics: "/metrics",

  // --- метаданные API ---
  v1Meta: API_V1,
  v1ErrorTest: `${API_V1}/error-test`,

  // --- auth ---
  authRegister: `${API_V1}/auth/register`,
  // Сид-логин и прочие POST login
  login: `${API_V1}/auth/login`,
  authRefresh: `${API_V1}/auth/refresh`,
  // GET / DELETE текущего пользователя
  authMe: `${API_V1}/auth/me`,

  // --- AI ---
  aiRecommendDoctor: `${API_V1}/ai/recommend-doctor`,

  // --- doctors & slots ---
  doctors: `${API_V1}/doctors`,
  doctor: (id) => `${API_V1}/doctors/${id}`,
  // Публичные доступные слоты врача
  doctorSlots: (id) => `${API_V1}/doctors/${id}/slots`,
  // Все слоты текущего доктора (JWT)
  doctorsMeSlots: `${API_V1}/doctors/me/slots`,
  doctorsMeSlot: (slotId) => `${API_V1}/doctors/me/slots/${slotId}`,
  // POST слота под конкретным doctorRecordId (path === свой id)
  doctorSlotsCreate: (doctorRecordId) => `${API_V1}/doctors/${doctorRecordId}/slots`,

  // --- appointments ---
  // GET список (patient) = семантика /my; POST бронь { slotId }
  appointments: `${API_V1}/appointments`,
  appointmentsMy: `${API_V1}/appointments/my`,
  appointmentsDoctor: `${API_V1}/appointments/doctor`,
  appointmentsWaitlistJoin: `${API_V1}/appointments/waitlist`,
  appointmentsWaitlistMe: `${API_V1}/appointments/waitlist/me`,
  appointmentsWaitlistDelete: (waitlistId) => `${API_V1}/appointments/waitlist/${waitlistId}`,

  appointment: (id) => `${API_V1}/appointments/${id}`,
  appointmentCancel: (id) => `${API_V1}/appointments/${id}/cancel`,
  appointmentConfirm: (id) => `${API_V1}/appointments/${id}/confirm`,
  appointmentReject: (id) => `${API_V1}/appointments/${id}/reject`,
  appointmentCancelAsDoctor: (id) => `${API_V1}/appointments/${id}/cancel-as-doctor`,

  // --- debug (только dev + флаг в SUT) ---
  debugSimulateConcurrentBooking: `${API_V1}/debug/simulate-concurrent-booking`,
};

module.exports = { endpoints };

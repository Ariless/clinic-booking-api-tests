/**
 * k6 performance test — patient booking flow
 *
 * Scenario: login once → list doctors → get slots → attempt booking
 * Models a patient who authenticated and is actively browsing and booking.
 *
 * How to run:
 *   # 1. Start the SUT with rate limiters raised (login limiter fires otherwise):
 *   RATE_LIMIT_BOOKING_MAX=100000 node server.js
 *
 *   # 2. Run the load test (50 VUs, ~50s):
 *   k6 run tests/k6/booking-flow.js
 *
 *   # 3. Override base URL if SUT is not on localhost:3000:
 *   k6 run --env BASE_URL=http://localhost:3000 tests/k6/booking-flow.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const API = `${BASE_URL}/api/v1`;

// Per-endpoint latency trends — shown in the k6 summary alongside http_req_duration
const doctorsDuration = new Trend("t_doctors", true);
const slotsDuration = new Trend("t_slots", true);
const bookingDuration = new Trend("t_booking", true);

export const options = {
  stages: [
    { duration: "10s", target: 50 }, // ramp up to 50 VUs
    { duration: "30s", target: 50 }, // hold
    { duration: "10s", target: 0 },  // ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<200"],  // all requests: 95th percentile under 200ms
    http_req_failed: ["rate<0.01"],    // unexpected failures under 1%
    t_doctors: ["p(95)<100"],          // read-only — should be well under 100ms
    t_slots: ["p(95)<100"],
    t_booking: ["p(95)<500"],          // write + DB transaction, more headroom
  },
};

// Authenticate once; the JWT is shared across all VU iterations.
// This avoids hammering the login rate limiter (default: 10 / 15 min).
export function setup() {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: "patient@example.com", password: "password" }),
    { headers: { "Content-Type": "application/json" } }
  );

  if (res.status !== 200) {
    throw new Error(`setup: login failed — status ${res.status}: ${res.body}`);
  }

  return { token: res.json().token };
}

export default function (data) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.token}`,
  };

  // ── Step 1: List all doctors ───────────────────────────────────────────────
  const doctorsRes = http.get(`${API}/doctors`, { headers });
  doctorsDuration.add(doctorsRes.timings.duration);
  check(doctorsRes, { "GET /doctors → 200": (r) => r.status === 200 });
  if (doctorsRes.status !== 200) return;

  const doctors = doctorsRes.json();
  if (!Array.isArray(doctors) || doctors.length === 0) return;

  sleep(0.1);

  // ── Step 2: Get available slots for the first doctor ───────────────────────
  const doctorId = doctors[0].id;
  const slotsRes = http.get(`${API}/doctors/${doctorId}/slots`, { headers });
  slotsDuration.add(slotsRes.timings.duration);
  check(slotsRes, { "GET /slots → 200": (r) => r.status === 200 });
  if (slotsRes.status !== 200) return;

  const slots = slotsRes.json().filter((s) => s.isAvailable);
  if (slots.length === 0) return;

  sleep(0.1);

  // ── Step 3: Attempt to book a random available slot ────────────────────────
  // Under concurrent load many VUs race for the same slots.
  // 409 SLOT_TAKEN is a valid business outcome — mark it as not-failed so it
  // doesn't inflate http_req_failed and skew the error-rate threshold.
  const slotId = slots[Math.floor(Math.random() * slots.length)].id;
  const bookRes = http.post(
    `${API}/appointments`,
    JSON.stringify({ slotId }),
    {
      headers,
      responseCallback: http.expectedStatuses(201, 409),
    }
  );
  bookingDuration.add(bookRes.timings.duration);
  check(bookRes, {
    "POST /appointments → 201 or 409": (r) => r.status === 201 || r.status === 409,
  });

  sleep(0.5);
}

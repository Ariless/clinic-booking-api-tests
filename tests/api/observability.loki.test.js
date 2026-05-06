const { test, expect } = require("../../fixtures/slotFixture");
const { AppointmentsClient } = require("../../api/AppointmentsClient");

const LOKI_URL = "http://localhost:3100";
const LOKI_QUERY_URL = `${LOKI_URL}/loki/api/v1/query_range`;

// Skip guard — requires docker-compose.observability.yml running alongside the SUT.
// Start with:
//   docker-compose -f docker-compose.yml -f docker-compose.observability.yml up
// Then run: LOKI_ENABLED=true npx playwright test observability.loki.test.js
const LOKI_ENABLED = process.env.LOKI_ENABLED === "true";

async function isLokiReady() {
    try {
        const res = await fetch(`${LOKI_URL}/ready`);
        return res.ok;
    } catch {
        return false;
    }
}

async function queryLoki(requestId, startMs) {
    const startNs = (startMs * 1_000_000).toString();
    const endNs = (Date.now() * 1_000_000).toString();
    const query = `{job="clinic-api"} |= ${JSON.stringify(requestId)}`;
    const params = new URLSearchParams({ query, start: startNs, end: endNs, limit: "50" });
    const res = await fetch(`${LOKI_QUERY_URL}?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json?.data?.result ?? [];
}

async function waitForLokiLog(requestId, startMs, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const results = await queryLoki(requestId, startMs);
        if (results.length > 0) return results;
        await new Promise(r => setTimeout(r, 1500));
    }
    return [];
}

test.describe("observability — Loki log assertions", () => {
    test.skip(!LOKI_ENABLED, "Start stack with docker-compose -f docker-compose.yml -f docker-compose.observability.yml up, then: LOKI_ENABLED=true npx playwright test observability.loki.test.js");

    test.beforeAll(async () => {
        const ready = await isLokiReady();
        if (!ready) throw new Error("Loki is not reachable at http://localhost:3100 — is the observability stack running?");
    });

    test("POST /api/v1/appointments — log entry with requestId appears in Loki after booking @observability", async ({ request, user, slot }) => {
        const appts = new AppointmentsClient(request);
        const startMs = Date.now();

        const { status, response } = await appts.createAppointmentFull(slot.slot.id, {
            headers: { Authorization: `Bearer ${user.token}` },
        });
        expect(status).toBe(201);

        const requestId = response.headers()["x-request-id"];
        expect(requestId, "X-Request-Id header must be present").toBeTruthy();

        const results = await waitForLokiLog(requestId, startMs);
        expect(results.length, "at least one log stream must appear in Loki for this requestId").toBeGreaterThan(0);
    });

    test("POST /api/v1/appointments — Loki log entry has event=appointment.booked and correct patientId @observability", async ({ request, user, slot }) => {
        const appts = new AppointmentsClient(request);
        const startMs = Date.now();

        const { status, body, response } = await appts.createAppointmentFull(slot.slot.id, {
            headers: { Authorization: `Bearer ${user.token}` },
        });
        expect(status).toBe(201);

        const requestId = response.headers()["x-request-id"];
        expect(requestId).toBeTruthy();

        const results = await waitForLokiLog(requestId, startMs);
        expect(results.length).toBeGreaterThan(0);

        const logLines = results
            .flatMap(stream => stream.values.map(([, line]) => {
                try { return JSON.parse(line); } catch { return null; }
            }))
            .filter(Boolean);

        const bookingLog = logLines.find(l => l.event === "appointment.booked");
        expect(bookingLog, "log entry with event=appointment.booked must exist").toBeTruthy();
        expect(bookingLog.patientId).toBe(user.user.id);
        expect(bookingLog.appointmentId).toBe(body.id);
    });
});

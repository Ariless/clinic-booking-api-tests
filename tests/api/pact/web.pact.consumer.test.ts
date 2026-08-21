import path from 'path'
import { test, expect } from '@playwright/test'
import { PactV3, MatchersV3 } from '@pact-foundation/pact'

const { like, integer, eachLike } = MatchersV3

const provider = new PactV3({
  consumer: 'clinic-booking-api-tests',
  provider: 'clinic-booking-api',
  logLevel: 'warn',
  dir: path.resolve(__dirname, '../../../pacts'),
})

// What this file does and why:
//
// The web test suite consumes the same API as the mobile app.
// Each consumer pins only what it actually uses — if the API renames a field,
// this test fails in CI before any deployment. Playwright MCP can discover
// the current field names in a live session but cannot guard against future
// renaming. This test does. See: tests/docs/mcp-demo.md

test.describe('clinic-booking-api-tests → clinic-booking-api Pact consumer', () => {

  // ── Auth ──────────────────────────────────────────────────────────────────

  test('POST /auth/login — 200: response contains token and user.role @pact', async () => {
    // WEB-01: web test suite reads body.token for authenticated requests.
    // Compare with mobile MOB-01 — both consumers pin the same field independently.
    // If the provider renames token → accessToken, both pact files fail: two signals, one root cause.
    await provider
      .uponReceiving('a login request from the web test suite')
      .withRequest({
        method: 'POST',
        path: '/api/v1/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: {
          email: like('patient@example.com'),
          password: like('password123'),
        },
      })
      .willRespondWith({
        status: 200,
        body: {
          token: like('eyJhbGciOiJIUzI1NiJ9.test.signature'),
          user: {
            id: integer(1),
            email: like('patient@example.com'),
            role: like('patient'),
          },
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'patient@example.com', password: 'password123' }),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as Record<string, unknown>
        expect(typeof body.token).toBe('string')
        expect(body).not.toHaveProperty('accessToken')
        const user = body.user as Record<string, unknown>
        expect(typeof user.role).toBe('string')
        expect(typeof user.id).toBe('number')
      })
  })

  // ── AI endpoint ───────────────────────────────────────────────────────────

  test('POST /ai/recommend-doctor — 200: response contains recommendedSpecialty and doctors array @pact', async () => {
    // WEB-02: web suite reads recommendedSpecialty and doctors[].specialty for display.
    // If the API adds a wrapper key or renames recommendedSpecialty, the UI breaks silently.
    // This test pins the shape — renaming breaks CI, not production.
    await provider
      .uponReceiving('a POST with valid symptoms')
      .withRequest({
        method: 'POST',
        path: '/api/v1/ai/recommend-doctor',
        headers: {
          Authorization: like('Bearer consumer-test-token'),
          'Content-Type': 'application/json',
        },
        body: { symptoms: like('heart palpitations') },
      })
      .willRespondWith({
        status: 200,
        body: {
          recommendedSpecialty: like('Cardiologist'),
          reasoning: like('Based on the symptoms, a Cardiologist is recommended.'),
          doctors: eachLike({
            id: integer(1),
            name: like('John Doe'),
            specialty: like('Cardiologist'),
          }),
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/v1/ai/recommend-doctor`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer consumer-test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symptoms: 'heart palpitations' }),
        })
        expect(res.status).toBe(200)
        const body = await res.json() as Record<string, unknown>
        expect(typeof body.recommendedSpecialty).toBe('string')
        expect(typeof body.reasoning).toBe('string')
        expect(Array.isArray(body.doctors)).toBe(true)
        const first = (body.doctors as Record<string, unknown>[])[0]
        expect(typeof first.specialty).toBe('string')
      })
  })

  test('POST /ai/recommend-doctor — 400: empty symptoms return errorCode @pact', async () => {
    await provider
      .uponReceiving('a POST with empty symptoms')
      .withRequest({
        method: 'POST',
        path: '/api/v1/ai/recommend-doctor',
        headers: {
          Authorization: like('Bearer consumer-test-token'),
          'Content-Type': 'application/json',
        },
        body: { symptoms: '' },
      })
      .willRespondWith({
        status: 400,
        body: {
          errorCode: like('VALIDATION_ERROR'),
          message: like('symptoms must be a non-empty string'),
          requestId: like('req-abc123'),
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/v1/ai/recommend-doctor`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer consumer-test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symptoms: '' }),
        })
        expect(res.status).toBe(400)
        const body = await res.json() as Record<string, unknown>
        expect(typeof body.errorCode).toBe('string')
        expect(typeof body.message).toBe('string')
      })
  })

  test('POST /ai/recommend-doctor — 422: unrecognised symptoms return UNKNOWN_SPECIALTY @pact', async () => {
    // WEB-03: errorCode is machine-readable — UI maps it to a specific message.
    // If errorCode changes from UNKNOWN_SPECIALTY to UNRECOGNISED_INPUT,
    // the UI falls back to a generic error string. This test catches the rename.
    await provider
      .uponReceiving('a POST with unrecognised symptoms')
      .withRequest({
        method: 'POST',
        path: '/api/v1/ai/recommend-doctor',
        headers: {
          Authorization: like('Bearer consumer-test-token'),
          'Content-Type': 'application/json',
        },
        body: { symptoms: like('xyzzy gibberish') },
      })
      .willRespondWith({
        status: 422,
        body: {
          errorCode: like('UNKNOWN_SPECIALTY'),
          message: like('Could not map symptoms to a known specialty'),
          requestId: like('req-abc123'),
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/v1/ai/recommend-doctor`, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer consumer-test-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symptoms: 'xyzzy gibberish' }),
        })
        expect(res.status).toBe(422)
        const body = await res.json() as Record<string, unknown>
        expect(typeof body.errorCode).toBe('string')
      })
  })
})

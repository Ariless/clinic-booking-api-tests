// AI-generated test draft for tag: Waitlist
// Generated: 2026-05-26
//
// IMPORTANT: Review before committing:
//   - Check TODO comments
//   - Replace raw request calls with API client methods where they exist
//   - Wire in fixtures from ../../fixtures for user/slot setup
//   - Verify test names follow project naming convention
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

// TODO: Verify patient credentials and token endpoint
const PATIENT_EMAIL = 'patient@example.com';
const PATIENT_PASSWORD = 'password';

let patientToken: string;

test.describe('Waitlist', () => {
  test.beforeAll(async ({ playwright }) => {
    const context = await playwright.chromium.launchPersistentContext('');
    const page = context.pages()[0] ?? await context.newPage();
    // TODO: Update auth endpoint if different
    const authResponse = await page.request.post(`${BASE}/api/v1/auth/login`, {
      data: {
        email: PATIENT_EMAIL,
        password: PATIENT_PASSWORD,
      },
    });
    const authBody = await authResponse.json();
    patientToken = authBody.token;
    await context.close();
  });

  test.describe('GET /api/v1/appointments/waitlist-offers', () => {
    test('200 returns array of pending offers @api @smoke', async ({ request }) => {
      const response = await request.get(
        `${BASE}/api/v1/appointments/waitlist-offers`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body)).toBeTruthy();
      // TODO: Verify WaitlistOffer schema properties when available
    });

    test('401 not authenticated @api', async ({ request }) => {
      const response = await request.get(
        `${BASE}/api/v1/appointments/waitlist-offers`
      );

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });
  });

  test.describe('POST /api/v1/appointments/waitlist-offers/{offerId}/accept', () => {
    test('200 accept offer converts to confirmed appointment @api @smoke', async ({
      request,
    }) => {
      // TODO: Use valid offerId from test data setup
      const offerId = 1;

      const response = await request.post(
        `${BASE}/api/v1/appointments/waitlist-offers/${offerId}/accept`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('id');
      // TODO: Verify Appointment schema properties
    });

    test('400 invalid offer id @api', async ({ request }) => {
      const offerId = -1;

      const response = await request.post(
        `${BASE}/api/v1/appointments/waitlist-offers/${offerId}/accept`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });

    test('401 not authenticated @api', async ({ request }) => {
      const offerId = 1;

      const response = await request.post(
        `${BASE}/api/v1/appointments/waitlist-offers/${offerId}/accept`
      );

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });

    test('403 offer does not belong to caller @api', async ({ request }) => {
      // TODO: Use offerId from another patient
      const offerId = 999;

      const response = await request.post(
        `${BASE}/api/v1/appointments/waitlist-offers/${offerId}/accept`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });
  });

  test.describe('POST /api/v1/appointments/waitlist-offers/{offerId}/decline', () => {
    test('200 decline offer closes offer @api @smoke', async ({ request }) => {
      // TODO: Use valid offerId from test data setup
      const offerId = 1;

      const response = await request.post(
        `${BASE}/api/v1/appointments/waitlist-offers/${offerId}/decline`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('id');
      // TODO: Verify WaitlistOffer schema properties
    });

    test('400 invalid offer id @api', async ({ request }) => {
      const offerId = -1;

      const response = await request.post(
        `${BASE}/api/v1/appointments/waitlist-offers/${offerId}/decline`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });

    test('401 not authenticated @api', async ({ request }) => {
      const offerId = 1;

      const response = await request.post(
        `${BASE}/api/v1/appointments/waitlist-offers/${offerId}/decline`
      );

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });

    test('403 offer does not belong to caller @api', async ({ request }) => {
      // TODO: Use offerId from another patient
      const offerId = 999;

      const response = await request.post(
        `${BASE}/api/v1/appointments/waitlist-offers/${offerId}/decline`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });
  });

  test.describe('POST /api/v1/appointments/waitlist', () => {
    test('201 join waitlist for booked slot @api @smoke', async ({ request }) => {
      // TODO: Use valid slotId for a booked slot
      const slotId = 1;

      const response = await request.post(`${BASE}/api/v1/appointments/waitlist`, {
        headers: {
          Authorization: `Bearer ${patientToken}`,
        },
        data: {
          slotId,
        },
      });

      expect(response.status()).toBe(201);

      const body = await response.json();
      expect(body).toHaveProperty('id');
      // TODO: Verify WaitlistEntry schema properties
    });

    test('400 slot still available @api', async ({ request }) => {
      // TODO: Use valid slotId for an available slot
      const slotId = 2;

      const response = await request.post(`${BASE}/api/v1/appointments/waitlist`, {
        headers: {
          Authorization: `Bearer ${patientToken}`,
        },
        data: {
          slotId,
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
      expect(body.errorCode).toBe('SLOT_STILL_AVAILABLE');
    });

    test('401 missing or invalid token @api', async ({ request }) => {
      const slotId = 1;

      const response = await request.post(`${BASE}/api/v1/appointments/waitlist`, {
        data: {
          slotId,
        },
      });

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });

    test('403 not a patient @api', async ({ request }) => {
      // TODO: Use non-patient token (e.g., provider/admin)
      const nonPatientToken = 'non-patient-token';
      const slotId = 1;

      const response = await request.post(`${BASE}/api/v1/appointments/waitlist`, {
        headers: {
          Authorization: `Bearer ${nonPatientToken}`,
        },
        data: {
          slotId,
        },
      });

      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });

    test('404 slot or patient not found @api', async ({ request }) => {
      const slotId = 999999;

      const response = await request.post(`${BASE}/api/v1/appointments/waitlist`, {
        headers: {
          Authorization: `Bearer ${patientToken}`,
        },
        data: {
          slotId,
        },
      });

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });

    test('409 already on waitlist @api', async ({ request }) => {
      // TODO: Use slotId where patient is already on waitlist
      const slotId = 1;

      const response = await request.post(`${BASE}/api/v1/appointments/waitlist`, {
        headers: {
          Authorization: `Bearer ${patientToken}`,
        },
        data: {
          slotId,
        },
      });

      expect(response.status()).toBe(409);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
      expect(body.errorCode).toBe('WAITLIST_DUPLICATE');
    });
  });

  test.describe('GET /api/v1/appointments/waitlist/me', () => {
    test('200 returns list of caller waitlist rows @api @smoke', async ({
      request,
    }) => {
      const response = await request.get(
        `${BASE}/api/v1/appointments/waitlist/me`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(Array.isArray(body)).toBeTruthy();
      // TODO: Verify WaitlistEntryWithSlot schema properties when available
    });

    test('401 missing or invalid token @api', async ({ request }) => {
      const response = await request.get(
        `${BASE}/api/v1/appointments/waitlist/me`
      );

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });

    test('403 not a patient @api', async ({ request }) => {
      // TODO: Use non-patient token
      const nonPatientToken = 'non-patient-token';

      const response = await request.get(
        `${BASE}/api/v1/appointments/waitlist/me`,
        {
          headers: {
            Authorization: `Bearer ${nonPatientToken}`,
          },
        }
      );

      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });
  });

  test.describe('DELETE /api/v1/appointments/waitlist/{waitlistId}', () => {
    test('200 remove own waitlist entry @api @smoke', async ({ request }) => {
      // TODO: Use valid waitlistId from test data setup
      const waitlistId = 1;

      const response = await request.delete(
        `${BASE}/api/v1/appointments/waitlist/${waitlistId}`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);
    });

    test('401 not authenticated @api', async ({ request }) => {
      const waitlistId = 1;

      const response = await request.delete(
        `${BASE}/api/v1/appointments/waitlist/${waitlistId}`
      );

      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });

    test('403 waitlist entry does not belong to caller @api', async ({
      request,
    }) => {
      // TODO: Use waitlistId from another patient
      const waitlistId = 999;

      const response = await request.delete(
        `${BASE}/api/v1/appointments/waitlist/${waitlistId}`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.status()).toBe(403);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });

    test('404 waitlist entry not found @api', async ({ request }) => {
      const waitlistId = 999999;

      const response = await request.delete(
        `${BASE}/api/v1/appointments/waitlist/${waitlistId}`,
        {
          headers: {
            Authorization: `Bearer ${patientToken}`,
          },
        }
      );

      expect(response.status()).toBe(404);

      const body = await response.json();
      expect(body).toHaveProperty('errorCode');
    });
  });
});

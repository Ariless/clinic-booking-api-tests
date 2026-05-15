import { test, expect } from '../../fixtures';
import { ConsultationsClient } from '../../api/ConsultationsClient';
import { dbClient } from '../../utils/dbClient';

const PAYMENT_MODE = process.env.PAYMENT_MODE || 'disabled';
const paymentEnabled = PAYMENT_MODE !== 'disabled';

test("POST /api/v1/consultations — 503 FEATURE_DISABLED when PAYMENT_MODE=disabled @payment", async ({ request, user }) => {
    const consultations = new ConsultationsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status, body } = await consultations.createConsultation(1, "tok_visa", patientAuth);

    expect(status).toBe(503);
    expect(body.errorCode).toBe("FEATURE_DISABLED");
    expect(body.requestId).toBeTruthy();
});

test.describe("consultations — payment mock_success @payment", () => {
    test.skip(
        PAYMENT_MODE !== "mock_success",
        "Restart SUT with PAYMENT_MODE=mock_success npm run dev, then: PAYMENT_MODE=mock_success npx playwright test consultations.payment.test.ts"
    );

    test("POST /api/v1/consultations — 201 consultation and payment created @payment", async ({ request, user }) => {
        const consultations = new ConsultationsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

        const { status, body } = await consultations.createConsultation(1, "tok_visa", patientAuth);

        expect(status).toBe(201);
        expect(body.consultation.status).toBe("confirmed");
        expect(body.consultation.patientId).toBe(user.user.id);
        expect(body.consultation.doctorId).toBe(1);
        expect(body.payment.status).toBe("succeeded");
        expect(body.payment.amount).toBe(5000);

        const dbConsultation = dbClient.getConsultationById(body.consultation.id);
        expect(dbConsultation, "DB: consultation must exist").toBeTruthy();
        expect(dbConsultation!.patientId, "DB: patientId must match").toBe(user.user.id);
        expect(dbConsultation!.status, "DB: status must be confirmed").toBe("confirmed");

        const dbPayment = dbClient.getPaymentByConsultationId(body.consultation.id);
        expect(dbPayment, "DB: payment must exist").toBeTruthy();
        expect(dbPayment!.status, "DB: payment status must be succeeded").toBe("succeeded");
        expect(dbPayment!.consultationId, "DB: payment linked to consultation").toBe(body.consultation.id);
    });

    test("GET /api/v1/consultations/me — 200 returns created consultation @payment", async ({ request, user }) => {
        const consultations = new ConsultationsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

        const { body: created } = await consultations.createConsultation(1, "tok_visa", patientAuth);

        const { status, body } = await consultations.listMy(patientAuth);

        expect(status).toBe(200);
        expect(Array.isArray(body)).toBeTruthy();
        const found = body.find((c: { id: number }) => c.id === created.consultation.id);
        expect(found, "created consultation must appear in list").toBeTruthy();
        expect(found.status).toBe("confirmed");
    });

    test("POST /api/v1/consultations — 404 DOCTOR_NOT_FOUND for non-existent doctorId @payment", async ({ request, user }) => {
        const consultations = new ConsultationsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

        const { status, body } = await consultations.createConsultation(99999, "tok_visa", patientAuth);

        expect(status).toBe(404);
        expect(body.errorCode).toBe("DOCTOR_NOT_FOUND");
        expect(body.requestId).toBeTruthy();
    });
});

test.describe("consultations — payment mock_fail @payment", () => {
    test.skip(
        PAYMENT_MODE !== "mock_fail",
        "Restart SUT with PAYMENT_MODE=mock_fail npm run dev, then: PAYMENT_MODE=mock_fail npx playwright test consultations.payment.test.ts"
    );

    test("POST /api/v1/consultations — 402 PAYMENT_REQUIRED when card declined @payment", async ({ request, user }) => {
        const consultations = new ConsultationsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

        const { status, body } = await consultations.createConsultation(1, "tok_fail", patientAuth);

        expect(status).toBe(402);
        expect(body.errorCode).toBe("PAYMENT_REQUIRED");
        expect(body.requestId).toBeTruthy();

        const dbConsultations = dbClient.getConsultationsByPatient(user.user.id);
        expect(dbConsultations.length, "DB: no consultation must be created on failed payment").toBe(0);

        const dbPayments = dbClient.getPaymentsByPatient(user.user.id);
        expect(dbPayments.length, "DB: failed payment record must exist").toBe(1);
        expect(dbPayments[0].status, "DB: payment status must be failed").toBe("failed");
        expect(dbPayments[0].consultationId, "DB: consultationId must be null").toBeNull();
    });
});

test.describe("consultations — idempotency @payment", () => {
    test.skip(
        PAYMENT_MODE !== "mock_success",
        "Restart SUT with PAYMENT_MODE=mock_success npm run dev, then: PAYMENT_MODE=mock_success npx playwright test consultations.payment.test.ts"
    );

    test("POST /api/v1/consultations — same X-Idempotency-Key twice returns same consultation, one payment @payment", async ({ request, user }) => {
        const consultations = new ConsultationsClient(request);
        const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
        const idempotencyKey = crypto.randomUUID();

        const { status: status1, body: body1 } = await consultations.createConsultation(1, "tok_visa", {
            ...patientAuth,
            idempotencyKey,
        });
        expect(status1).toBe(201);

        const { status: status2, body: body2 } = await consultations.createConsultation(1, "tok_visa", {
            ...patientAuth,
            idempotencyKey,
        });
        expect(status2).toBe(200);
        expect(body2.consultation.id, "replay must return the same consultationId").toBe(body1.consultation.id);

        const paymentCount = dbClient.countPaymentsByIdempotencyKey(idempotencyKey, user.user.id);
        expect(paymentCount, "DB: exactly one payment must exist for this idempotency key").toBe(1);
    });
});

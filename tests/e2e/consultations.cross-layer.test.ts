import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { ConsultationsPage } from "../../pages/ConsultationsPage";
import { ConsultationsClient } from "../../api/ConsultationsClient";
import { seedDoctors } from "../../data/seedAccounts";
import { dbClient } from "../../utils/dbClient";

const PAYMENT_ENABLED = process.env.PAYMENT_MODE === "mock_success";

test.skip(!PAYMENT_ENABLED, "Restart SUT with PAYMENT_MODE=mock_success to run this test");

test("patient books consultation via UI — consultation appears in API @e2e", async ({ request, page, user }) => {
    const doctor = seedDoctors[0];

    // 1. LOGIN via UI
    const loginPage = new LoginPage(page);
    await loginPage.login(user.email, user.password);

    // 2. OPEN consultations page
    const consultationsPage = new ConsultationsPage(page);
    await consultationsPage.open();

    // 3. WAIT for doctor list to load, then book
    await expect(consultationsPage.doctorSelect).toBeEnabled();
    await consultationsPage.bookConsultation(doctor.doctorRecordId, "mock_success");

    // 4. ASSERT success banner
    await expect(consultationsPage.bannerSuccess).toBeVisible();
    await expect(consultationsPage.bannerSuccess).toContainText("$50");

    // 5. ASSERT consultation appears in the page list
    await expect(consultationsPage.consultList.locator("[data-qa='patient-consult-item']").first()).toBeVisible();

    // 6. VERIFY cross-layer — consultation exists in API
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
    const consultations = new ConsultationsClient(request);
    const { status, body } = await consultations.listMy(patientAuth);
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].doctorId).toBe(doctor.doctorRecordId);

    // 7. VERIFY DB — consultation and payment records persisted correctly
    const dbConsultations = dbClient.getConsultationsByPatient(user.user.id);
    expect(dbConsultations.length, "DB: consultation record must exist").toBeGreaterThan(0);
    const dbConsult = dbConsultations[0];
    expect(dbConsult.doctorId, "DB: consultation must reference correct doctor").toBe(doctor.doctorRecordId);

    const dbPayment = dbClient.getPaymentByConsultationId(dbConsult.id);
    expect(dbPayment, "DB: payment record must exist").toBeDefined();
    expect(dbPayment!.status, "DB: payment must be succeeded").toBe("succeeded");
});

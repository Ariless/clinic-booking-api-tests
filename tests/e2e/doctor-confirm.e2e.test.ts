import { test, expect } from "../../fixtures";
import { LoginPage } from "../../pages/LoginPage";
import { DoctorAppointmentsPage } from "../../pages/DoctorAppointmentsPage";
import { AppointmentsClient } from "../../api/AppointmentsClient";
import { seedDoctors } from "../../data/seedAccounts";
import { dbClient } from "../../utils/dbClient";

test("doctor confirms via UI — appointment confirmed in API @e2e", async ({ request, page, user, slot }) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

    // 1. BOOK via API
    const { status: bookStatus, body: bookBody } = await appointments.createAppointment(slotBody.id, patientAuth);
    expect(bookStatus).toBe(201);

    // 2. LOGIN via UI as doctor
    const doctor = seedDoctors[0];
    const loginPage = new LoginPage(page);
    await loginPage.login(doctor.email, doctor.password);

    // 3. OPEN doctor appointments page
    const doctorPage = new DoctorAppointmentsPage(page);
    await doctorPage.open();

    // 4. ACCEPT confirm dialog and click the button for this appointment
    page.on("dialog", (dialog) => dialog.accept());
    await doctorPage.confirmButton(bookBody.id).click();

    // 5. ASSERT success banner
    await expect(doctorPage.bannerSuccess).toBeVisible();
    await expect(doctorPage.bannerSuccess).toHaveText("Visit confirmed for the patient.");

    // 6. VERIFY cross-layer — patient sees confirmed status via API
    const { status: myStatus, body: myBody } = await appointments.listMy(patientAuth);
    expect(myStatus).toBe(200);
    const confirmed = myBody.find((a: { id: number; status: string }) => a.id === bookBody.id);
    expect(confirmed?.status).toBe("confirmed");

    // 7. VERIFY DB — appointment status persisted correctly
    const dbAppt = dbClient.getAppointmentById(bookBody.id);
    expect(dbAppt!.status, "DB: appointment must be confirmed").toBe("confirmed");
});

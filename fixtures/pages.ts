// Extends the twoUsersFixture end of the chain (userFixture → slotFixture →
// twoUsersFixture) so a single `test` import gives tests both data fixtures
// (user, slot, user2) and page objects. Fixtures are lazy — nothing is created
// unless a test destructures it.
import { test as base } from "./twoUsersFixture";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPatientPage";
import { BookingPage } from "../pages/BookingPage";
import { AppointmentsPage } from "../pages/AppointmentsPage";
import { ConsultationsPage } from "../pages/ConsultationsPage";
import { PatientNotificationsPage } from "../pages/PatientNotificationsPage";
import { DoctorAppointmentsPage } from "../pages/DoctorAppointmentsPage";

type Pages = {
    loginPage: LoginPage;
    registerPage: RegisterPage;
    bookingPage: BookingPage;
    appointmentsPage: AppointmentsPage;
    consultationsPage: ConsultationsPage;
    notificationsPage: PatientNotificationsPage;
    doctorAppointmentsPage: DoctorAppointmentsPage;
};

export const test = base.extend<Pages>({
    loginPage: async ({ page }, use) => use(new LoginPage(page)),
    registerPage: async ({ page }, use) => use(new RegisterPage(page)),
    bookingPage: async ({ page }, use) => use(new BookingPage(page)),
    appointmentsPage: async ({ page }, use) => use(new AppointmentsPage(page)),
    consultationsPage: async ({ page }, use) => use(new ConsultationsPage(page)),
    notificationsPage: async ({ page }, use) => use(new PatientNotificationsPage(page)),
    doctorAppointmentsPage: async ({ page }, use) => use(new DoctorAppointmentsPage(page)),
});

export { expect } from "@playwright/test";
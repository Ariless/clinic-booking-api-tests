import { test as base } from "./userFixture";
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
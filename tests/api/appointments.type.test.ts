import { test, expect } from "../../fixtures";
import { AppointmentsClient } from "../../api/AppointmentsClient";
import { DoctorsClient } from "../../api/DoctorsClient";

test.describe("POST /appointments — appointment type @api", () => {

    test("POST /appointments — 201 no type defaults to consultation @smoke @api",
        async ({ request, slot, user }) => {
            const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
            const appointments = new AppointmentsClient(request);

            const { status, body } = await appointments.createAppointment(slot.slot.id, patientAuth);

            expect(status).toBe(201);
            expect(body.type).toBe("consultation");
        },
    );

    test("POST /appointments — 201 explicit type consultation @smoke @api",
        async ({ request, slot, user }) => {
            const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
            const appointments = new AppointmentsClient(request);

            const { status, body } = await appointments.createAppointment(
                slot.slot.id,
                { ...patientAuth, type: "consultation" },
            );

            expect(status).toBe(201);
            expect(body.type).toBe("consultation");
        },
    );

    test("POST /appointments — 201 type procedure, slot 60min @smoke @api",
        async ({ request, slot, user }) => {
            const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
            const appointments = new AppointmentsClient(request);

            const { status, body } = await appointments.createAppointment(
                slot.slot.id,
                { ...patientAuth, type: "procedure" },
            );

            expect(status).toBe(201);
            expect(body.type).toBe("procedure");
        },
    );

    test("POST /appointments — 400 VALIDATION_ERROR invalid type @api",
        async ({ request, slot, user }) => {
            const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
            const appointments = new AppointmentsClient(request);

            const { status, body } = await appointments.createAppointment(
                slot.slot.id,
                { ...patientAuth, type: "checkup" },
            );

            expect(status).toBe(400);
            expect(body.errorCode).toBe("VALIDATION_ERROR");
        },
    );

    test("POST /appointments — 401 without token @api",
        async ({ request, slot }) => {
            const appointments = new AppointmentsClient(request);
            const { status } = await appointments.createAppointment(slot.slot.id, { type: "consultation" });
            expect(status).toBe(401);
        },
    );

    // B-14: procedure into a short slot — should fail SLOT_TOO_SHORT but check is not implemented
    test.fail(
        "POST /appointments — [B-14] 422 SLOT_TOO_SHORT procedure into 15min slot @api",
        async ({ request, slot, user }) => {
            const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };
            const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
            const appointments = new AppointmentsClient(request);
            const doctors = new DoctorsClient(request);

            // Create a 15-minute slot — too short for a procedure (60min required)
            const start = new Date(Date.now() + 49 * 60 * 60 * 1000);
            const end = new Date(start.getTime() + 15 * 60 * 1000);
            const { body: shortSlot } = await doctors.createSlot(
                slot.doctor.doctorRecordId,
                start.toISOString(),
                end.toISOString(),
                true,
                doctorAuth,
            );

            try {
                const { status, body } = await appointments.createAppointment(
                    shortSlot.id as number,
                    { ...patientAuth, type: "procedure" },
                );
                expect(status).toBe(422);
                expect(body.errorCode).toBe("SLOT_TOO_SHORT");
            } finally {
                await doctors.deleteSlot(shortSlot.id as number, doctorAuth);
            }
        },
    );

});

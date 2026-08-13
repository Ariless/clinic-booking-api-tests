import { test, expect } from '../../fixtures';
import { AppointmentsClient } from '../../api/AppointmentsClient';
import { DebugClient } from '../../api/DebugClient';
import { dbClient } from '../../utils/dbClient';
import { assertInvariantsEnabled, debugRoutesEnabled, INVARIANTS_SKIP_MSG } from '../../config/sutCapabilities';

/**
 * The SUT's runtime invariant contract (`src/invariants.js`, enabled by ASSERT_INVARIANTS) is an
 * oracle that does not depend on any test having thought of a case. An oracle nobody has seen fail
 * is indistinguishable from one that never fires, so these tests break state on purpose.
 *
 * Requires the SUT to run with NODE_ENV=development ENABLE_DEBUG_ROUTES=true ASSERT_INVARIANTS=true.
 */

test.skip(!(assertInvariantsEnabled && debugRoutesEnabled), INVARIANTS_SKIP_MSG);

test("POST /debug/break-invariant — 500 INVARIANT_VIOLATED when a booked slot is put back on sale @api", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const debug = new DebugClient(request);
    const auth = { headers: { Authorization: `Bearer ${user.token}` } };

    const { status: bookStatus } = await appointments.createAppointment(slotBody.id, auth);
    expect(bookStatus).toBe(201);

    try {
        const { status, body } = await debug.breakInvariant(slotBody.id, 'break');

        expect(status, "desynced state must not be answered with a success").toBe(500);
        expect(body.errorCode).toBe("INVARIANT_VIOLATED");
        expect(
            body.violations.map((v: { invariant: string }) => v.invariant),
            "the response must name which rule broke",
        ).toContain("INV-1 active-appointment-implies-slot-taken");
    } finally {
        const { status: repairStatus } = await debug.breakInvariant(slotBody.id, 'repair');
        expect(repairStatus, "repair must leave the system consistent again").toBe(200);
    }
});

test("POST /debug/break-invariant — 200 once state is consistent again @api", async ({ request, user, slot }) => {
    const { slot: slotBody } = slot;
    const appointments = new AppointmentsClient(request);
    const debug = new DebugClient(request);
    const auth = { headers: { Authorization: `Bearer ${user.token}` } };

    await appointments.createAppointment(slotBody.id, auth);
    await debug.breakInvariant(slotBody.id, 'break');

    const { status } = await debug.breakInvariant(slotBody.id, 'repair');
    expect(status).toBe(200);
    expect(dbClient.getSlotById(slotBody.id)!.isAvailable, "booked slot is off sale again").toBe(0);
});

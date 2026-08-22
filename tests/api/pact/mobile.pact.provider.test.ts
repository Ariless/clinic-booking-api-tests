import path from 'path';
import fs from 'fs';
import { Verifier } from '@pact-foundation/pact';
import { test, expect } from '../../../fixtures/slotFixture';
import { DoctorsClient } from '../../../api/DoctorsClient';
import { AppointmentsClient } from '../../../api/AppointmentsClient';
import { nextSeedSlotWindow } from '../../../data/seedAccounts';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// The contract is produced by clinic-mobile-tests (`npm run test:pact` there) and copied into this
// repository, the way a provider receives a pact when there is no broker.
// Until 2026-08-22 nothing read it: the consumer side ran green in mobile CI, the file was checked
// in with the comment "for provider verification", and no verification existed — so `token` vs
// `accessToken` (MOB-01), the rename this contract was written to catch, was unguarded here.
const PACT_FILE = path.resolve(__dirname, '../../../pacts/clinic-mobile-clinic-booking-api.json');

// Where the consumer repository keeps the original. Used only to detect that the copy went stale;
// absent (CI checks out this repository alone) means the comparison is skipped, not the verification.
const MOBILE_TESTS_ROOT = process.env.MOBILE_TESTS_ROOT
    ? path.resolve(process.env.MOBILE_TESTS_ROOT)
    : path.resolve(__dirname, '../../../../clinic-mobile-tests');
const SOURCE_PACT_FILE = path.join(MOBILE_TESTS_ROOT, 'pacts/clinic-mobile-clinic-booking-api.json');

/**
 * The pact pins shapes, not rows: every value in it is a type matcher, but the ids in the paths and
 * in the booking body are literal, because the consumer wrote no provider states. A real doctor, a
 * bookable slot and an owned appointment therefore have to stand in for the literal 1, and the token
 * has to be a live one. That substitution is what a `given(...)` state handler would do — it touches
 * identifiers only, never the field names, types or status codes the contract exists to guard.
 */
type ProviderState = {
    token: string;
    email: string;
    password: string;
    doctorRecordId: number;
    bookableSlotId: number;
    appointmentId: number;
};

function replaceBody(req: { body: unknown; headers: Record<string, string> }, body: unknown) {
    req.body = body;
    // The proxy re-serialises req.body (see @pact-foundation/pact parseBody) but forwards the
    // original headers — a stale content-length truncates or hangs the request.
    req.headers['content-length'] = String(Buffer.byteLength(JSON.stringify(body)));
}

function buildRequestFilter(state: ProviderState) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (req: any, _res: any, next: any) => {
        req.headers['authorization'] = `Bearer ${state.token}`;

        if (req.url.startsWith('/api/v1/doctors/1/slots')) {
            req.url = req.url.replace('/doctors/1/slots', `/doctors/${state.doctorRecordId}/slots`);
        }
        if (req.url.startsWith('/api/v1/appointments/1/cancel')) {
            req.url = req.url.replace('/appointments/1/cancel', `/appointments/${state.appointmentId}/cancel`);
        }

        const isJsonObject = req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body);

        // The cancel interaction sends `{}`. parseBody returns an empty buffer for it while the
        // original content-length of 2 survives, so the provider waits for two bytes that never
        // arrive and the interaction dies on the 30 s socket timeout.
        if (isJsonObject && Object.keys(req.body).length === 0) {
            req.headers['content-length'] = '0';
        }

        if (req.method === 'POST' && req.url === '/api/v1/appointments' && isJsonObject) {
            replaceBody(req, { ...req.body, slotId: state.bookableSlotId });
        }

        // The 401 interaction sends 'wrong-password' on purpose — the only one whose expected
        // outcome depends on the credentials being invalid, so it is left untouched.
        if (
            req.method === 'POST' &&
            req.url === '/api/v1/auth/login' &&
            isJsonObject &&
            req.body.password !== 'wrong-password'
        ) {
            replaceBody(req, { email: state.email, password: state.password });
        }

        next();
    };
}

/** One interaction per test: a known mismatch in one of them must not hide a regression in the rest. */
async function verifyInteraction(description: string, state: ProviderState) {
    process.env.PACT_DESCRIPTION = description;
    try {
        await new Verifier({
            provider: 'clinic-booking-api',
            providerBaseUrl: BASE_URL,
            pactUrls: [PACT_FILE],
            logLevel: 'warn',
            requestFilter: buildRequestFilter(state),
        }).verifyProvider();
    } finally {
        delete process.env.PACT_DESCRIPTION;
    }
}

type PactInteraction = { description: string };

/** Interactions only — pact-js stamps its own version into `metadata`, which differs per machine. */
function interactionsOf(file: string): string {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as { interactions: PactInteraction[] };
    const sorted = [...doc.interactions].sort((a, b) => a.description.localeCompare(b.description));
    return JSON.stringify(sorted);
}

test.describe('clinic-booking-api — clinic-mobile Pact provider @pact', () => {
    test('the copied pact still matches the one the consumer publishes @pact', () => {
        expect(fs.existsSync(PACT_FILE), `pact file missing: ${PACT_FILE}`).toBe(true);

        test.skip(
            !fs.existsSync(SOURCE_PACT_FILE),
            `clinic-mobile-tests not checked out next to this repository (looked in ${MOBILE_TESTS_ROOT}); ` +
                'the copy in pacts/ cannot be compared, verification below still runs',
        );

        expect(
            interactionsOf(PACT_FILE),
            `${path.basename(PACT_FILE)} is stale — re-copy it from ${SOURCE_PACT_FILE} ` +
                '(the consumer regenerates it with `npm run test:pact` in clinic-mobile-tests)',
        ).toBe(interactionsOf(SOURCE_PACT_FILE));
    });

    test.describe('interactions', () => {
        // A proxied HTTP round trip per interaction, plus fixture setup — past the 30 s default.
        test.setTimeout(120_000);

        let state: ProviderState;

        test.beforeEach(async ({ request, user, slot }) => {
            const doctors = new DoctorsClient(request);
            const appointments = new AppointmentsClient(request);
            const doctorAuth = { headers: { Authorization: `Bearer ${slot.doctorToken}` } };
            const patientAuth = { headers: { Authorization: `Bearer ${user.token}` } };

            // `slot` stays free for the booking interaction, so the appointment that the cancel and
            // my-appointments interactions need gets a second slot of its own.
            const { seedSlotStart, seedSlotEnd } = nextSeedSlotWindow();
            const { status: slotStatus, body: ownedSlot } = await doctors.createSlot(
                slot.doctor.doctorRecordId,
                seedSlotStart,
                seedSlotEnd,
                true,
                doctorAuth,
            );
            expect(slotStatus, `second slot not created: ${JSON.stringify(ownedSlot)}`).toBe(201);

            const { status: bookStatus, body: appointment } = await appointments.createAppointment(
                ownedSlot.id as number,
                patientAuth,
            );
            expect(bookStatus, `appointment not booked: ${JSON.stringify(appointment)}`).toBe(201);

            state = {
                token: user.token,
                email: user.email,
                password: user.password,
                doctorRecordId: slot.doctor.doctorRecordId,
                bookableSlotId: slot.slot.id,
                appointmentId: appointment.id as number,
            };

            // Teardown here rather than in afterEach: the slot fixture disposes of its own slot after
            // this hook's cleanup, and the second slot must be free by then to be deletable.
            return async () => {
                await appointments.cancelAppointment(state.appointmentId, patientAuth);
                await doctors.deleteSlot(ownedSlot.id as number, doctorAuth);
            };
        });

        test('POST /auth/login — 200 carries token and user.role @pact', async () => {
            await verifyInteraction('a login request from the mobile app', state);
        });

        test('POST /auth/login — 401 carries errorCode and message @pact', async () => {
            await verifyInteraction('a login request with wrong credentials from the mobile app', state);
        });

        test('POST /appointments — 201 carries id, slotId and status @pact', async () => {
            await verifyInteraction('a booking request from the mobile app', state);
        });

        test('GET /appointments/my — 200 carries a paginated data array @pact', async () => {
            await verifyInteraction('a my-appointments request from the mobile app', state);
        });

        test('PATCH /appointments/:id/cancel — 200 @pact', async () => {
            await verifyInteraction('a cancel request from the mobile app', state);
        });

        // B-15: the API answers `isAvailable: 1`, the contract pins a boolean. Marked failing rather
        // than removed, so the day the SUT maps the column this test reports the fix instead of
        // quietly going green — and so the mismatch cannot mask a regression in the five above.
        test('GET /doctors/:id/slots — 200 carries id, startTime and boolean isAvailable @pact', async () => {
            test.fail(true, 'B-15: isAvailable is serialised as 0/1, the contract pins a boolean');
            await verifyInteraction('a slots request from the mobile app', state);
        });
    });
});

import { test, expect } from '../../fixtures';
import { GraphQLClient } from '../../api/GraphQLClient';
import { DoctorsClient } from '../../api/DoctorsClient';
import { readCounter } from '../../utils/metricsClient';

// GraphQL sits on the same repositories as REST, so the value of these tests is not "does it return
// doctors" — it is the failure modes REST does not have:
//   - a rejected request that still answers HTTP 200
//   - a nested field whose database cost is chosen by the caller, not the server
//   - a response shape dictated by the query, so "the field is missing" can be correct

test.describe('GraphQL — /api/v1/graphql @graphql', () => {
  test('query doctors — 200 with data and no errors @smoke @graphql', async ({ request }) => {
    const gql = new GraphQLClient(request);
    const { status, body } = await gql.query('{ doctors { id name specialty } }');

    expect(status).toBe(200);
    expect(body.errors, 'a successful query must not carry an errors array').toBeUndefined();
    const doctors = body.data?.doctors as { id: number; name: string }[];
    expect(doctors.length).toBeGreaterThan(0);
    expect(doctors[0]).toHaveProperty('name');
  });

  test('the response contains exactly the requested fields — no over-fetching @graphql', async ({ request }) => {
    const gql = new GraphQLClient(request);
    const { body } = await gql.query('{ doctors { name } }');

    const doctors = body.data?.doctors as Record<string, unknown>[];
    // REST returns the whole row; here asking for one field must return one field, otherwise the
    // client is paying for data it did not request and the contract is not what it looks like
    expect(Object.keys(doctors[0])).toEqual(['name']);
  });

  test('unknown field — rejected by validation, still HTTP 200 by default @graphql', async ({ request }) => {
    const gql = new GraphQLClient(request);
    const { status, body } = await gql.query('{ doctors { id salary } }');

    // A malformed query is rejected before any resolver runs, yet the transport reports success:
    // under the legacy `application/json` media type the GraphQL-over-HTTP spec keeps the 200.
    // Anything watching only status codes — a dashboard, an alert, an uptime check — sees a
    // perfectly healthy API while every request is failing.
    expect(status).toBe(200);
    expect(body.errors?.[0].message).toContain('salary');
    expect(body.data).toBeUndefined();
  });

  test('the same invalid query answers 400 under the graphql-response media type @graphql', async ({ request }) => {
    // Same query, same server, different Accept header — different status. Worth pinning down:
    // a test written against one media type proves nothing about clients using the other.
    const response = await request.post('/api/v1/graphql', {
      data: JSON.stringify({ query: '{ doctors { id salary } }' }),
      headers: { 'Content-Type': 'application/json', Accept: 'application/graphql-response+json' },
    });
    expect(response.status()).toBe(400);
  });

  test('doctor(id:) for a missing doctor — null, not an error @graphql', async ({ request }) => {
    const gql = new GraphQLClient(request);
    const { status, body } = await gql.query('{ doctor(id: 999999) { id name } }');

    expect(status).toBe(200);
    expect(body.data?.doctor).toBeNull();
    expect(body.errors, '"no such doctor" is an answer, not a failure').toBeUndefined();
  });

  test('myAppointments without a token — HTTP 200 carrying an error @graphql', async ({ request }) => {
    const gql = new GraphQLClient(request);
    const { status, body } = await gql.query('{ myAppointments { id status } }');

    // The trap this test exists for: asserting only on the status would pass here while the request
    // was in fact rejected. In REST this is a 401; in GraphQL the verdict lives in the body.
    expect(status).toBe(200);
    expect(body.errors?.length).toBeGreaterThan(0);
    expect(body.errors?.[0].extensions?.errorCode).toBe('AUTH_REQUIRED');
    expect(body.data?.myAppointments ?? null).toBeNull();
  });

  test('myAppointments with a token — returns only the caller own appointments @graphql', async ({ request, user, slot }) => {
    const gql = new GraphQLClient(request);
    const { body: before } = await gql.query('{ myAppointments { id status } }', undefined, user.token);
    expect(before.errors).toBeUndefined();
    expect((before.data?.myAppointments as unknown[]).length).toBe(0);

    const appointments = new (await import('../../api/AppointmentsClient')).AppointmentsClient(request);
    const { status } = await appointments.createAppointment(slot.slot.id, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(status).toBe(201);

    const { body: after } = await gql.query('{ myAppointments { id slotId status } }', undefined, user.token);
    const mine = after.data?.myAppointments as { slotId: number; status: string }[];
    expect(mine.length).toBe(1);
    expect(mine[0].slotId).toBe(slot.slot.id);
  });

  test('doctors { slots } — one database query, not one per doctor @graphql', async ({ request }) => {
    const gql = new GraphQLClient(request);
    const doctors = new DoctorsClient(request);
    const { body: allDoctors } = await doctors.list();
    const doctorCount = (allDoctors as unknown[]).length;
    expect(doctorCount).toBeGreaterThan(1);

    const before = await readCounter(request, 'db_slot_queries_total');
    const { status, body } = await gql.query('{ doctors { id slots { id startTime } } }');
    const after = await readCounter(request, 'db_slot_queries_total');

    expect(status).toBe(200);
    expect(body.errors).toBeUndefined();

    // Without batching this is one query per doctor, and the caller decides how many by adding a
    // nested field — a single small request turns into N queries, and N grows with the data.
    const queries = after - before;
    expect(queries, `nested slots issued ${queries} queries for ${doctorCount} doctors`).toBeLessThanOrEqual(1);
  });
});

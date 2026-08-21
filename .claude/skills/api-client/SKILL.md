---
name: api-client
description: Writing and editing API client methods; adding endpoints to api/*Client.ts files. Use when: writing a new test that calls the API; adding a new endpoint to an existing client; creating a new client file.
triggers:
  - writing a new test that calls the API
  - adding a new endpoint to an existing client
  - creating a new client file
  - any task touching api/*Client.ts or data/testData.ts
---

# Skill: API Client

## WHEN to load this skill

Load when the task involves:
- Writing a new test that calls the API
- Adding a new endpoint to an existing client
- Creating a new client file
- Any task that touches `api/*Client.ts` or `data/testData.ts`

---

## WHY

All HTTP goes through `api/*Client.ts`. This is not a style preference — it is an architectural contract.

Test files must not know about URLs, headers, or request shape. That knowledge lives in the client. When the API changes, only the client changes — not every test that calls it.

Violating this rule looks correct: raw `request.post(url)` calls compile, tests pass, CI stays green. The violation is invisible until you need to change the URL or add an auth header everywhere.

See the failure mode documented in: `references/failure-mode-raw-url.md`

---

## HOW

### Phase 1 — Check if the client method already exists

```bash
grep -n "async " api/AppointmentsClient.ts
```

If a method exists for what you need — use it. Do not add a duplicate.

### Phase 2 — If you need a new method, add it to the right client

| Resource | Client file |
|----------|-------------|
| Appointments | `api/AppointmentsClient.ts` |
| Auth (login, register) | `api/AuthClient.ts` |
| Doctors / slots | `api/DoctorsClient.ts` |
| Users | `api/UserClient.ts` |
| AI recommendations | `api/AiRecommendClient.ts` |
| Consultations | `api/ConsultationsClient.ts` |

### Phase 3 — Add the method to the client

The client extends `BaseClient`. Use `this.postJson()` or `this.request.get/delete` with headers. Return `this.parseResponse(response)`.

```typescript
async myNewMethod(param: string, opts: RequestOpts = {}) {
    const response = await this.request.get(endpoints.myEndpoint(param), {
        headers: { ...opts.headers },
    });
    return this.parseResponse(response);
}
```

Add the endpoint to `data/testData.ts` if it doesn't exist yet.

### Phase 4 — Use the method in the test

```typescript
// CORRECT
const { status, body } = await appointments.getAppointment(id, { headers: auth });

// WRONG — never do this in a test file
const response = await request.get(`http://localhost:3000/appointments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
});
```

---

## WHAT — correct vs forbidden

| Situation | Correct | Forbidden |
|-----------|---------|-----------|
| Call an existing endpoint in a test | `client.methodName(params)` | `request.post(endpoints.x, {...})` |
| Need a URL not yet in any client | Add method to the right client | Inline `request.post` in the test |
| Auth header | Pass via `opts.headers` | Hardcode in the test |
| New resource with no client | Create `api/NewResourceClient.ts` extending `BaseClient` | Write raw calls in test |

---

## See Also

- `references/failure-mode-raw-url.md` — real example of this rule being violated silently
- `api/BaseClient.ts` — base class with `postJson`, `parseResponse`
- `data/testData.ts` — all endpoint URLs

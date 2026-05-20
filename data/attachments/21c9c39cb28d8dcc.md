# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api/auth.delete.test.ts >> account soft delete @api >> DELETE /auth/me — other accounts remain functional after deletion @api
- Location: tests/api/auth.delete.test.ts:90:7

# Error details

```
TypeError: users.getMe is not a function
```

# Test source

```ts
  2   | import { AuthClient } from '../../api/AuthClient';
  3   | import { UserClient } from '../../api/UserClient';
  4   | import { dbClient } from '../../utils/dbClient';
  5   | 
  6   | test.describe('account soft delete @api', () => {
  7   | 
  8   |   // ── Happy path ─────────────────────────────────────────────────────────────
  9   | 
  10  |   test('DELETE /auth/me — 204 soft-deletes own account @smoke @api', async ({ request, user }) => {
  11  |     const users = new UserClient(request);
  12  | 
  13  |     const { status } = await users.deleteMyAccount(user.token);
  14  |     expect(status).toBe(204);
  15  |   });
  16  | 
  17  |   // ── DB integrity ───────────────────────────────────────────────────────────
  18  | 
  19  |   test('DELETE /auth/me — user record preserved in DB with deletedAt set @api', async ({ request, user }) => {
  20  |     const users = new UserClient(request);
  21  | 
  22  |     await users.deleteMyAccount(user.token);
  23  | 
  24  |     const row = dbClient.getUserById(user.user.id);
  25  |     expect(row).toBeDefined();
  26  |     expect(row!.deletedAt).not.toBeNull();
  27  |     expect(typeof row!.deletedAt).toBe('string');
  28  |   });
  29  | 
  30  |   // ── Token revocation — the core security invariant ─────────────────────────
  31  | 
  32  |   test('DELETE /auth/me — 401 access token rejected on any endpoint after deletion @api @security', async ({ request, user }) => {
  33  |     const users = new UserClient(request);
  34  | 
  35  |     await users.deleteMyAccount(user.token);
  36  | 
  37  |     // Old access token must no longer work
  38  |     const { status, body } = await users.getMe(user.token);
  39  |     expect(status).toBe(401);
  40  |     expect(body.errorCode).toBe('AUTH_INVALID');
  41  |   });
  42  | 
  43  |   test('POST /auth/refresh — 401 refresh token rejected after account deletion @api @security', async ({ request, user }) => {
  44  |     const users = new UserClient(request);
  45  |     const auth = new AuthClient(request);
  46  | 
  47  |     await users.deleteMyAccount(user.token);
  48  | 
  49  |     // Old refresh token must not issue new access tokens
  50  |     const { status, body } = await auth.refresh(user.refreshToken);
  51  |     expect(status).toBe(401);
  52  |     expect(body.errorCode).toBe('AUTH_INVALID');
  53  |   });
  54  | 
  55  |   // ── Login and registration blocked ────────────────────────────────────────
  56  | 
  57  |   test('POST /auth/login — 401 deleted account cannot log in @api @security', async ({ request, user }) => {
  58  |     const users = new UserClient(request);
  59  |     const auth = new AuthClient(request);
  60  | 
  61  |     await users.deleteMyAccount(user.token);
  62  | 
  63  |     const { status, body } = await auth.verifyLogin(user.email, user.password);
  64  |     expect(status).toBe(401);
  65  |     expect(body.errorCode).toBe('AUTH_INVALID');
  66  |   });
  67  | 
  68  |   test('POST /auth/register — 409 EMAIL_RETIRED for deleted account email @api', async ({ request, user }) => {
  69  |     const users = new UserClient(request);
  70  | 
  71  |     await users.deleteMyAccount(user.token);
  72  | 
  73  |     const { status, body } = await users.registerPatient({ email: user.email });
  74  |     expect(status).toBe(409);
  75  |     expect(body.errorCode).toBe('EMAIL_RETIRED');
  76  |   });
  77  | 
  78  |   // ── Error paths ────────────────────────────────────────────────────────────
  79  | 
  80  |   test('DELETE /auth/me — 401 without authentication token @api', async ({ request }) => {
  81  |     const users = new UserClient(request);
  82  | 
  83  |     const { status, body } = await users.deleteMyAccount('');
  84  |     expect(status).toBe(401);
  85  |     expect(body.errorCode).toBe('AUTH_REQUIRED');
  86  |   });
  87  | 
  88  |   // ── Isolation — other accounts unaffected ─────────────────────────────────
  89  | 
  90  |   test('DELETE /auth/me — other accounts remain functional after deletion @api', async ({ request, user }) => {
  91  |     const users = new UserClient(request);
  92  | 
  93  |     const { body: reg } = await users.registerPatient({
  94  |       email: `test_other_${Date.now()}@example.com`,
  95  |       password: 'pass123',
  96  |       name: 'Other Patient',
  97  |     });
  98  |     const otherToken: string = reg.token;
  99  | 
  100 |     await users.deleteMyAccount(user.token);
  101 | 
> 102 |     const { status } = await users.getMe(otherToken);
      |                                    ^ TypeError: users.getMe is not a function
  103 |     expect(status).toBe(200);
  104 | 
  105 |     await users.deleteMyAccount(otherToken);
  106 |   });
  107 | 
  108 | });
  109 | 
```
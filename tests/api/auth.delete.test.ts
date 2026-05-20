import { test, expect } from '../../fixtures';
import { AuthClient } from '../../api/AuthClient';
import { UserClient } from '../../api/UserClient';
import { dbClient } from '../../utils/dbClient';

test.describe('account soft delete @api', () => {

  // ── Happy path ─────────────────────────────────────────────────────────────

  test('DELETE /auth/me — 204 soft-deletes own account @smoke @api', async ({ request, user }) => {
    const users = new UserClient(request);

    const { status } = await users.deleteMyAccount(user.token);
    expect(status).toBe(204);
  });

  // ── DB integrity ───────────────────────────────────────────────────────────

  test('DELETE /auth/me — user record preserved in DB with deletedAt set @api', async ({ request, user }) => {
    const users = new UserClient(request);

    await users.deleteMyAccount(user.token);

    const row = dbClient.getUserById(user.user.id);
    expect(row).toBeDefined();
    expect(row!.deletedAt).not.toBeNull();
    expect(typeof row!.deletedAt).toBe('string');
  });

  // ── Token revocation — the core security invariant ─────────────────────────

  test('DELETE /auth/me — 401 access token rejected on any endpoint after deletion @api @security', async ({ request, user }) => {
    const users = new UserClient(request);

    await users.deleteMyAccount(user.token);

    // Old access token must no longer work
    const { status, body } = await users.getMe(user.token);
    expect(status).toBe(401);
    expect(body.errorCode).toBe('AUTH_INVALID');
  });

  test('POST /auth/refresh — 401 refresh token rejected after account deletion @api @security', async ({ request, user }) => {
    const users = new UserClient(request);
    const auth = new AuthClient(request);

    await users.deleteMyAccount(user.token);

    // Old refresh token must not issue new access tokens
    const { status, body } = await auth.refresh(user.refreshToken);
    expect(status).toBe(401);
    expect(body.errorCode).toBe('AUTH_INVALID');
  });

  // ── Login and registration blocked ────────────────────────────────────────

  test('POST /auth/login — 401 deleted account cannot log in @api @security', async ({ request, user }) => {
    const users = new UserClient(request);
    const auth = new AuthClient(request);

    await users.deleteMyAccount(user.token);

    const { status, body } = await auth.verifyLogin(user.email, user.password);
    expect(status).toBe(401);
    expect(body.errorCode).toBe('AUTH_INVALID');
  });

  test('POST /auth/register — 409 EMAIL_RETIRED for deleted account email @api', async ({ request, user }) => {
    const users = new UserClient(request);

    await users.deleteMyAccount(user.token);

    const { status, body } = await users.registerPatient({ email: user.email });
    expect(status).toBe(409);
    expect(body.errorCode).toBe('EMAIL_RETIRED');
  });

  // ── Error paths ────────────────────────────────────────────────────────────

  test('DELETE /auth/me — 401 without authentication token @api', async ({ request }) => {
    const users = new UserClient(request);

    const { status, body } = await users.deleteMyAccount('');
    expect(status).toBe(401);
    expect(body.errorCode).toBe('AUTH_REQUIRED');
  });

  // ── Isolation — other accounts unaffected ─────────────────────────────────

  test('DELETE /auth/me — other accounts remain functional after deletion @api', async ({ request, user }) => {
    const users = new UserClient(request);

    const { body: reg } = await users.registerPatient({
      email: `test_other_${Date.now()}@example.com`,
      password: 'pass123',
      name: 'Other Patient',
    });
    const otherToken: string = reg.token;

    await users.deleteMyAccount(user.token);

    const { status } = await users.getMe(otherToken);
    expect(status).toBe(200);

    await users.deleteMyAccount(otherToken);
  });

});

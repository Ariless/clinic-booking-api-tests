import { test, expect } from '@playwright/test';
import { UserClient } from '../../api/UserClient';
import { generateUser } from '../../utils/userUtils';
import { generateEdgeCaseUsers } from '../../utils/aiTestDataGenerator';

// Builds a unique email for each edge-case registration so there are no DUPLICATE_EMAIL conflicts
function edgeEmail(label: string): string {
  const slug = label.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12);
  const rnd = Math.random().toString(36).slice(2, 7);
  return `test_stress_${slug}_${rnd}@example.com`;
}

async function registerAndCleanup(
  users: UserClient,
  name: string,
  email: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { status, body } = await users.registerPatient({ email, name });
  if (status === 201 && body.token) {
    await users.getMe(body.token as string);
    await users.deleteMyAccount(body.token as string);
  }
  return { status, body };
}

// ---------------------------------------------------------------------------
// Static edge cases — always run, no API key required
// ---------------------------------------------------------------------------

test.describe("POST /api/v1/auth/register — content stress (static) @api", () => {
  test("201: apostrophe in name is stored correctly @api", async ({ request }) => {
    const users = new UserClient(request);
    const name = "O'Brien";
    const { status, body } = await users.registerPatient({ email: edgeEmail('obrien'), name });
    expect(status).toBe(201);
    expect(body.user).toBeDefined();
    expect((body.user as Record<string, unknown>).name).toBe(name);
    await users.deleteMyAccount(body.token as string);
  });

  test("201: diacritics in name are stored correctly @api", async ({ request }) => {
    const users = new UserClient(request);
    const name = "Zöe Müller";
    const { status, body } = await users.registerPatient({ email: edgeEmail('zoemuller'), name });
    expect(status).toBe(201);
    expect((body.user as Record<string, unknown>).name).toBe(name);
    await users.deleteMyAccount(body.token as string);
  });

  test("201: CJK unicode name is stored correctly @api", async ({ request }) => {
    const users = new UserClient(request);
    const name = "李明";
    const { status, body } = await users.registerPatient({ email: edgeEmail('cjk'), name });
    expect(status).toBe(201);
    expect((body.user as Record<string, unknown>).name).toBe(name);
    await users.deleteMyAccount(body.token as string);
  });

  test("201: hyphenated name is stored correctly @api", async ({ request }) => {
    const users = new UserClient(request);
    const name = "Mary-Jane Watson";
    const { status, body } = await users.registerPatient({ email: edgeEmail('maryjane'), name });
    expect(status).toBe(201);
    expect((body.user as Record<string, unknown>).name).toBe(name);
    await users.deleteMyAccount(body.token as string);
  });

  test("201: accented Latin characters in name are stored correctly @api", async ({ request }) => {
    const users = new UserClient(request);
    const name = "José García";
    const { status, body } = await users.registerPatient({ email: edgeEmail('joseg'), name });
    expect(status).toBe(201);
    expect((body.user as Record<string, unknown>).name).toBe(name);
    await users.deleteMyAccount(body.token as string);
  });

  test("201: 82-character email is accepted @api", async ({ request }) => {
    const users = new UserClient(request);
    // 82 chars total: 70-char local part + @example.com (12 chars)
    const rnd = Math.random().toString(36).slice(2, 7);
    const localPart = `test_stress_${'x'.repeat(53)}_${rnd}`; // 12 + 53 + 1 + 5 = 71 → trim to 70
    const email = `${localPart.slice(0, 70)}@example.com`;
    expect(email.length).toBe(82);
    const { status, body } = await users.registerPatient({ email, name: generateUser().name });
    expect(status).toBe(201);
    await users.deleteMyAccount(body.token as string);
  });

  test("201: name with apostrophe AND diacritic combined is stored correctly @api", async ({ request }) => {
    const users = new UserClient(request);
    const name = "John-François O'Neill";
    const { status, body } = await users.registerPatient({ email: edgeEmail('francoiseoneill'), name });
    expect(status).toBe(201);
    expect((body.user as Record<string, unknown>).name).toBe(name);
    await users.deleteMyAccount(body.token as string);
  });

  test("201: 119-character name (just under 120 limit) is accepted @api", async ({ request }) => {
    const users = new UserClient(request);
    const name = 'A'.repeat(119);
    const { status, body } = await users.registerPatient({ email: edgeEmail('longname'), name });
    expect(status).toBe(201);
    expect((body.user as Record<string, unknown>).name).toBe(name);
    await users.deleteMyAccount(body.token as string);
  });

  test("400 VALIDATION_ERROR: name exceeds 120-char limit @api", async ({ request }) => {
    const users = new UserClient(request);
    const { status, body } = await users.registerPatient({
      email: edgeEmail('toolong'),
      name: 'A'.repeat(121),
    });
    expect(status).toBe(400);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  test("400 VALIDATION_ERROR: email exceeds 254-char limit @api", async ({ request }) => {
    const users = new UserClient(request);
    const localPart = 'a'.repeat(243); // 243 + 12 = 255 chars
    const { status, body } = await users.registerPatient({
      email: `${localPart}@example.com`,
      name: "Test User",
    });
    expect(status).toBe(400);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });
});

// ---------------------------------------------------------------------------
// AI-generated edge cases — skipped without ANTHROPIC_API_KEY
// ---------------------------------------------------------------------------

test.describe("POST /api/v1/auth/register — AI-generated edge cases @api @ai-data", () => {
  test("AI-generated: all edge-case names register and are stored correctly @api @ai-data", async ({ request }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, 'Requires ANTHROPIC_API_KEY — Claude generates edge-case names');

    const users = new UserClient(request);
    const edgeCases = await generateEdgeCaseUsers();

    for (const { name, description } of edgeCases) {
      const email = edgeEmail(description);
      const { status, body } = await registerAndCleanup(users, name, email);
      expect(status, `Expected 201 for "${name}" (${description})`).toBe(201);
      expect(
        (body.user as Record<string, unknown>).name,
        `Name mismatch for "${name}" (${description})`
      ).toBe(name);
    }
  });
});

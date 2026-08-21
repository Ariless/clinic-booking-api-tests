import https from 'https';

export interface EdgeCaseUser {
  name: string;
  description: string;
}

// Used when ANTHROPIC_API_KEY is absent (CI without key, local dev)
const STATIC_FALLBACK: EdgeCaseUser[] = [
  { name: "O'Brien", description: "apostrophe in name" },
  { name: "Zöe Müller", description: "umlaut diacritics" },
  { name: "李明", description: "CJK unicode script" },
  { name: "Mary-Jane Watson", description: "hyphen in name" },
  { name: "José García", description: "accented Latin characters" },
  { name: "Иван Петров", description: "Cyrillic script" },
  { name: "محمد علي", description: "Arabic script (RTL)" },
  { name: "John-François O'Neill", description: "hyphen + apostrophe + diacritic combined" },
];

function callClaude(prompt: string, apiKey: string): Promise<string> {
  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data) as { error?: { message: string }; content: Array<{ text: string }> };
            if (parsed.error) reject(new Error(parsed.error.message));
            else resolve(parsed.content[0].text);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function generateEdgeCaseUsers(): Promise<EdgeCaseUser[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return STATIC_FALLBACK;

  const prompt = [
    'You are a senior QA engineer writing registration form stress tests.',
    'Generate 8 edge-case patient names that test string handling in a web application.',
    'Requirements:',
    '- Each name must be under 100 characters',
    '- Cover a diverse range: apostrophes, diacritics, CJK/Arabic/Cyrillic scripts,',
    '  hyphens, mixed scripts, multiple spaces, names starting with lowercase',
    '- Do NOT repeat the same edge case type twice',
    '- Make them realistic-looking (not random strings)',
    '',
    'Return ONLY a JSON array, no explanation, no markdown:',
    '[{"name": "...", "description": "what edge case this covers"}]',
  ].join('\n');

  try {
    const raw = await callClaude(prompt, apiKey);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return STATIC_FALLBACK;
    const parsed = JSON.parse(match[0]) as EdgeCaseUser[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : STATIC_FALLBACK;
  } catch {
    return STATIC_FALLBACK;
  }
}

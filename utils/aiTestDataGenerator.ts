import { TOOLING_MODEL } from '../config/models';

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

// The transport is shared with the reporting scripts — one copy, in
// `scripts/lib/anthropicRequest.js`, which records `usage` in the token ledger. This file used to
// carry its own copy built straight on `https.request`, so every name this generator produced was
// billed and counted nowhere. Same fix as `utils/aiBugReporter.ts`.
//
// `require` rather than `import`: the shared transport is CommonJS because `scripts/` runs straight
// through `node` with no build step.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { callClaude: sharedCallClaude } = require('../scripts/lib/anthropicRequest') as {
  callClaude: (
    prompt: string,
    apiKey: string,
    options?: { maxTokens?: number; model?: string; label?: string }
  ) => Promise<string>;
};

function callClaude(prompt: string, apiKey: string): Promise<string> {
  return sharedCallClaude(prompt, apiKey, {
    maxTokens: 1024,
    model: TOOLING_MODEL,
    label: 'test-data-generator',
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

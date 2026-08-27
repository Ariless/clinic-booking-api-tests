import fs from 'fs';
import path from 'path';
import https from 'https';
import type { TestInfo } from '@playwright/test';
import { redactPhi } from './phi';
import { TOOLING_MODEL } from '../config/models';

interface ClaudeResponse {
  error?: { message: string };
  content: Array<{ text: string }>;
}

function callClaude(prompt: string, apiKey: string): Promise<string> {
  const body = JSON.stringify({
    model: TOOLING_MODEL,
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
            const parsed = JSON.parse(data) as ClaudeResponse;
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

/**
 * The prompt sent to Claude for a failed test, with patient data taken out of it.
 *
 * Exported so `tests/unit/bug-reporter.redaction.test.ts` can assert what leaves without a network
 * call or a key: the redaction is the whole point of this function, and a guarantee that can only be
 * checked by watching real traffic is not one this suite can hold.
 *
 * A Playwright assertion message quotes the values it compared, so an AI test that fails carries the
 * symptoms into `error.message` and an auth test carries an address and a bearer token. Both go
 * through `redactPhi` before they reach the prompt, the `bug-reports/` file, or the Allure report.
 */
function buildBugReportPrompt(testInfo: TestInfo): string {
  const error = testInfo.errors?.[0];
  const rawMessage = error?.message?.split('\n').slice(0, 3).join(' ') || 'no error';
  const rawStack = (error?.stack || '')
    .split('\n')
    .filter((l) => !l.includes('node_modules'))
    .slice(0, 6)
    .join('\n');

  const errorMessage = redactPhi(rawMessage);
  const stack = redactPhi(rawStack);

  return [
    'You are a senior QA engineer. A Playwright automated test just failed.',
    'Write a concise, actionable bug report a developer can act on immediately.',
    '',
    `Test:     ${testInfo.title}`,
    `File:     ${path.relative(process.cwd(), testInfo.file || '')}`,
    `Duration: ${testInfo.duration}ms`,
    `Error:    ${errorMessage}`,
    stack ? `Stack:\n${stack}` : '',
    '',
    'Respond with markdown in exactly this structure:',
    '## <short bug title>',
    '**Severity:** Critical | High | Medium | Low',
    '**Component:** <component name>',
    '',
    '### Steps to reproduce',
    '1. <step>',
    '',
    '### Actual result',
    '<what happened>',
    '',
    '### Expected result',
    '<what should happen>',
    '',
    '### Notes',
    '<hypotheses, related code, or investigation hints>',
    '',
    'Keep the report under 250 words. Be specific — use the test title and error as evidence.',
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

async function generateBugReport(testInfo: TestInfo): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || testInfo.status !== 'failed') return null;

  const prompt = buildBugReportPrompt(testInfo);

  try {
    return await callClaude(prompt, apiKey);
  } catch (e) {
    const err = e as Error;
    // The fallback is written to the same three places as the report, so it is redacted too — the
    // original built its own copy of the error message straight from `testInfo`.
    return `## Bug report generation failed\n\nError: ${redactPhi(err.message)}\n\nTest: ${testInfo.title}`;
  }
}

async function attachBugReport(testInfo: TestInfo): Promise<void> {
  const report = await generateBugReport(testInfo);
  if (!report) return;

  await testInfo.attach('AI Bug Report', {
    body: Buffer.from(report),
    contentType: 'text/markdown',
  });

  const outDir = path.join(process.cwd(), 'bug-reports');
  fs.mkdirSync(outDir, { recursive: true });
  const slug = testInfo.title
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase()
    .slice(0, 60);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = path.join(outDir, `${slug}_${ts}.md`);
  fs.writeFileSync(filename, report);
  console.log(`\n  [AI bug report] ${filename}`);
}

export { attachBugReport, buildBugReportPrompt };

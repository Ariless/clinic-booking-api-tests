import fs from 'fs';
import path from 'path';
import https from 'https';
import type { TestInfo } from '@playwright/test';

interface ClaudeResponse {
  error?: { message: string };
  content: Array<{ text: string }>;
}

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

async function generateBugReport(testInfo: TestInfo): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || testInfo.status !== 'failed') return null;

  const error = testInfo.errors?.[0];
  const errorMessage = error?.message?.split('\n').slice(0, 3).join(' ') || 'no error';
  const stack = (error?.stack || '')
    .split('\n')
    .filter((l) => !l.includes('node_modules'))
    .slice(0, 6)
    .join('\n');

  const prompt = [
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

  try {
    return await callClaude(prompt, apiKey);
  } catch (e) {
    const err = e as Error;
    return `## Bug report generation failed\n\nError: ${err.message}\n\nTest: ${testInfo.title}\nError: ${errorMessage}`;
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

export { attachBugReport };

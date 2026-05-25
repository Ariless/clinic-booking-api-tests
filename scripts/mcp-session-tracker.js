const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const visitedRoutes = new Set();
const calledEndpoints = new Set();

async function track() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--remote-debugging-port=9222'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      try {
        const url = new URL(frame.url());
        if (url.hostname === 'localhost') {
          visitedRoutes.add(url.pathname);
        }
      } catch {}
    }
  });

  page.on('request', (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        calledEndpoints.add(`${request.method()} ${url.pathname}`);
      }
    } catch {}
  });

  console.log('Browser launched. CDP available on port 9222.');
  console.log('Add to claude_desktop_config.json:');
  console.log('  "args": ["--cdp-endpoint", "http://localhost:9222"]');
  console.log('Press Ctrl+C to stop and save coverage report.\n');

  process.on('SIGINT', () => {
    const hasPosts = [...calledEndpoints].some((e) => e.startsWith('POST'));

    const report = {
      timestamp: new Date().toISOString(),
      visitedRoutes: [...visitedRoutes].sort(),
      calledEndpoints: [...calledEndpoints].sort(),
      warnings: [
        !hasPosts && 'No POST requests — agent may have only explored read paths',
        visitedRoutes.size < 3 && 'Fewer than 3 routes visited — exploration may be shallow',
      ].filter(Boolean),
      summary: {
        uniqueRoutes: visitedRoutes.size,
        uniqueEndpoints: calledEndpoints.size,
        hasPostRequests: hasPosts,
      },
    };

    const dir = path.join(__dirname, '..', 'coverage');
    fs.mkdirSync(dir, { recursive: true });
    const filename = path.join(dir, `mcp-session-${Date.now()}.json`);
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\nReport saved: ${filename}`);
    report.warnings.forEach((w) => console.log(`Warning: ${w}`));
    process.exit(0);
  });

  await new Promise(() => {});
}

track().catch(console.error);

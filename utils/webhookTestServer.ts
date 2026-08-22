import http from 'http';

const MOCK_PORT = 9001;

function createWebhookTestServer() {
  let server: http.Server;
  let pendingResolve: ((payload: Record<string, unknown>) => void) | null = null;

  async function start(): Promise<void> {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body) as Record<string, unknown>;
          if (pendingResolve) {
            pendingResolve(payload);
            pendingResolve = null;
          }
        } catch {
          // Malformed webhook payload: ignore it and answer 200 anyway, the way the
          // real receiver does — the test asserts on what arrived, not on this branch.
        }
        res.writeHead(200);
        res.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(MOCK_PORT, resolve));
  }

  async function stop(): Promise<void> {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  function waitForWebhook(timeoutMs = 3000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('webhook not received within timeout')),
        timeoutMs
      );
      pendingResolve = (payload) => {
        clearTimeout(timer);
        resolve(payload);
      };
    });
  }

  return { start, stop, waitForWebhook, port: MOCK_PORT };
}

export { createWebhookTestServer };

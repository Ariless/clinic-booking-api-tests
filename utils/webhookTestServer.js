const http = require("http");

const MOCK_PORT = 9001;

function createWebhookTestServer() {
  let server;
  let pendingResolve;

  async function start() {
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const payload = JSON.parse(body);
          if (pendingResolve) {
            pendingResolve(payload);
            pendingResolve = null;
          }
        } catch (_) {}
        res.writeHead(200);
        res.end();
      });
    });
    await new Promise((resolve) => server.listen(MOCK_PORT, resolve));
  }

  async function stop() {
    if (server) await new Promise((resolve) => server.close(resolve));
  }

  function waitForWebhook(timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("webhook not received within timeout")),
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

module.exports = { createWebhookTestServer };

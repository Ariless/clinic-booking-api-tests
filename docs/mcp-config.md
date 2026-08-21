# Playwright MCP — Setup

How to connect Playwright MCP to Claude Desktop so you can run the demo scenarios in [`mcp-demo.md`](mcp-demo.md).

---

## Prerequisites

- Node.js 20+
- Claude Desktop installed (https://claude.ai/download)
- SUT running: `cd ../sut && npm run dev` (port 3000)

---

## Step 1 — Install Playwright MCP

No global install needed. `npx @playwright/mcp@latest` pulls it on first use.

To verify it works:
```bash
npx @playwright/mcp@latest --version
```

---

## Step 2 — Configure Claude Desktop

Open or create the config file:

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

Add the Playwright MCP server:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

If the file already has other MCP servers, add `"playwright"` inside the existing `"mcpServers"` object.

---

## Step 3 — Restart Claude Desktop

Close and reopen Claude Desktop. In a new conversation, you should see browser tools available (browser_navigate, browser_click, browser_screenshot, etc.).

---

## Step 4 — Run the demo

Start a new conversation in Claude Desktop. Paste the prompts from [`mcp-demo.md`](mcp-demo.md) one by one.

**Quick smoke check:**
```
Open http://localhost:3000 and tell me what you see on the page.
```

If Claude navigates and describes the login form — MCP is working.

---

## Troubleshooting

**"I don't see browser tools"**  
Config file path is wrong or JSON is malformed. Validate with `cat` or a JSON linter.

**"npx: command not found"**  
Node.js is not in PATH for the shell that Claude Desktop uses. Set the full path:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "/usr/local/bin/npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```
Find your npx path with `which npx`.

**"Connection refused" when navigating to localhost:3000**  
SUT is not running. Start it: `cd ../sut && npm run dev`

**Browser opens but page is blank**  
Try `http://127.0.0.1:3000` instead of `localhost` — some Node versions resolve differently.

---

## What's available after setup

Claude Desktop gains these tools from Playwright MCP:

| Tool | What it does |
|------|-------------|
| `browser_navigate` | Open a URL |
| `browser_click` | Click an element |
| `browser_type` | Type into an input |
| `browser_screenshot` | Capture current state |
| `browser_snapshot` | Accessibility tree of the page |
| `browser_network_requests` | Inspect recent network activity |
| `browser_evaluate` | Run JavaScript in the page |

These are the same tools used in the demo scenarios — no additional configuration needed.

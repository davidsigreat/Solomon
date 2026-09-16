# Solomon public API & MCP

**Live app:** https://solomondash.vercel.app  
Solomon is a cross-project status hub. Other apps and agents talk to it with a **Bearer API key** — not your browser session cookie.

---

## 1. Mint a key

1. Sign in at [solomondash.vercel.app](https://solomondash.vercel.app).
2. Open **Profile**.
3. Under **API Keys**, name a key (for example `Claude`) and click **Create key**.
4. Copy the `sk_live_…` secret immediately. It is shown **once**; the database stores only a hash.

Revoke unused keys from the same panel. Revoked keys return `401`.

If a key was pasted into chat, a config paste, or a screenshot, **revoke it and mint a new one** before connecting any client.

---

## 2. Auth (shared by REST and MCP)

Every `/api/v1/*` request and every MCP tool call requires:

```http
Authorization: Bearer sk_live_…
```

| App role | Access |
| --- | --- |
| `VIEWER` | Read only |
| `MEMBER` / `ADMIN` | Mutate where the project role allows (`EDITOR` / `OWNER`) |

- Missing, malformed, unknown, or revoked key → `401 Unauthorized`
- Authenticated but not allowed (app `VIEWER`, or project `VIEWER` on a write) → `403 Forbidden`
- Successful requests touch `lastUsedAt` on the key

---

## 3. REST API (`/api/v1`)

Use this from scripts, other apps, or any HTTP client.

### Portfolio status

`GET /api/v1/status` — every project the key can access.

```bash
curl -sS https://solomondash.vercel.app/api/v1/status \
  -H "Authorization: Bearer sk_live_YOUR_KEY"
```

Empty access returns `{ "projects": [] }`.

Each project includes:

- `id`, `name`, `color`
- `taskCounts` (`TODO` / `IN_PROGRESS` / `IN_REVIEW` / `DONE`)
- `overdueCount`
- `openTasks` (short open-task sample)

### Other v1 routes

Same Bearer auth.

| Method | Path |
| --- | --- |
| GET, POST | `/api/v1/projects` |
| GET, PATCH, DELETE | `/api/v1/projects/:id` |
| GET, POST | `/api/v1/projects/:id/members` |
| PATCH, DELETE | `/api/v1/projects/:id/members/:userId` |
| GET, POST | `/api/v1/tasks` |
| GET, PATCH, DELETE | `/api/v1/tasks/:id` |
| GET, POST | `/api/v1/tasks/:id/assignees` |
| DELETE | `/api/v1/tasks/:id/assignees/:userId` |
| GET, POST | `/api/v1/tasks/:id/subtasks` |
| PATCH, DELETE | `/api/v1/tasks/:id/subtasks/:subtaskId` |

Analytics remains session-cookie only (`/api/analytics`) — not part of this public surface.

---

## 4. MCP (`/api/mcp`)

Use this from agents (Claude Code, Claude Desktop, Cursor, and other MCP clients). Same Profile-minted Bearer key. Same backend helpers as `/api/v1` — not a second auth stack.

**Endpoint:** `https://solomondash.vercel.app/api/mcp`  
**Transport:** streamable HTTP

### Tools

| Tool | Role |
| --- | --- |
| `list_projects` | Read — projects the key can access |
| `portfolio_status` | Read — same payload as `GET /api/v1/status` (optional `projectId`) |
| `list_tasks` | Read — optional `projectId`, `status` |
| `upsert_task` | Write — create (`title` + `projectId`) or update by `id` |

`VIEWER` keys can call read tools; `upsert_task` returns `403`.

### Claude Code (HTTP — preferred)

Claude Code supports remote HTTP MCP directly:

```bash
claude mcp add --transport http solomon https://solomondash.vercel.app/api/mcp \
  --header "Authorization: Bearer sk_live_YOUR_KEY"
```

Restart the session (or open a new one) and check with `/mcp`. You should see the four tools above.

Equivalent JSON (`.mcp.json` / Claude Code settings) needs an explicit transport type:

```json
{
  "mcpServers": {
    "solomon": {
      "type": "http",
      "url": "https://solomondash.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer sk_live_YOUR_KEY"
      }
    }
  }
}
```

### Claude Desktop (`mcp-remote` bridge)

`claude_desktop_config.json` only accepts **stdio** servers (`command` / `args` / `env`). A bare `url` + `headers` entry is **invalid** and Desktop skips it with:

> The following entries … are not valid MCP server configurations and were skipped: solomon

Use [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) as a local stdio → HTTP bridge (requires Node.js). On macOS the file is:

`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "solomon": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://solomondash.vercel.app/api/mcp",
        "--header",
        "Authorization: Bearer ${SOLOMON_API_KEY}"
      ],
      "env": {
        "SOLOMON_API_KEY": "sk_live_YOUR_KEY"
      }
    }
  }
}
```

Fully quit Claude Desktop and reopen. Do not put secrets in chat or screenshots.

**Optional UI path:** Customize → Connectors → Add custom connector → URL `https://solomondash.vercel.app/api/mcp` → Request headers → `Authorization` = `Bearer sk_live_…` (if your Claude build shows Request headers). That path is account-brokered and separate from the local JSON stdio list.

### Cursor / other HTTP clients

Clients that support Streamable HTTP + headers can use:

```json
{
  "mcpServers": {
    "solomon": {
      "url": "https://solomondash.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer sk_live_YOUR_KEY"
      }
    }
  }
}
```

If the client requires an explicit type field, set `"type": "http"` (or `streamable-http` where that alias is accepted).

### Smoke (curl)

```bash
# 1. Initialize
curl -sS https://solomondash.vercel.app/api/mcp \
  -H "Authorization: Bearer sk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'

# 2. List tools
curl -sS https://solomondash.vercel.app/api/mcp \
  -H "Authorization: Bearer sk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. Read portfolio
curl -sS https://solomondash.vercel.app/api/mcp \
  -H "Authorization: Bearer sk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"portfolio_status","arguments":{}}}'
```

Missing or revoked keys return `401`.

---

## Mental model

| Door | Who uses it | Entry |
| --- | --- | --- |
| REST `/api/v1` | Other applications / scripts | HTTP + Bearer |
| MCP `/api/mcp` | Agents | MCP HTTP + Bearer |

| Client | How to connect |
| --- | --- |
| Claude Code | `--transport http` + `--header` (or JSON with `"type": "http"`) |
| Claude Desktop | `npx mcp-remote` stdio bridge in `claude_desktop_config.json` (not bare `url`) |
| Cursor / other HTTP MCP | URL + `Authorization` header |

Both REST and MCP act as the **key owner** across projects that user can access.

# Solomon public API & MCP

Base URL: `https://solomondash.vercel.app`

Solomon is a cross-project status hub. The public surface is Bearer-only — session cookies are ignored.

## Mint a key

1. Sign in at [solomondash.vercel.app](https://solomondash.vercel.app).
2. Open **Profile**.
3. Under **API Keys**, name a key (for example `Claude`) and click **Create key**.
4. Copy the `sk_live_…` secret immediately. It is shown once; the database stores only a hash.

Revoke unused keys from the same panel. Revoked keys return `401`.

## Auth

Every `/api/v1/*` request and every MCP tool call requires:

```
Authorization: Bearer sk_live_…
```

| App role | Access |
| --- | --- |
| `VIEWER` | Read only |
| `MEMBER` / `ADMIN` | Mutate where the project role allows (`EDITOR` / `OWNER`) |

- Missing, malformed, unknown, or revoked key → `401 Unauthorized`
- Authenticated but not allowed (app `VIEWER`, or project `VIEWER` on a write) → `403 Forbidden`
- Successful requests touch `lastUsedAt` on the key

## `GET /api/v1/status`

Portfolio overview for every project the key can access.

```bash
curl -sS https://solomondash.vercel.app/api/v1/status \
  -H "Authorization: Bearer sk_live_YOUR_KEY"
```

Empty access returns `{ "projects": [] }`.

Each project includes `id`, `name`, `color`, `taskCounts` (`TODO` / `IN_PROGRESS` / `IN_REVIEW` / `DONE`), `overdueCount`, and `openTasks` (short open-task sample).

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
| GET, POST | `/api/v1/sprints` |
| GET, DELETE | `/api/v1/sprints/:id` |

Analytics remains session-cookie only (`/api/analytics`).

## MCP

Streamable HTTP endpoint: `https://solomondash.vercel.app/api/mcp`

Use the same Profile-minted Bearer key. No session cookie.

Cursor / Claude example:

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

### Tools

| Tool | Role |
| --- | --- |
| `list_projects` | Read — projects the key can access |
| `portfolio_status` | Read — same payload as `GET /api/v1/status` (optional `projectId`) |
| `list_tasks` | Read — optional `projectId`, `status` |
| `upsert_task` | Write — create (`title` + `projectId`) or update by `id` |
| `log_sprint` | Write — log a focus/break session (`duration` minutes) |

Helpers are shared with `/api/v1` — auth is `getApiAuth` / `authenticateApiKey` + `resolveAuth`, not a second stack.

### Smoke (MCP)

List tools (initialize + `tools/list`) and one read:

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

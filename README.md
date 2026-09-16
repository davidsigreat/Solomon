# SOLOMON

**Live:** [solomondash.vercel.app](https://solomondash.vercel.app)  
**Tagline:** *Your personal counsel.*

SOLOMON is a multi-project status hub: projects, tasks, members, roles, notifications, and analytics — plus a public **Bearer API** and **MCP** surface so other apps and agents can read (and, with write access, update) the same portfolio.

Named after Solomon (wisdom). Built for David; shareable to teammates via roles and whitelist.

---

## What you can do in the app

1. **Sign in** with Google (Neon Auth). Only whitelisted emails get in; app roles control what you can change.
2. **Projects** — create and open projects, assign members (`OWNER` / `EDITOR` / `VIEWER`).
3. **Tasks** — statuses `TODO` → `IN_PROGRESS` → `IN_REVIEW` → `DONE`, assignees, subtasks, due dates.
4. **Portfolio view** — see task counts and overdue work across projects you can access.
5. **Profile → API Keys** — mint a `sk_live_…` key for REST and MCP (shown once; revoke anytime).
6. **Admin** (admins) — whitelist and user management.
7. **Analytics** — in-app charts (session cookie; not on the public Bearer API).

Calendar and Chrono Matrix were removed from the product. Google client credentials are for **sign-in only**, not calendar.

---

## Roles (quick)

| Layer | Roles | Notes |
| --- | --- | --- |
| App | `VIEWER` / `MEMBER` / `ADMIN` | `VIEWER` is read-only on public API writes |
| Project | `VIEWER` / `EDITOR` / `OWNER` | Writes need `EDITOR` or `OWNER` on that project |

---

## Stack

| Layer | Tech |
| --- | --- |
| App | Next.js (App Router), React, Tailwind |
| Data | Neon Postgres + Prisma |
| Auth | Neon Auth + Google OAuth |
| Public surface | `/api/v1/*` (REST) and `/api/mcp` (MCP, streamable HTTP) |
| Deploy | Vercel |

Historical design notes live in [`blueprint.md`](./blueprint.md) (may lag the live app). Migrations: [`MIGRATIONS.md`](./MIGRATIONS.md). Full public API detail: [`docs/public-api.md`](./docs/public-api.md).

---

## Local development

```bash
npm install
cp .env.example .env.local   # if present; otherwise create .env.local
npm run db:deploy            # prisma migrate deploy
npm run dev
```

Typical `.env.local` (names may match your Neon Auth dashboard):

```env
AUTHORIZED_EMAIL=
DATABASE_URL=
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
NEXT_PUBLIC_NEON_AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Add `http://localhost:3000` to Neon Auth **trusted domains** and to the Google OAuth authorized origins/redirects. Do **not** require calendar refresh tokens or weather env vars for current builds.

QA runs against a **local** checkout and DB (not Vercel preview SSO). See `MIGRATIONS.md` if the database was previously created with `db push`.

---

## Public API & MCP

One lock for both doors: a Profile-minted **Bearer** key. Session cookies are ignored on `/api/v1` and `/api/mcp`.

```http
Authorization: Bearer sk_live_…
```

| Surface | Who it’s for | Base |
| --- | --- | --- |
| REST | Scripts, other apps | `https://solomondash.vercel.app/api/v1` |
| MCP | Agents (Claude, Cursor, …) | `https://solomondash.vercel.app/api/mcp` |

### Mint a key

1. Sign in → **Profile** → **API Keys** → create.
2. Copy `sk_live_…` immediately (shown once).
3. If a key was pasted into chat or a screenshot, **revoke and remint**.

### REST snapshot

```bash
curl -sS https://solomondash.vercel.app/api/v1/status \
  -H "Authorization: Bearer sk_live_YOUR_KEY"
```

Returns every project the key can access (counts, overdue, open-task sample). Other routes cover projects, members, tasks, assignees, and subtasks under `/api/v1/…`. Details: [`docs/public-api.md`](./docs/public-api.md).

### MCP tools

| Tool | Access |
| --- | --- |
| `list_projects` | Read |
| `portfolio_status` | Read (same idea as `GET /api/v1/status`) |
| `list_tasks` | Read |
| `upsert_task` | Write (create/update; `VIEWER` → `403`) |

### Claude Code (HTTP)

```bash
claude mcp add --transport http solomon https://solomondash.vercel.app/api/mcp \
  --header "Authorization: Bearer sk_live_YOUR_KEY"
```

Then `/mcp` in the session. JSON form needs `"type": "http"` plus `url` and `headers`.

### Claude Desktop (`mcp-remote` bridge)

`claude_desktop_config.json` only accepts **stdio** (`command` / `args` / `env`). A bare `url` + `headers` entry is **skipped** as invalid.

Use a local bridge (needs Node.js):

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

macOS path: `~/Library/Application Support/Claude/claude_desktop_config.json`. Fully quit and reopen Desktop after editing.

Optional: Customize → Connectors → Add custom connector with the MCP URL and an `Authorization` request header, if your Claude build supports it.

### Cursor / other HTTP MCP clients

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

Add `"type": "http"` if the client requires it.

---

## Repo map (short)

| Path | Purpose |
| --- | --- |
| `app/` | UI + API routes (including `api/v1`, `api/mcp`, `api/keys`) |
| `lib/` | Auth helpers, public API/MCP shared logic |
| `prisma/` | Schema + migrations |
| `docs/public-api.md` | Full public API & MCP reference |
| `MIGRATIONS.md` | Deploy / baseline migration runbook |
| `blueprint.md` | Original product blueprint (historical) |

---

## Scripts

| Script | Use |
| --- | --- |
| `npm run dev` | Local Next.js |
| `npm run build` / `start` | Production build |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:migrate` | `prisma migrate dev` (new migration) |
| `npm run db:studio` | Prisma Studio |

---

## Mental model

```
Browser session  →  cookie auth  →  UI + session APIs (e.g. analytics)
API key          →  Bearer       →  /api/v1  and  /api/mcp
```

Both public doors act as the **key owner** across projects that user can access.

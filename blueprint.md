# Project Blueprint: SOLOMON Dashboard
*Refined for buildability — v2*

A comprehensive development roadmap for building a private, secure, and highly integrated AI-driven personal workspace.

---

## 📛 App Name & Identity

**SOLOMON** — named after the son of King David, renowned above all else for wisdom.

The name is personal (David → Solomon), intentional, and thematically exact: a system that knows your schedule, remembers your decisions, tracks your work, and briefs you every morning isn't just a dashboard — it's a counsel of wisdom built for one person. Where J.A.R.V.I.S. was Tony Stark's, SOLOMON is yours.

- **Repo name:** `solomon`
- **Display name in UI:** `SOLOMON`
- **Tagline:** *Your personal counsel.*
- **Boot message:** *"SOLOMON online. Good morning, David."*

---

This system combines developer habit-tracking, scheduling automation, dynamic context gathering (weather/time), an LLM-powered command interface, and a deep **Claude + Obsidian intelligence layer** — all wrapped in a high-fidelity, sci-fi aesthetic.

At its core, **Obsidian serves as SOLOMON's persistent brain** — a structured, queryable, human-readable long-term memory store that the AI agent reads from before reasoning and writes back to after every meaningful interaction. Rather than memory living ephemerally inside a context window or opaquely inside a vector database, it lives in your vault: inspectable, editable, and linked.

---

## 🛠️ 1. Architecture & Tech Stack

The architecture consolidates frontend rendering and backend logic into a singular **Next.js** repository, deployed serverlessly on **Vercel**.

| Layer | Technology | Operational Role |
| :--- | :--- | :--- |
| **Framework** | Next.js 14+ (App Router) | React client components + native Node.js API/Serverless routes |
| **Styling** | Tailwind CSS + CSS Modules | Cyberpunk/holographic styling, custom animations, responsive layouts |
| **Database** | Neon (PostgreSQL) | Persistent state, chat histories, sprint logs, Obsidian sync cache |
| **ORM** | Prisma | Type-safe queries and automated schema migrations |
| **Authentication** | Neon Auth | Session cookie + AppUser whitelist (`getAuthorizedUser`) |
| **AI Processing** | Vercel AI SDK + Anthropic API | Streaming conversational tokens, structured synthesis, Obsidian NLP |
| **External APIs** | Google Calendar API, GitHub GraphQL API, OpenWeatherMap | Schedules, coding throughput, ambient context |
| **Obsidian Bridge** | Obsidian Local REST API plugin + MCP Server | Bidirectional vault read/write from JARVIS command layer |

### Key Environment Variables

```env
# Auth (Neon Auth — not NextAuth)
NEON_AUTH_BASE_URL=
NEON_AUTH_COOKIE_SECRET=
AUTHORIZED_EMAIL=

# Database
DATABASE_URL=

# AI
ANTHROPIC_API_KEY=

# Integrations
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_REFRESH_TOKEN=
GITHUB_PAT=
OPENWEATHER_API_KEY=
OPENWEATHER_LAT=
OPENWEATHER_LON=

# Obsidian
OBSIDIAN_API_KEY=       # Local REST API plugin key
OBSIDIAN_VAULT_PORT=    # Default: 27123
```

---

## 🏗️ 2. Core Modules & Component Architecture

### Module A: The Gatekeeper (Security & Middleware)

Zero-Trust philosophy — the dashboard is locked to a single authenticated identity.

**Implementation Details:**

```
middleware.ts
  ├── Match pattern: ["/((?!api/auth|login|_next).*)"]
  ├── Read token via getToken({ req, secret })
  ├── If token.email !== process.env.AUTHORIZED_EMAIL → redirect("/login")
  └── If no token → redirect("/login")
```

- OAuth scopes required: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar`
- Session strategy: `jwt` (stateless, no DB session table needed)
- `/login` page: full-screen dark splash with animated JARVIS boot sequence and a single OAuth button
- Rate limiting: apply `@upstash/ratelimit` on all `/api/*` routes (10 req/10s per IP as a baseline)

**Buildable Checklist:**
- [ ] `npm install next-auth@beta @auth/core`
- [ ] Create `auth.config.ts` with Google provider
- [ ] Create `middleware.ts` with email whitelist guard
- [ ] Create `app/login/page.tsx` with OAuth trigger button

---

### Module B: The Command Center (Conversational Engine)

Central human-machine interface styled as a command terminal.

**State Shape:**
```ts
type Session = { id: string; title: string; createdAt: Date }
type Message = { id: string; sender: "USER" | "SOLOMON"; content: string; createdAt: Date }

// Client state
const [sessions, setSessions] = useState<Session[]>([])
const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
```

**Vercel AI SDK Integration:**
```ts
// app/api/chat/route.ts — Neon Auth on this route, not NextAuth
import { streamText, convertToModelMessages } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { getAuthorizedUser } from "@/lib/getUser"

export async function POST(req: Request) {
  const auth = await getAuthorizedUser()
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: auth.status })

  const { messages, sessionId } = await req.json()
  const result = streamText({
    model: anthropic("claude-sonnet-5"),
    system: SOLOMON_SYSTEM_PROMPT, // persona: SOLOMON — Your personal counsel.
    messages: await convertToModelMessages(messages),
    onFinish: async ({ text }) => {
      await db.message.createMany({ data: [userMsg, { content: text, sender: "SOLOMON", sessionId }] })
    }
  })
  return result.toUIMessageStreamResponse()
}
```

**UI Components:**
- `<SessionSidebar />` — lists sessions from Postgres via `/api/sessions`, supports rename on double-click, delete on hover
- `<MessageFeed />` — virtualized scroll (use `react-virtuoso` for perf), streams tokens via `useChat`
- `<TerminalInput />` — cyan-bordered textarea with slash-command detection (`/brief`, `/note`, `/search`)
- Slash commands are parsed and marked on `Message.command` (Wave 1 stub). Later waves add Obsidian handlers.

**Buildable Checklist:**
- [ ] `npm install ai @ai-sdk/anthropic react-virtuoso`
- [ ] Implement `useChat` hook wired to `/api/chat`
- [ ] Persist session + messages on `onFinish` callback
- [ ] Add slash-command parser in `TerminalInput` (intercept `/` prefix)

---

### Module C: DevVitals (Engineering Matrix)

Monitors software engineering throughput via GitHub GraphQL.

**GitHub GraphQL Query:**
```graphql
query DevVitals($username: String!) {
  user(login: $username) {
    contributionsCollection {
      totalCommitContributions
      contributionCalendar {
        weeks {
          contributionDays { contributionCount date weekday }
        }
      }
    }
    pullRequests(first: 5, states: OPEN, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes { title url repository { name } updatedAt }
    }
  }
}
```

**API Route:** `GET /api/github` — fetches and returns structured JSON, cached in Supabase with a 5-minute TTL.

**UI Components:**
- `<ContributionGrid />` — renders a glowing green 7-column week matrix from `contributionCalendar`, color-scaled by count
- `<PRTracker />` — live list of open PRs with repo name, last-updated timestamp, and external link
- `<CommitVelocity />` — rolling 7-day bar chart using a lightweight `recharts` `BarChart`

**Buildable Checklist:**
- [ ] Store `GITHUB_PAT` in Vercel env vars
- [ ] Build `/api/github` route with GraphQL fetch + Supabase cache
- [ ] Build `<ContributionGrid />` from raw `contributionDays` array
- [ ] Poll from client every 5 minutes using `setInterval` + `useSWR`

---

### Module D: Chronos Grid (Google Calendar Synchronization)

Bidirectional pipeline for real-world scheduling.

**API Routes:**
```
GET  /api/calendar        → Fetch today's events (timeMin: startOfDay, timeMax: endOfDay)
POST /api/calendar        → Create event { summary, start, end, description }
PATCH /api/calendar/[id]  → Reschedule event
DELETE /api/calendar/[id] → Delete event
```

**Google Calendar fetch pattern:**
```ts
import { google } from "googleapis"
const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET)
auth.setCredentials({ refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN })
const calendar = google.calendar({ version: "v3", auth })
const res = await calendar.events.list({ calendarId: "primary", timeMin, timeMax, singleEvents: true })
```

**UI Components:**
- `<ChronosGrid />` — 24-hour vertical timeline, events rendered as colored blocks
- `<EventModal />` — form for create/edit/delete, opens on block click or empty slot click
- Real-time polling: re-fetch every 60 seconds, highlight events starting within 15 minutes with amber glow

**Buildable Checklist:**
- [ ] `npm install googleapis`
- [ ] Generate and store `GOOGLE_CALENDAR_REFRESH_TOKEN` via OAuth playground
- [ ] Build all 4 CRUD routes
- [ ] Build `<ChronosGrid />` with 15-minute slot resolution

---

### Module E: The Chrono-Sprint Matrix (Pomodoro Engine)

Localized focus engine combining sprint intervals with execution tracking.

**State Machine (useReducer):**
```ts
type TimerState = {
  mode: "FOCUS" | "SHORT_BREAK" | "LONG_BREAK" | "IDLE"
  secondsLeft: number
  sprintsCompleted: number
  activeTask: string | null
  isRunning: boolean
}

type TimerAction =
  | { type: "START" } | { type: "PAUSE" } | { type: "RESET" }
  | { type: "TICK" } | { type: "CYCLE_COMPLETE" }
  | { type: "SET_TASK"; task: string }
```

**Cycle Logic:**
- Focus: 25 min → Short Break: 5 min → repeat × 4 → Long Break: 15 min
- All durations configurable from a settings panel stored in `localStorage`

**Audio Alert (Web Audio API):**
```ts
function playChime() {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.frequency.setValueAtTime(880, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1)
  osc.start(); osc.stop(ctx.currentTime + 1)
}
```

**Sprint Logging:** On `CYCLE_COMPLETE`, POST to `/api/sprints` → writes `SprintSession` to DB with `taskName`, `duration`, `completedAt`.

**UI Components:**
- `<ChronoMatrix />` — circular SVG progress ring with glowing stroke, large countdown display
- `<TaskBinder />` — text input to name the active mission, appears below the timer
- `<SprintLog />` — compact table of today's completed sprints pulled from DB

**Buildable Checklist:**
- [ ] Implement `useReducer` timer state machine
- [ ] Build SVG circular progress ring (use `stroke-dasharray` / `stroke-dashoffset`)
- [ ] Wire `playChime()` to `CYCLE_COMPLETE` action
- [ ] Build `POST /api/sprints` route + `SprintSession` DB writes

---

### Module F: The Tactical Briefing Engine

Aggregates live context and pipes it through Claude to generate a structured JARVIS initialization report.

**Aggregation Flow:**
```
POST /api/brief
  ├── Promise.allSettled([
  │     fetchWeather(lat, lon),        // OpenWeatherMap current + forecast
  │     fetchCalendarEvents(),          // Today's calendar from /api/calendar
  │     fetchGitHubVitals(),            // Commits + PRs from /api/github
  │     fetchObsidianDailyNote()        // Today's note from Module G (if exists)
  │   ])
  ├── Compile into structured context object
  ├── Build system prompt with JARVIS persona
  └── Stream response via Anthropic SDK
```

**System Prompt Template:**
```
You are J.A.R.V.I.S. — Just A Rather Very Intelligent System.
Tone: analytical, precise, subtly witty. No filler phrases.

Today's operational context:
- Date/Time: {datetime}
- Weather: {temp}°F, {condition}. Feels like {feelsLike}°F.
- Calendar: {eventCount} events today. Next: "{nextEvent}" at {nextEventTime}.
- GitHub: {commitCount} commits this week. {openPRCount} open PRs.
- Obsidian: Today's note has {wordCount} words. Open tasks: {taskCount}.

Generate a structured morning initialization brief with these sections:
1. SYSTEM STATUS — operational summary in 2 sentences
2. PRIORITY QUEUE — top 3 action items ranked by urgency
3. SCHEDULE MATRIX — key time blocks for the day
4. DIRECTIVE — one motivational operational directive
```

**Buildable Checklist:**
- [ ] Build `POST /api/brief` aggregator route
- [ ] Wire `Promise.allSettled` for resilient parallel fetching (failures should degrade gracefully)
- [ ] Build `<BriefingPanel />` that renders streamed markdown with typewriter effect
- [ ] Add "Run Brief" button to dashboard header, triggered on load + manually

---

---

## 🧠 2.5 Obsidian as the Agent's Persistent Brain

This section defines the philosophy and architecture for using Obsidian not as a passive note store, but as the **living long-term memory of the JARVIS AI agent** — the system's external cognitive layer that persists knowledge, context, and self-reflection across every session.

### Why Obsidian Instead of a Vector DB

Most AI agent memory systems rely on hidden vector databases (Pinecone, Chroma, pgvector). Obsidian offers a critical advantage: **the memory is yours, readable, editable, and linked**. You can inspect exactly what JARVIS knows, correct misunderstandings by editing a note, and build a knowledge graph that evolves with you — not inside an opaque embedding store.

| Property | Vector DB | Obsidian Vault |
| :--- | :--- | :--- |
| Human-readable | ✗ | ✅ |
| Editable by user | ✗ | ✅ |
| Linked / relational | ✗ | ✅ (wikilinks) |
| Semantic search | ✅ | ✅ (via Claude) |
| Persistent across deploys | ✅ | ✅ (iCloud sync) |
| Agent self-writes | Possible | ✅ native |

### The Three Memory Layers

```
┌─────────────────────────────────────────────────────────────┐
│                        JARVIS MEMORY MODEL                   │
├──────────────────┬──────────────────┬────────────────────────┤
│  WORKING MEMORY  │  LONG-TERM MEMORY│   PROCEDURAL MEMORY    │
│  (Context Window)│  (Obsidian Vault)│   (Obsidian Vault)     │
│                  │                  │                        │
│  Current convo   │  Episodic:       │  How-to notes          │
│  Active session  │  past decisions, │  Workflow templates     │
│  Injected vault  │  key events,     │  Agent instructions    │
│  context (RAG)   │  conversation    │  Slash command docs    │
│                  │  summaries       │  Project playbooks     │
│                  │                  │                        │
│                  │  Semantic:       │                        │
│                  │  facts, concepts,│                        │
│                  │  preferences,    │                        │
│                  │  learned rules   │                        │
└──────────────────┴──────────────────┴────────────────────────┘
```

### Agent Memory Lifecycle

```
User sends message
        │
        ▼
┌────────────────────┐
│  1. RETRIEVE       │  Query vault for relevant notes (RAG)
│  Memory Retrieval  │  Inject top matches into system prompt
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  2. REASON         │  Claude reasons with current input
│  (Context Window)  │  + injected long-term memory context
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  3. ACT            │  Stream response to user
│  Response          │  Execute any slash commands
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  4. REFLECT        │  After session ends (or on /save):
│  Memory Write-back │  Claude summarizes key decisions/facts
│                    │  Writes structured notes to vault
└────────────────────┘
```

### Vault Folder Structure (Agent Brain)

```
Obsidian Vault/
├── Agent/
│   ├── Memory/
│   │   ├── Episodic/
│   │   │   ├── 2026-05-16-session-summary.md   ← auto-written by JARVIS
│   │   │   └── 2026-05-15-session-summary.md
│   │   ├── Semantic/
│   │   │   ├── User-Preferences.md             ← JARVIS learns your preferences
│   │   │   ├── Project-Context.md              ← ongoing project knowledge
│   │   │   └── Technical-Decisions.md          ← architectural decisions log
│   │   └── Procedural/
│   │       ├── Agent-Instructions.md           ← custom JARVIS behavior rules
│   │       ├── Workflows.md                    ← repeatable task playbooks
│   │       └── Slash-Command-Docs.md
│   ├── Goals/
│   │   ├── Current-Sprint.md                   ← active priorities
│   │   └── Long-Term-Objectives.md
│   └── Knowledge/
│       └── (any topic notes you want JARVIS to know)
├── Daily/
│   └── YYYY-MM-DD.md                           ← briefing-generated daily notes
└── Dev/
    └── ProjectName/                            ← project-specific notes
```

### Context Injection (RAG Pipeline)

Before every Claude API call, JARVIS runs a retrieval step to select the most relevant vault notes to include in the system prompt. This keeps the agent grounded in your personal context without blowing the context window.

**Retrieval Strategy (two-stage):**

```
Stage 1 — Keyword filter (fast)
  → Query Obsidian REST API full-text search with key terms from the user message
  → Returns candidate note paths + excerpts

Stage 2 — Relevance ranking (Claude Haiku)
  → Send candidate excerpts + user message to Claude Haiku (cheap, fast)
  → Ask: "Rank these by relevance to the user's message. Return top 3 paths."
  → Fetch full content of top 3 notes

Inject into system prompt:
  --- LONG-TERM MEMORY CONTEXT ---
  [User-Preferences.md content]
  [Project-Context.md content]
  [Relevant session summary]
  --------------------------------
```

**Token budget:** Cap injected context at ~2,000 tokens. Truncate older episodic notes before semantic ones.

### Memory Write-back (Reflection)

At the end of each chat session (triggered by `/save`, session close, or every 10 messages), JARVIS runs a reflection pass:

```ts
// POST /api/memory/reflect
// 1. Send full conversation to Claude with reflection prompt:
const reflectionPrompt = `
  Review this conversation. Extract and output a structured memory note with:
  ## Key Decisions
  (any architectural, personal, or project decisions made)
  ## New Facts Learned About the User
  (preferences, constraints, context)
  ## Action Items
  (tasks mentioned, follow-ups needed)
  ## Links to Existing Notes
  (suggest [[wikilinks]] to relevant vault notes)
`
// 2. Write the structured output to:
//    Agent/Memory/Episodic/YYYY-MM-DD-session-{id}.md
// 3. If new preferences discovered → PATCH Agent/Memory/Semantic/User-Preferences.md
```

### Agent-Editable Knowledge Base

JARVIS can update its own semantic memory in response to explicit user instructions:

- `"Remember that I prefer TypeScript strict mode"` → appends to `User-Preferences.md`
- `"Forget the old API approach, we're using tRPC now"` → updates `Technical-Decisions.md`
- `"Add this to the project context"` → appends to `Project-Context.md`

These are treated as privileged `/memory` commands with confirmation before write.

---

### Module G: The Obsidian Intelligence Layer *(Expanded)*

A bidirectional bridge and persistent memory system between JARVIS and your Obsidian vault — the agent's external brain.

**Architecture:**
```
JARVIS Terminal Input
  └── Slash Command Parser
        ├── /note  → VaultWriter   → Obsidian REST API → Creates/appends note
        ├── /search → VaultSearch  → Obsidian REST API → Returns matching notes
        ├── /task  → TaskSync      → Obsidian REST API → Reads/writes task items
        └── /recall → NLPSearch   → Claude + Vault index → Semantic note retrieval
```

**Obsidian Local REST API Setup:**
- Install the **Obsidian Local REST API** community plugin in Obsidian
- Enable HTTPS, set an API key, default port `27123`
- Expose via JARVIS backend — the Next.js server proxies requests to `localhost:27123` so the API key never reaches the client

**Next.js Proxy Route:** `app/api/obsidian/[...path]/route.ts`
```ts
export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  const vaultPath = params.path.join("/")
  const res = await fetch(`https://localhost:${OBSIDIAN_VAULT_PORT}/${vaultPath}`, {
    headers: { Authorization: `Bearer ${OBSIDIAN_API_KEY}` }
  })
  return new Response(res.body, { headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" } })
}
```

**Slash Commands & Handlers:**

| Command | Syntax | Behavior |
| :--- | :--- | :--- |
| `/note [title] [content]` | `/note Meeting recap We discussed X...` | Creates or appends to a note at `Daily/YYYY-MM-DD.md` or named path |
| `/search [query]` | `/search authentication flow` | Full-text search across vault, returns top 5 matches with excerpts |
| `/task [item]` | `/task Review PR #42` | Appends `- [ ] Review PR #42` to today's daily note |
| `/recall [natural language]` | `/recall what did I decide about auth?` | Two-stage RAG retrieval + Claude synthesis over vault |
| `/memory [instruction]` | `/memory Remember I prefer Zustand over Redux` | Writes structured fact to `Agent/Memory/Semantic/User-Preferences.md` |
| `/save` | `/save` | Triggers session reflection — Claude summarizes and writes episodic memory note |
| `/goals` | `/goals` | Reads and displays `Agent/Goals/Current-Sprint.md` |
| `/brief` | `/brief` | Triggers Module F briefing engine |

**Daily Note Integration:**
- On each morning briefing (Module F), JARVIS auto-creates or updates the daily note at `Daily/YYYY-MM-DD.md`
- Injects: JARVIS brief output, today's calendar events, GitHub status, weather block
- Format uses Obsidian frontmatter for metadata + Dataview compatibility:

```markdown
---
date: 2026-05-16
jarvis_briefed: true
weather: 72°F, Partly Cloudy
commits_today: 4
---

## JARVIS Morning Brief
{streamed brief content}

## Tasks
- [ ] 

## Notes

```

**NLP Recall Flow (`/recall`):**
```
1. Fetch all vault file names + first 200 chars → build index payload
2. Send index + user query to Claude:
   "Given these Obsidian notes, which are most relevant to: '{query}'?
    Return the top 3 file paths."
3. Fetch full content of returned files via Obsidian REST API
4. Send full content + query to Claude for synthesis
5. Stream answer back to JARVIS terminal
```

**UI Components:**
- Slash command autocomplete dropdown in `<TerminalInput />` (appears after `/`)
- `<VaultSearchResults />` — card list showing matched note title, path, and excerpt
- `<ObsidianStatusIndicator />` — small indicator in dashboard header showing vault connection state (green pulse = connected)

**Full API Route Map for Module G:**

```
GET  /api/obsidian/[...path]       → Proxy to Obsidian REST API (read)
POST /api/obsidian/[...path]       → Proxy to Obsidian REST API (write)

POST /api/obsidian/note            → Create/append a note
GET  /api/obsidian/search?q=       → Full-text vault search (top 5 results)
POST /api/obsidian/task            → Append task to daily note
POST /api/obsidian/recall          → Two-stage RAG: search → rank → fetch → synthesize
POST /api/obsidian/memory          → Write structured fact to semantic memory note
POST /api/memory/reflect           → End-of-session reflection → episodic memory write
GET  /api/memory/context?q=        → RAG retrieval pipeline (used internally before chat)
GET  /api/obsidian/goals           → Read Agent/Goals/Current-Sprint.md
```

**RAG Context Injection — Integration into `/api/chat`:**
```ts
// app/api/chat/route.ts (updated)
export async function POST(req: Request) {
  const { messages, sessionId } = await req.json()
  const lastUserMessage = messages.at(-1)?.content ?? ""

  // Retrieve relevant vault context before reasoning
  const memoryContext = await fetch("/api/memory/context?q=" + encodeURIComponent(lastUserMessage))
  const { injectedNotes } = await memoryContext.json()

  const result = streamText({
    model: anthropic("claude-opus-4-5"),
    system: buildSystemPrompt(injectedNotes),  // ← vault context injected here
    messages,
    onFinish: async ({ text }) => {
      await persistMessages(sessionId, lastUserMessage, text)
      await maybeReflect(sessionId, messages.length)  // reflect every 10 messages
    }
  })
  return result.toDataStreamResponse()
}
```

**Buildable Checklist:**
- [ ] Install Obsidian Local REST API plugin, enable HTTPS, store key in env vars
- [ ] Build `/api/obsidian/[...path]` proxy route in Next.js
- [ ] Add slash command parser to `<TerminalInput />` with autocomplete dropdown
- [ ] Implement `/note`, `/search`, `/task` handlers
- [ ] Implement `/recall` two-stage RAG handler (keyword search → Haiku ranking → full fetch → synthesis)
- [ ] Implement `/memory` handler for semantic memory writes with user confirmation step
- [ ] Build `/api/memory/reflect` session reflection endpoint
- [ ] Build `/api/memory/context` RAG retrieval pipeline and wire into `/api/chat` pre-call
- [ ] Create vault folder scaffold: `Agent/Memory/Episodic/`, `Agent/Memory/Semantic/`, `Agent/Memory/Procedural/`, `Agent/Goals/`
- [ ] Seed `Agent/Memory/Semantic/User-Preferences.md` and `Agent/Memory/Procedural/Agent-Instructions.md` with initial content
- [ ] Wire daily note auto-generation into Module F briefing route
- [ ] Build `<ObsidianStatusIndicator />` using `GET /api/obsidian/` health check
- [ ] Build `<MemoryPanel />` sidebar component showing recent episodic notes and injected context for the current session

---

## 🎨 3. Design System & UI Aesthetics

**Color Palette:**
- Background Core: `#030712`, `#0b1329`
- Primary Accents (Cyan): `#06b6d4`, `#22d3ee`
- Alert/Critical: Amber `#f59e0b`, Crimson `#ef4444`
- Success/Obsidian: Violet `#8b5cf6` *(used for vault-connected elements)*
- Text: `#94a3b8` (context), `#ffffff` (primary)

**Reusable Style Tokens (Tailwind classes):**
```
Panel:        bg-[#0b1329] border border-white/5 rounded-xl p-4
Glow hover:   hover:shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-shadow
Glow violet:  shadow-[0_0_10px_rgba(139,92,246,0.4)]   ← Obsidian elements
Input:        bg-[#030712] border border-cyan-500/40 focus:border-cyan-400 rounded-lg
Grid lines:   bg-gradient-to-b from-transparent via-white/[0.02] to-transparent
```

**Animation Patterns:**
- Boot sequence: CSS keyframe `glitch` on module titles (translate + opacity flicker, 300ms)
- Streaming text: typewriter via `@tailwindcss/typography` + custom `prose-invert` config
- Sprint ring: SVG `stroke-dashoffset` transition with `ease-linear` for smooth countdown
- Obsidian recall: fade-in card stack with 50ms stagger delay per result

**Layout Grid (dashboard root):**
```
┌─────────────────────────────────────────────────────┐
│                   Header / Briefing Bar              │
├──────────────┬──────────────────────┬────────────────┤
│  Session     │   Message Feed       │  DevVitals     │
│  Sidebar     │   (Command Center)   │  (GitHub)      │
│  (Module B)  │                      │  (Module C)    │
│              ├──────────────────────┤                │
│              │   Terminal Input     │  ChronoMatrix  │
│              │   (slash commands)   │  (Module E)    │
├──────────────┴──────────────────────┴────────────────┤
│              Chronos Grid (Calendar) Module D         │
└─────────────────────────────────────────────────────┘
```

---

## 💾 4. Database Schema (Prisma)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?
  sessions      Session[]
  sprintSessions SprintSession[]
  obsidianSyncs  ObsidianSync[]
  createdAt     DateTime       @default(now())
}

model Session {
  id        String    @id @default(cuid())
  userId    String    // neon_auth user id — no NextAuth / User FK
  title     String    @default("New Intelligence Feed")
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@map("chat_sessions")
}

model Message {
  id          String   @id @default(cuid())
  sessionId   String
  session     Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  sender      String   // "USER" | "SOLOMON"
  content     String   @db.Text
  command     String?  // e.g. "/note", "/recall", "/brief" — null for plain chat
  createdAt   DateTime @default(now())

  @@map("chat_messages")
}

model SprintSession {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  taskName    String?
  duration    Int      // minutes
  mode        String   @default("FOCUS") // "FOCUS" | "SHORT_BREAK" | "LONG_BREAK"
  completed   Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model BriefingCache {
  id          String   @id @default(cuid())
  date        String   @unique  // "YYYY-MM-DD"
  content     String   @db.Text
  contextJson Json     // raw aggregated context payload
  createdAt   DateTime @default(now())
}

// Tracks Obsidian notes that JARVIS has written or read
model ObsidianSync {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  notePath    String   // vault-relative path e.g. "Daily/2026-05-16.md"
  action      String   // "READ" | "WRITE" | "APPEND" | "SEARCH"
  queryText   String?  // for /recall queries
  createdAt   DateTime @default(now())
}
```

---

## 🛠️ 5. Phase-by-Phase Claude Prompt Sequence

### Phase 1: Environment Initialization & Folder Scaffolding
> **Prompt to Claude:**
> "I am building a personal, highly secure Jarvis-inspired developer dashboard using Next.js 14 (App Router), Tailwind CSS, Prisma, and Supabase. Provide the exact terminal commands to initialize the project with npm. Output the full directory structure optimized for reusable dashboard components, serverless route integrations, and global context providers. Include a complete `app/layout.tsx` with a dark space theme backdrop, a root CSS file with the following custom Tailwind tokens: background `#030712`, accent cyan `#06b6d4`, accent violet `#8b5cf6`. Also include a `lib/db.ts` Prisma client singleton."

### Phase 2: Whitelisted Identity & Gatekeeper Middleware
> **Prompt to Claude:**
> "Generate complete Auth.js (NextAuth v5) configuration using a Google OAuth provider for Next.js App Router. Produce three files: `auth.config.ts` (provider definition), `auth.ts` (exported handlers and `auth` helper), and `middleware.ts`. The middleware must match all paths except `/api/auth/**`, `/login`, and `/_next/**`. It must decode the JWT session token and compare `token.email` against `process.env.AUTHORIZED_EMAIL`. On mismatch or missing token, redirect to `/login`. Also produce `app/login/page.tsx`: a full-screen dark splash page with a centered 'SYSTEM ACCESS' heading and a single Google sign-in button styled with a cyan glow border."

### Phase 3: The Command Interface Shell (UI Grid)
> **Prompt to Claude:**
> "Build a complete Next.js App Router page at `app/dashboard/page.tsx` implementing the JARVIS command interface. Use the Vercel AI SDK `useChat` hook connected to `/api/chat`. The layout must use CSS Grid with three columns: a 240px session sidebar on the left, a flexible message feed in the center, and a 280px status panel on the right. The sidebar lists `Session` records fetched from `/api/sessions` with hover glow states and a 'New Session' button. The message feed renders `Message` records with different alignment and color for USER vs JARVIS. Include a fixed `<TerminalInput />` at the bottom of the center column that detects messages starting with `/` and logs them as slash commands before submission. Style everything using only Tailwind CSS with the design tokens: bg `#030712`, panels `#0b1329`, borders `border-white/5`, text `#94a3b8`."

### Phase 4: Integration Engine — Google Calendar & GitHub Tracker
> **Prompt to Claude:**
> "Write two Next.js App Router API routes. Route 1: `app/api/calendar/route.ts`. Use the `googleapis` npm package with a pre-configured `OAuth2` client using `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALENDAR_REFRESH_TOKEN` environment variables. On GET, fetch today's events from `timeMin` (midnight) to `timeMax` (11:59pm) and return a typed array of `{ id, summary, start, end, location }`. Route 2: `app/api/github/route.ts`. Make an authenticated POST to `https://api.github.com/graphql` using `GITHUB_PAT`. Run the contributionsCollection + pullRequests query for the authenticated user. Cache the response in Supabase with a 5-minute TTL check. Return structured JSON with `commitCount`, `openPRs[]`, and `contributionGrid[][]`."

### Phase 5: The Chrono-Sprint Matrix Interface
> **Prompt to Claude:**
> "Create a client-side React component `components/ChronoMatrix.tsx` for the JARVIS dashboard. Implement a Pomodoro timer using `useReducer` with states: `IDLE`, `FOCUS` (25 min), `SHORT_BREAK` (5 min), `LONG_BREAK` (15 min). After 4 focus sprints, automatically transition to LONG_BREAK. Render a circular SVG progress ring using `stroke-dasharray` and `stroke-dashoffset` with a glowing cyan stroke (`filter: drop-shadow(0 0 6px #06b6d4)`). Include a text input to bind an active task name to the session. On sprint completion, fire a Web Audio API chime (880Hz → 440Hz oscillator over 1 second) and POST `{ taskName, duration, mode }` to `POST /api/sprints`. Also create the `app/api/sprints/route.ts` handler that writes to the `SprintSession` Prisma model."

### Phase 6: The Tactical Briefing Engine
> **Prompt to Claude:**
> "Build a streaming Next.js API route at `app/api/brief/route.ts`. It must use `Promise.allSettled` to concurrently fetch: (1) OpenWeatherMap current weather using `OPENWEATHER_API_KEY`, `OPENWEATHER_LAT`, `OPENWEATHER_LON`; (2) today's Google Calendar events from the internal `/api/calendar` route; (3) GitHub vitals from the internal `/api/github` route. Compile all results into a structured context object (gracefully handle any failed promises with fallback strings). Build a JARVIS system prompt that includes weather, schedule, and GitHub status. Use the Vercel AI SDK `streamText` function with `@ai-sdk/anthropic` and stream the response. The AI persona must be J.A.R.V.I.S. — precise, analytical, slightly witty, no filler. Save the briefing text to the `BriefingCache` Prisma model keyed by today's date."

### Phase 7: The Obsidian Intelligence Layer — Commands & Proxy
> **Prompt to Claude:**
> "Build the Obsidian integration layer for my JARVIS dashboard. First, create a proxy API route at `app/api/obsidian/[...path]/route.ts` that forwards all GET/POST/PUT requests to `https://localhost:${process.env.OBSIDIAN_VAULT_PORT}` with the `Authorization: Bearer ${process.env.OBSIDIAN_API_KEY}` header, returning the proxied response. Second, build these slash-command handler routes: (1) `POST /api/obsidian/note` — accepts `{ title?, content }`, writes or appends to `Daily/YYYY-MM-DD.md`; (2) `GET /api/obsidian/search?q=` — returns top 5 results as `{ path, excerpt }[]`; (3) `POST /api/obsidian/task` — appends a `- [ ] {task}` line to today's daily note; (4) `POST /api/obsidian/recall` — two-stage RAG: keyword search → Haiku relevance ranking → fetch full content of top 3 notes → stream Claude synthesis; (5) `GET /api/obsidian/goals` — reads and returns `Agent/Goals/Current-Sprint.md` content. Log all actions to the `ObsidianSync` Prisma model. Update `<TerminalInput />` to show an autocomplete dropdown with all slash commands when the user types `/`."

### Phase 8: Obsidian Agent Brain — Memory & RAG Pipeline
> **Prompt to Claude:**
> "Implement the Obsidian-as-agent-brain memory system for my JARVIS dashboard. Build three components: (1) `app/api/memory/context/route.ts` — a GET route that accepts `?q=` (the user's latest message). It performs a full-text Obsidian search for key terms, sends candidate excerpts to Claude Haiku to rank relevance, fetches the top 3 note contents, and returns `{ injectedNotes: string }` capped at 2,000 tokens. (2) `app/api/memory/reflect/route.ts` — a POST route that accepts `{ messages[], sessionId }`. It sends the full conversation to Claude with a structured reflection prompt that extracts: key decisions, new user preferences, action items, and suggested wikilinks. It writes the structured output as a markdown note to `Agent/Memory/Episodic/YYYY-MM-DD-session-{id}.md` via the Obsidian proxy, and if new preferences are found, PATCHes `Agent/Memory/Semantic/User-Preferences.md`. (3) `POST /api/obsidian/memory` — accepts `{ instruction }` (e.g. 'Remember I prefer Zustand'), sends it to Claude to extract a structured fact, formats it as a markdown bullet, and appends it to the appropriate semantic memory note with a user confirmation step. Finally, update `app/api/chat/route.ts` to call `/api/memory/context` before each `streamText` call, inject the returned notes into the system prompt under a `--- LONG-TERM MEMORY ---` header, and call `/api/memory/reflect` automatically every 10 messages in a session."

---

## 🚀 6. Step-by-Step Execution Checklist

- [ ] **Step 1:** Run structural initialization, configure Tailwind tokens, push base project to Vercel with environment variables set.
- [ ] **Step 2:** Configure Auth.js with Google OAuth, deploy gatekeeper middleware, verify `/login` redirect blocks unauthorized access.
- [ ] **Step 3:** Run Prisma migrations against Supabase. Confirm all models (`User`, `Session`, `Message`, `SprintSession`, `BriefingCache`, `ObsidianSync`) are created.
- [x] **Step 4:** Build Command Center UI — session sidebar, message feed, streaming chat, terminal input with slash command detection.
- [ ] **Step 5:** Integrate Calendar and GitHub API routes. Confirm secure token passing from NextAuth to server-side handlers. Render `<ChronosGrid />` and `<DevVitals />`.
- [ ] **Step 6:** Build and test `<ChronoMatrix />` — timer cycles, audio chime, sprint logging to DB.
- [ ] **Step 7:** Wire up Briefing Engine. Confirm `Promise.allSettled` aggregation, JARVIS persona stream, and `BriefingCache` DB write.
- [ ] **Step 8:** Install Obsidian Local REST API plugin. Build proxy route and all slash-command handlers. Test `/note`, `/search`, `/task`, `/recall`, `/goals` end-to-end.
- [ ] **Step 9:** Scaffold vault agent brain folder structure. Seed `User-Preferences.md` and `Agent-Instructions.md` with initial content.
- [ ] **Step 10:** Build RAG memory pipeline — `/api/memory/context` retrieval route. Wire into `/api/chat` pre-call. Verify injected context appears in Claude system prompt.
- [ ] **Step 11:** Build `/api/memory/reflect` session reflection endpoint. Test that episodic memory note is auto-written after 10 messages and on `/save`.
- [ ] **Step 12:** Build `/api/obsidian/memory` preference-write handler with confirmation step. Test `/memory Remember that I prefer X` end-to-end.
- [ ] **Step 13:** Wire daily note auto-generation into briefing engine. Confirm Obsidian note created/updated on each `/brief` run with frontmatter + JARVIS brief content.
- [ ] **Step 14:** Final polish — boot sequence animations, `<ObsidianStatusIndicator />`, `<MemoryPanel />` sidebar, performance audit, mobile layout.

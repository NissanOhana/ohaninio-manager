# Architecture & Tech Stack

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | **Bun** | No Node.js — Bun for server, bundler, package manager |
| Language | **TypeScript** (ES2022, strict) | ESM with `.js` extensions in imports |
| Server | **Bun.serve()** | HTTP + WebSocket on same port (4201). No Express/Hono/etc. |
| Frontend | **React 19** | Latest React with Vite 6 dev server |
| Build | **Vite 6** (frontend) + **Bun.build** (backend) | 3-step build: Vite → Bun CLI → Bun server |
| Styling | **Tailwind CSS 3.4** | CSS custom properties for theming (`var(--bg-primary)`, etc.) |
| Charts | **Recharts 2.15** | For session activity bar charts |
| Icons | **Lucide React 0.469** | Consistent icon set |
| Utilities | **clsx 2.1** | Conditional classNames |
| Data Source | **Filesystem** (`~/.claude/`) | No database at all |
| Communication | **WebSocket** (push) + REST (initial load) | Server pushes updates, no client polling |

## Zero Backend Dependencies

The backend uses only Bun built-ins:
- `Bun.serve()` for HTTP/WS server
- `Bun.spawn()` for spawning Claude CLI subprocesses
- `Bun.build()` in the build script
- `fs` for low-level file I/O (openSync, readSync for performance)
- Child process: `ps` and `lsof` shell commands for process detection

## Data Model

All data comes from reading `~/.claude/` on disk:

```
~/.claude/
├── history.jsonl                    # Global prompt history (1800+ entries)
├── projects/
│   └── -Users-nissano-{project}/    # Encoded path as directory name
│       ├── sessions-index.json      # Session metadata (often stale!)
│       ├── {session-uuid}.jsonl     # Full conversation transcript
│       ├── memory/
│       │   └── MEMORY.md           # Per-project memory
│       └── {session-uuid}/
│           └── subagents/          # Sub-agent transcripts
└── usage-data/
    └── report.html                 # Insights report (HTML)
```

### Key data files:
- **sessions-index.json**: Contains `sessionId`, `summary`, `firstPrompt`, `messageCount`, `created`, `modified`, `gitBranch`, `prNumber`, `prUrl`, `isSidechain`, `name`. **Warning: often stale** — newer Claude Code versions don't always update it.
- **{uuid}.jsonl**: JSON Lines format. First line has metadata (sessionId, branch, cwd). Subsequent lines have `type: "user"` / `type: "assistant"` messages.
- **history.jsonl**: One line per prompt across all projects, with timestamp and project path.

## Server Architecture

```
File Watcher (recursive on ~/.claude/)
    ↓ debounce 100ms
buildOverviewData()  ←→  REST API /api/overview
    ↓
WebSocket broadcast to all clients
    ↓
{ type: "overview", data: {...} }

Process Scanner (every 5 seconds)
    ↓ ps aux | grep claude → lsof for CWD
getLiveSessions()
    ↓ diff against last known state
WebSocket broadcast (only if changed)
    ↓
{ type: "live_sessions", sessions: [...] }
```

## API Endpoints (13 total)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/overview` | Full dashboard data (projects, sessions, memory, stats) |
| `GET /api/projects` | All projects with metadata |
| `GET /api/projects/:name/sessions` | Sessions for a specific project |
| `GET /api/sessions/today` | All sessions modified today |
| `GET /api/sessions/live` | Currently running Claude processes |
| `GET /api/memory/:project` | Memory files for a project |
| `GET /api/memory/health` | Memory staleness across all projects |
| `GET /api/history/today` | Today's history entries |
| `GET /api/history/stats` | Stats (total, today, this week) |
| `GET /api/insights` | Parsed insights report data |
| `GET /api/insights/html` | Raw insights HTML |
| `GET /api/status` | Project priority statuses |
| `GET /api/runs` | Chat run history |

## Frontend Architecture

```
App.tsx
├── Header (page toggle: Dashboard | Agent, WS status, theme toggle)
├── useWebSocket (auto-reconnect, handles push messages)
├── useOverview (state: REST initial + WS push updates)
├── DashboardPage
│   ├── LiveSessions (hero — real process detection, thinking/idle)
│   ├── RecentSessions (today's sessions, clickable)
│   ├── SessionDetail (full session view with stats, first prompt)
│   ├── StatusCards (project priority cards)
│   ├── SessionChart (Recharts bar chart)
│   ├── MemoryHealth (staleness table)
│   ├── ProjectDetail (selected project deep-dive)
│   └── ChatPanel / AgentChatPanel (inline chat)
└── AgentPage (full-page agent chat with run history sidebar)
```

## Module Responsibility Map

| Module | Lines | Role |
|--------|-------|------|
| `src/server.ts` | ~170 | Server entry, file watcher, process scanner, WS broadcast |
| `src/cli.ts` | ~120 | CLI: start, status, install-skill, help |
| `src/api/routes.ts` | ~130 | REST router (regex-based, no framework) |
| `src/api/overview.ts` | ~35 | Shared `buildOverviewData()` aggregator |
| `src/data/sessions.ts` | ~340 | Session index + disk reconciliation + process detection |
| `src/data/status.ts` | - | Priority analysis (keyword + time heuristics) |
| `src/data/memory.ts` | - | Per-project memory file reader + staleness |
| `src/data/history.ts` | - | `history.jsonl` parser |
| `src/data/insights.ts` | - | Regex extraction from insights HTML report |
| `src/data/types.ts` | - | Shared TypeScript interfaces |
| `src/ws/handler.ts` | - | WS message handler, spawns `claude -p` for chat |
| `src/chat/run-store.ts` | - | In-memory chat run store (max 20) |

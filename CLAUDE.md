# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Ohaninio Manager is a Claude Code session orchestrator — a local tool that reads `~/.claude/` data (sessions, history, memory) and presents it via a web dashboard and CLI. It monitors all Claude Code projects on the machine, detects live sessions via process scanning, and pushes real-time updates over WebSocket.

## Commands

```bash
# Development (run both in separate terminals)
bun run dev           # Backend with hot reload (port 4201)
bun run dev:web       # Frontend Vite dev server (port 5174, proxies API/WS to 4201)

# Production build (outputs to dist/)
bun run build         # Builds frontend (Vite) + CLI + server (Bun.build)

# Run production server
bun run start         # Start server on port 4201

# CLI (after build or via bun src/cli.ts)
bun src/cli.ts start [--port=4201] [--open]
bun src/cli.ts status
bun src/cli.ts install-skill
```

No test framework is configured yet.

## Architecture

**Monorepo with two packages:**
- `src/` — Bun backend (TypeScript, runs on Bun runtime)
- `web/` — React 19 frontend (Vite 6, Tailwind 3, Recharts, Lucide icons)

Each has its own `package.json` and `tsconfig.json`. The root `tsconfig.json` uses `bun-types`.

**Data source:** All data comes from reading `~/.claude/` filesystem structures directly — there is no database. Session data lives in `~/.claude/projects/<encoded-path>/` directories with `sessions-index.json` and `.jsonl` files.

**Server (`src/server.ts`):** Bun.serve handles HTTP (REST API + static file serving for SPA) and WebSocket on the same port. In dev mode, the frontend runs separately on Vite's port.

**Push model — no polling:** The server watches `~/.claude/` recursively and broadcasts full overview data to all WebSocket clients on file changes (debounced 100ms). Live session detection uses `ps`/`lsof` process scanning every 5s, broadcasting only when session state changes. The frontend receives pushed state via `useWebSocket` hook — it only fetches REST on initial load and manual refresh.

**Backend module layout:**
- `src/api/routes.ts` — REST endpoint router (regex-based path matching, no framework)
- `src/api/overview.ts` — Aggregates all data modules into a single overview payload
- `src/data/sessions.ts` — Reads session index + reconciles with actual JSONL files on disk. Detects live Claude processes via `ps`/`lsof` and maps them to projects
- `src/data/status.ts` — Priority analysis (critical/in_progress/stable/dormant) using keyword matching + time heuristics
- `src/data/memory.ts` — Reads per-project `memory/` directories, computes staleness
- `src/data/history.ts` — Reads `~/.claude/history.jsonl`
- `src/data/insights.ts` — Extracts patterns from `~/.claude/usage-data/report.html` via regex
- `src/data/types.ts` — Shared TypeScript interfaces for all backend data
- `src/ws/handler.ts` — WebSocket message handler, spawns `claude -p` subprocess for chat
- `src/chat/run-store.ts` — In-memory store for chat run history (max 20 runs)

**Frontend structure:**
- `web/src/App.tsx` — Root with page toggle (Dashboard / Agent), header with WS status indicator
- `web/src/hooks/useWebSocket.ts` — WebSocket connection with auto-reconnect (3s)
- `web/src/hooks/useOverview.ts` — State management for overview data (REST initial + WS push)
- `web/src/lib/api.ts` — REST client + all TypeScript types for API responses
- `web/src/pages/` — DashboardPage, AgentPage
- `web/src/components/` — Organized by feature: `dashboard/`, `chat/`, `sidebar/`, `insights/`, `ui/`

**Styling:** Tailwind + CSS custom properties for theming (`var(--bg-primary)`, `var(--text-muted)`, etc.). Dark mode via `class` strategy.

**Build pipeline (`scripts/build.ts`):** Three steps — Vite builds frontend to `dist/web/`, Bun.build compiles `cli.ts` and `server.ts` to `dist/`. CLI gets shebang + executable permissions.

**Vite dev proxy:** In development, Vite at port 5174 proxies `/api` and `/ws` to the Bun server at port 4201.

## Key Patterns

- Project directory names are encoded paths: `/Users/nissano/foo` → `-Users-nissano-foo`
- Session data uses a hybrid approach: reads `sessions-index.json` then reconciles with actual `.jsonl` files on disk
- The chat feature spawns `claude -p` as a subprocess and streams `--output-format stream-json` events back through WebSocket
- All backend imports use `.js` extensions (ESM with Bun)
- No external backend dependencies — just Bun built-ins (`Bun.serve`, `Bun.spawn`, `Bun.build`)

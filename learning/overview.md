# Ohaninio Manager — What I Learned Across 5 Sessions

> Compiled from sessions on Feb 26-27, 2026. Five sessions covering research, design, build, polish, and documentation.

## Table of Contents

- [What It Is](#what-it-is)
- [How It Was Built (Session Timeline)](#session-timeline)
- [Architecture & Tech Stack](./architecture.md)
- [Key Technical Decisions](./decisions.md)
- [Bugs & Debugging Lessons](./bugs-and-debugging.md)
- [Unfinished Work & Future Plans](./future.md)

---

## What It Is

Ohaninio Manager is a **local Claude Code session orchestrator**. It reads the `~/.claude/` directory on your machine — session logs, history, memory files, insights — and surfaces everything through a real-time web dashboard and CLI.

**The problem it solves:** When you have 15+ projects and 100+ Claude Code sessions, there's no way to see what's running, what you worked on today, which projects need attention, or how your memory files are doing. This tool gives you a single pane of glass.

**Core capabilities:**
- Real-time dashboard showing live Claude Code processes (thinking vs idle)
- Session-level drill-down with summaries, first prompts, metadata
- Priority analysis (critical / in-progress / stable / dormant) per project
- Memory health tracking across all projects
- Full-page agent chat view with streaming responses
- CLI for quick status checks without opening a browser
- WebSocket push — no polling, server pushes updates as files change

**The name:** "Ohaninio" — a personal brand/handle for Nissan Ohana. The project was originally called `claude-orchestrator` and renamed in session 2.

---

## Session Timeline

### Session 1 — Research & Build (Feb 26, ~2h)
**Where:** `/Users/nissano/skills` → `/Users/nissano/claude-orchestrator/`

Started with deep research: Claude Code docs, session data structures on disk, existing open-source tools (claude-sessions, claude-insights, claude-mpm, claude-flow). Then brainstormed with the user to define the scope.

**Key user decisions:**
- Interface: Claude Code skill + web dashboard (not standalone CLI)
- All capabilities: dashboard + memory management + insights pipeline
- Real-time data with React/Vite local app
- Learn from premium-alpaka for UI/UX patterns

Built the entire orchestrator autonomously while user was AFK. Created backend (Bun server with 13 API endpoints), frontend (React 19 + Vite + Tailwind + Recharts), and the orchestrate skill. Then added light mode, alpaka-style agent chat, and live sessions view.

### Session 2 — New Repo & Refactor (Feb 27, ~2h 43m)
**Where:** `/Users/nissano/skills` → `/Users/nissano/ohaninio-manager/`

Executed a 5-phase plan:
1. Copied project to new repo `ohaninio-manager`
2. Split monolithic 508-line `src/index.ts` into 4 modules (server, routes, ws-handler, run-store)
3. Built full-page agent view with run history sidebar
4. Created CLI tool (start, status, install-skill, help)
5. Pushed to GitHub as public repo

Then planned (but didn't implement) the session-aware dashboard redesign.

### Session 3 — Session-Aware Dashboard + Process Detection (Feb 27, ~39m)
**Where:** `/Users/nissano/ohaninio-manager/`

The pivotal session. Implemented session-aware dashboard (RecentSessions, SessionDetail components). Then debugged a critical bug where "no live sessions" showed despite active Claude processes — root cause: stale `sessions-index.json` files. Fixed with disk-based session reconciliation.

Then rebuilt live session detection to use actual OS processes (`ps`/`lsof`) instead of file timestamps. Added thinking/idle status indicators.

### Session 4 — WebSocket Push + Architecture Docs (Feb 27, ~28m)
**Where:** `/Users/nissano/skills` → `/Users/nissano/ohaninio-manager/`

Replaced the 10-second client polling with WebSocket push. Server now watches `~/.claude/` and broadcasts full overview data on changes. Process scanner runs every 5s server-side. Created the Mermaid architecture diagram. Pushed everything to GitHub. Then planned a 4-task dashboard UX overhaul (not implemented).

### Session 5 — CLAUDE.md (Feb 27, ~18m)
**Where:** `/Users/nissano/ohaninio-manager/`

Ran `/init` to generate project documentation. Sub-agent explored 20+ files over 15 minutes. Created `CLAUDE.md` covering commands, architecture, module layout, and key patterns.

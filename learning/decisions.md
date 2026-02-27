# Key Technical Decisions

Decisions made across the 5 sessions, with context on why.

## 1. Bun-Only Backend (No Express, No Hono)

**Decision:** Use only `Bun.serve()` built-ins for the entire server.

**Why:** The app runs locally on the developer's machine. There's no need for middleware chains, auth layers, or framework abstractions. `Bun.serve()` gives HTTP + WebSocket on the same port natively. Regex-based route matching in `routes.ts` is simple enough for 13 endpoints.

**Trade-off:** No middleware for logging, CORS helpers, etc. CORS headers are set manually on every response.

## 2. Filesystem as Database

**Decision:** Read `~/.claude/` directly. No SQLite, no database, no caching layer.

**Why:** Claude Code already writes structured data (JSONL, JSON index files, memory markdown). Duplicating this into a database would create sync issues. Reading the filesystem is fast enough for a local tool serving one user.

**Trade-off:** File reads on every request. Mitigated by partial reads (first 4KB for metadata, first 100KB for first prompt extraction) and the WebSocket push model that builds data only on file changes.

## 3. Hybrid Session Index (Index + Disk Reconciliation)

**Decision:** Read `sessions-index.json` for metadata BUT also scan actual `.jsonl` files on disk.

**Why:** We discovered that newer Claude Code versions create JSONL session files but don't always update `sessions-index.json`. The index was 24 days stale in production. Without disk scanning, new sessions were invisible.

**How it works:**
1. Read index for summaries, message counts, branch info
2. Scan `.jsonl` files in the directory
3. For files not in the index: create entries from JSONL first-line metadata
4. For files with newer mtime than index: update timestamps from disk

## 4. Process-Based Live Detection (Not File Timestamps)

**Decision:** Use `ps` + `lsof` to detect running Claude Code processes instead of relying on file modification times.

**Why:** File timestamps can't distinguish "Claude is actively running" from "a file was recently written by a completed session." The user wanted to see actual running processes with thinking/idle status.

**How it works:**
1. `ps -eo pid,pcpu,comm | grep claude` — find all Claude processes
2. `lsof -a -p {pid} -d cwd -Fn` — get CWD for each process
3. Encode CWD to directory name format, match to projects
4. CPU > 5% = "thinking", CPU ~0% = "idle"
5. Server runs this every 5 seconds, diffs against last state, broadcasts only on change

## 5. WebSocket Push Over Polling

**Decision:** Server pushes full overview data on file changes. No client polling.

**Why:** The original design used 10-second `setInterval` polling from the client. This was wasteful (most polls return same data) and slow (up to 10s delay for updates). WebSocket infrastructure was already in place but underutilized — it was just sending `data_changed` notifications that triggered another HTTP fetch.

**New model:**
- File change → debounce 100ms → `buildOverviewData()` → broadcast full data
- Process scan (5s interval) → diff → broadcast `live_sessions` partial update
- REST only on initial page load and manual refresh

## 6. React 19 + Vite (Learned from premium-alpaka)

**Decision:** Use the same frontend stack as the premium-alpaka project.

**Why:** The user explicitly said to learn from premium-alpaka for UI/UX patterns. That project uses React 19, Vite, Tailwind, CLIProvider spawn pattern. Reusing the same stack meant consistent patterns and familiarity.

## 7. Partial File Reads for Performance

**Decision:** Use low-level `fs.openSync` + `fs.readSync` to read only the first N bytes of session files.

**Why:** Session JSONL files can be 9MB+. Reading them fully for metadata extraction would be prohibitively slow when scanning 100+ sessions. Reading 4KB gets the first-line metadata; 100KB gets the first user prompt.

## 8. No Test Framework (Yet)

**Decision:** Ship without tests.

**Why:** This was a rapid prototype built across sessions while the user was AFK. The priority was getting a working tool fast. Tests are acknowledged as missing in `CLAUDE.md`.

## 9. Single Port (4201) for Everything

**Decision:** HTTP, WebSocket, and static file serving all on port 4201.

**Why:** Simplifies deployment and usage. One command (`bun run start`) serves everything. In development, Vite proxies API/WS calls from port 5174 to 4201.

## 10. Extracted `buildOverviewData()` as Shared Module

**Decision:** Created `src/api/overview.ts` to share the data-building logic between REST and WebSocket.

**Why:** Both the `GET /api/overview` REST endpoint and the WebSocket file-change handler need to build the same data payload. Without extraction, the logic would be duplicated or tightly coupled to routes.

This wasn't in the original plan — it emerged during the WebSocket push implementation as a necessary architectural addition.

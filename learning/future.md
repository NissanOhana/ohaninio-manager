# Unfinished Work & Future Plans

Things that were planned or requested but not yet implemented.

---

## Dashboard UX Overhaul (Planned, Not Implemented)

Full plan at: `docs/plans/2026-02-27-dashboard-ux-overhaul.md`

### Task 1: Navigation Restructure
- Change page toggle from `Dashboard | Agent` → `Dashboard | Insights | Agent`
- Remove standalone Insights/Chat CTA buttons from header
- Add usage stats inline in header: `Today: N | Week: N | Resets in Xh`

### Task 2: Live Sessions as Hero View
- Live Sessions becomes full-width hero section at top of dashboard
- Add repo filter chips: `premium (2) | skills (1) | All`
- Group today's sessions by `projectName` as collapsible sections
- Thinking sessions get animated border/glow

### Task 3: Insights Page + Day Summary Agent
- New `InsightsPage` with "Run Day Summary" button
- Server spawns `claude -p` with context about all today's sessions
- Streams response using existing agent chat infrastructure
- Persists last summary for quick reload

### Task 4: Stats Bar + Footer
- Navbar shows `Today: N · Week: N · Resets in Xh`
- `StatsFooter` docked at bottom with sparklines and reset countdowns

**Execution order:** Task 1 → Tasks 2+4 in parallel → Task 3

---

## npx CLI Distribution

User requested the tool be usable via `npx ohaninio-manager`. The `package.json` already has the `bin` and `files` fields configured, but the package hasn't been published to npm yet.

**What's needed:**
- Publish to npm
- Test `npx ohaninio-manager start` from a clean environment
- Consider whether Bun is a required runtime or if a Node fallback is needed

---

## Test Framework

No tests exist. `CLAUDE.md` explicitly notes this. Would benefit from:
- Backend: API endpoint tests, session parsing tests (especially the tricky hybrid index logic)
- Frontend: Component smoke tests
- Integration: Start server, hit endpoints, verify responses

---

## Auto-Loaded Orchestrator Skill

User mentioned wanting a meta-agent that automatically monitors all sessions — an auto-loaded skill that runs in the background. This was acknowledged as a future brainstorming topic but never designed.

---

## Playwright Browser Testing

Session 2 attempted to use Playwright MCP for automated browser testing but it wasn't configured. The assistant started writing a direct Playwright test script but was interrupted. Browser-based E2E testing would be valuable for verifying the dashboard renders correctly.

---

## Session Chat Integration

The dashboard has chat capability via the AgentPage, but deeper integration could include:
- Chat with a specific session (ask questions about what happened in that session)
- Cross-session queries ("what did I work on across all repos today?")
- These were conceptualized in session 1 but only partially implemented

---

## Memory Sync Feature

Session 1 designed a `sync-memory` sub-command for the orchestrate skill that would analyze insights and update memory files. This was part of the original design doc but wasn't implemented.

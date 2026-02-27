# Dashboard UX Overhaul

> **For Claude:** Use superpowers:executing-plans to implement.

**Goal:** Restructure the dashboard around live sessions as the hero view, clean up navigation, add day-summary agent, and surface usage stats.
**Services:** Frontend only (web/src) + minor server additions for stats/day-summary
**PR Strategy:** Single PR — all changes are in ohaninio-manager, tightly coupled UI work

---

## Task 1: Restructure Navigation — 3-way toggle + clean header

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/pages/DashboardPage.tsx`

**Changes:**
- Change page toggle from `Dashboard | Agent` → `Dashboard | Insights | Agent`
- Remove the standalone "Insights" and "Chat" CTA buttons from the header
- Chat stays accessible from dashboard (it's wired into DashboardPage already via `chatOpen` state — keep the toggle logic, just remove the header button, add a small chat FAB or keep it in the dashboard itself)
- Add `"insights"` to the Page type union
- When `page === "insights"`, render a new `InsightsPage` (or reuse InsightsPanel + MemoryHealth in a full-page layout)
- Move usage stats into the navbar: show "Today: N | Week: N | Resets in Xh" inline in the header

**Layout after change:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🔭 Ohaninio  [Dashboard|Insights|Agent]  Today:5 Week:12  🌗│
└─────────────────────────────────────────────────────────────┘
```

---

## Task 2: Live Sessions as Hero View + Repo Filter

**Files:**
- Modify: `web/src/pages/DashboardPage.tsx` (restructure layout)
- Modify: `web/src/components/dashboard/LiveSessions.tsx` (expand into full hero section)
- Modify: `web/src/components/sidebar/Sidebar.tsx` (remove redundant stats — now in navbar)

**Changes:**

**DashboardPage layout restructure:**
- Live Sessions becomes the TOP section, full-width hero area (not a grid card)
- Below it: two-column layout with RecentSessions (left, larger) and sidebar content (right)
- Below that: StatusCards + SessionChart + MemoryHealth in a grid
- Chat panel stays at bottom

**LiveSessions hero redesign:**
- Full-width card at top of dashboard
- Add repo filter dropdown/chip bar: extract unique `projectName` values from `liveSessions`, render as clickable filter chips
- "All" chip selected by default, clicking a repo filters the list
- Show session count per repo in the chip: `premium (2) | skills (1)`
- Each session card gets more visual weight: larger, show more info (full summary, branch, PR link, time active)
- Thinking sessions highlighted with animated border/glow
- When no live sessions: show a more subtle empty state (not taking full hero space)

**Sessions by repo (below live sessions):**
- Group `todaySessions` by `projectName`
- Render as collapsible sections: "premium-billing (5 sessions)" with session list inside
- Each section shows repo name, session count, latest activity time
- Clicking a session navigates to SessionDetail

---

## Task 3: Insights Page — Memory Health + Day Summary Agent

**Files:**
- Create: `web/src/pages/InsightsPage.tsx`
- Modify: `web/src/components/insights/InsightsPanel.tsx` (adapt for full page)
- Modify: `web/src/components/dashboard/MemoryHealth.tsx` (adapt for full page)
- Modify: `web/src/hooks/useWebSocket.ts` (handle agent response for day summary)

**Changes:**

**InsightsPage layout:**
```
┌─────────────────────────────────────────┐
│  Day Summary                    [Run ▶] │
│  ┌─────────────────────────────────────┐│
│  │ Agent-generated summary of the day  ││
│  │ (streaming text, like AgentPage)    ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌──────────────┬──────────────────────┐│
│  │  Insights    │  Memory Health       ││
│  │  Panel       │  (full table)        ││
│  │  (existing)  │                      ││
│  └──────────────┴──────────────────────┘│
└─────────────────────────────────────────┘
```

**Day Summary feature:**
- "Run Day Summary" button at top of InsightsPage
- On click: sends WS message `{ action: "day_summary" }` to server
- Server spawns `claude -p` with context about all today's sessions, stats, memory health
- Streams response back via existing agent message protocol (`agent:text_delta`, `agent:thinking`, `agent:complete`)
- Frontend renders streaming response in a card (reuse MessageList rendering)
- Persist last summary so it shows on page load without re-running

**Server-side (`src/ws/handler.ts`):**
- Add `day_summary` action handler
- Build rich context: all today's sessions with summaries, stats, memory health, insights
- Prompt: "Analyze today's Claude Code sessions. Summarize what was accomplished, identify patterns, suggest what to focus on next, flag any issues."
- Reuse existing chat streaming infrastructure

---

## Task 4: Stats Bar in Navbar + Stats Section at Page Bottom

**Files:**
- Modify: `web/src/App.tsx` (add stats to navbar)
- Create: `web/src/components/dashboard/StatsFooter.tsx`
- Modify: `web/src/pages/DashboardPage.tsx` (add StatsFooter)
- Modify: `web/src/lib/api.ts` (add stats endpoint if needed)

**Changes:**

**Navbar stats (App.tsx):**
- Show inline in header: `Today: {stats.today} · Week: {stats.thisWeek} · Resets {timeUntilReset}`
- `timeUntilReset`: calculate hours until midnight (day reset) and days until Monday (week reset)
- Small, muted text — doesn't take visual priority over navigation
- Updates reactively from overview data (already available via `data.stats`)

**StatsFooter component:**
- Fixed or docked at bottom of DashboardPage
- Horizontal bar with usage metrics:
  - Sessions today (with mini sparkline or bar if data available)
  - Sessions this week
  - Total sessions all-time
  - Active projects count
  - Messages today (if available from stats)
- Day/week reset countdown timers
- Subtle design — dark bar at bottom, not distracting

---

## Execution Order

1. **Task 1** (Navigation) — foundational, changes page routing
2. **Task 2** (Live Sessions hero) — main visual change, depends on new layout
3. **Task 4** (Stats) — independent, can be done in parallel with Task 2
4. **Task 3** (Insights page + Day Summary) — depends on Task 1 for the new Insights page route

Tasks 2 and 4 are independent and can be parallelized.

---

## What Stays the Same

- REST API endpoints (all still work)
- WebSocket push system (just added)
- AgentPage (untouched)
- ProjectDetail / SessionDetail navigation (still works from sidebar/session clicks)
- Theme toggle, WS reconnect logic
- Chat infrastructure (reused for day summary)

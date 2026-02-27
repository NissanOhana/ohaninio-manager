# Dashboard Overhaul: Sessions + Learning + Stats

## Features

### 1. Sessions as Main View
- Replace StatusCards (project attention cards) with a unified SessionsView
- Merge LiveSessions + RecentSessions into one full-width hero component
- Live sessions at top with prominent thinking/idle/active indicators
- Today's sessions below, chronological
- Remove SessionChart and MemoryHealth from default view (sidebar still has project nav)

### 2. Learning CTA
- "What did I learn?" section on dashboard with time frame picker
- Time frames: Yesterday, This week, This month
- Triggers agent chat with a learning-focused analysis prompt
- Streams response inline in a panel below the CTA
- Backend: new `learning` WS action with time-frame-aware prompt

### 3. Stats Panel
- Read `~/.claude/stats-cache.json` for usage data
- Show: today/week messages, sessions, tool calls, model breakdown
- Daily activity sparkline chart
- New `/api/stats` endpoint, included in overview push

## Implementation Order

1. Backend: `src/data/stats.ts` + API endpoint
2. Backend: Learning WS action in handler.ts
3. Frontend: New `SessionsView.tsx` (merge live + recent)
4. Frontend: New `LearningPanel.tsx` with CTA + streaming response
5. Frontend: New `StatsPanel.tsx` with usage visualization
6. Frontend: Rewire `DashboardPage.tsx` layout
7. Test with dev-browser

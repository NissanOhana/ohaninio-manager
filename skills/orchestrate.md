---
name: orchestrate
description: Cross-repo Claude Code session orchestrator. Shows status of all projects, memory health, and insights. Sub-commands: status (default), insights, sync-memory, dashboard.
---

# Claude Code Orchestrator

Cross-repo session intelligence for all Claude Code sessions on this machine.

## Sub-commands

Based on the user's argument (or default to `status`):

### `status` (default)
Read all session data and present a prioritized dashboard:

1. Read `~/.claude/history.jsonl` for today's prompts
2. Read ALL `~/.claude/projects/*/sessions-index.json` files
3. Read ALL `~/.claude/projects/*/memory/MEMORY.md` files

Present:
```
## What Needs Attention
🔴 [project]: [latest session summary] (last: [time])
🟡 [project]: [latest session summary] (last: [time])
🟢 [project]: [latest session summary] (last: [time])

## Today's Sessions
[time] [project] [summary] ([message count] msgs)

## Memory Health
✓ project (N files, date) · ⚠ project (stale, N sessions since update) · ✗ project (missing)
```

Priority rules:
- 🔴 CRITICAL: Session summaries mention "error", "fail", "blocked", "fix" OR has open PRs (prUrl in session index)
- 🟡 IN PROGRESS: Session summaries mention "implement", "review", "working", "draft"
- 🟢 STABLE: Recent activity, no issues
- ⚪ DORMANT: No activity in 30+ days

### `insights`
1. Run `/insights` command as a subagent to generate fresh report
2. Read `~/.claude/usage-data/report.html`
3. Extract friction patterns, CLAUDE.md suggestions, skill ideas
4. Present each suggestion with target file and ask user to approve before applying
5. For approved items, update the appropriate MEMORY.md or CLAUDE.md file

### `sync-memory`
1. Audit all project memory directories
2. Flag MISSING: projects with sessions but no memory/MEMORY.md
3. Flag STALE: projects where sessions exist after last memory update
4. Suggest cross-pollination between related projects
5. For missing memories, offer to generate from recent session summaries

### `dashboard`
Launch the web dashboard:
```bash
npx ohaninio-manager start
```
Then tell the user: "Dashboard running at http://localhost:4201"

## Key Data Locations

- Global history: `~/.claude/history.jsonl` (JSONL: display, timestamp, project, sessionId)
- Session indices: `~/.claude/projects/*/sessions-index.json` (JSON: entries[] with sessionId, summary, messageCount, gitBranch, modified, prUrl, prNumber)
- Auto memory: `~/.claude/projects/*/memory/MEMORY.md`
- Insights report: `~/.claude/usage-data/report.html`
- User CLAUDE.md: `~/.claude/CLAUDE.md`

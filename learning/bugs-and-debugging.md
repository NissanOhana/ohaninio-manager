# Bugs & Debugging Lessons

Real bugs encountered and fixed across the sessions. These are worth remembering because they reveal patterns in how Claude Code's data works.

---

## Bug 1: All Projects Showing as "Dormant"

**Session:** 1 (initial build)
**Symptom:** Status detection marked every project as dormant despite active work.
**Root cause:** Status thresholds were too tight. Sessions were from earlier in February, and the "recent activity" window was too narrow.
**Fix:** Widened time thresholds for priority classification to show meaningful statuses.
**Lesson:** Time-based heuristics need generous windows for a tool that analyzes monthly activity.

---

## Bug 2: `dirNameToProjectPath` Breaking Multi-Dash Names

**Session:** 1 (initial build)
**Symptom:** Project names like `premium-billing` were being mangled.
**Root cause:** The decoding function replaced ALL dashes with slashes, turning `premium-billing` into `premium/billing`.
**Fix:** Read actual `projectPath` from session index instead of decoding directory names.
**Lesson:** The directory encoding (`-Users-nissano-premium-billing`) is NOT simply "replace slashes with dashes" — project names themselves contain dashes. Always use the authoritative source (session index) over reverse-engineering encodings.

---

## Bug 3: "No Live Sessions" Despite Active Processes

**Session:** 3 (the big debugging session)
**Symptom:** Dashboard showed "no live sessions" but the user had active Claude Code sessions.
**Root cause (multi-layered):**
1. `sessions-index.json` had `fileMtime` from Feb 2 — **24 days stale**
2. Newer Claude Code versions create JSONL files but don't update the index
3. `getLiveSessions()` relied solely on index timestamps
4. The sidebar showed "30 TODAY" (from `history.jsonl`, which IS updated) — creating a contradictory display

**Fix:** Hybrid session index that scans actual `.jsonl` files on disk and reconciles with the index. If a JSONL file's mtime is newer than the index entry, use the real mtime. Create entries for unlisted sessions by extracting metadata from the first JSONL line.

**Lesson:** **Never trust `sessions-index.json` timestamps alone.** Disk is the source of truth. Always reconcile with actual files. This is the most important technical lesson from the entire project.

---

## Bug 4: `readFirstPrompt()` Not Finding Messages

**Session:** 3
**Symptom:** First prompt extraction returned null for all sessions.
**Root cause (3 sub-bugs):**
1. Looking for message type `"human"` but actual format uses type `"user"`
2. Content was in `entry.message.content` (array of blocks with `{type: "text", text: "..."}`) not a simple string
3. Was matching `[Request interrupted by user for tool use]` messages and `toolUseResult` entries as valid prompts

**Fix:** Match `type: "user"`, extract text from content array, skip system messages and tool results.

**Lesson:** Claude Code's JSONL format uses `"user"` not `"human"` for user messages. The content structure is `message.content: [{type: "text", text: "..."}, ...]` — always an array of blocks.

---

## Bug 5: Stale Build Artifacts Served Instead of New Code

**Session:** 1 (light mode / live sessions)
**Symptom:** After rebuilding, the browser still showed "Today's Activity" instead of the new "Live Sessions" component.
**Root cause:** Vite build output went to `web/dist/` but the server served from `dist/web/`. The old compiled JS bundle was being served from the stale `dist/web/` path.
**Fix:** Aligned build output paths and cleaned stale artifacts.
**Lesson:** When Bun server serves static files from `dist/web/`, make sure Vite's `outDir` actually outputs there. Always clean old builds before testing.

---

## Bug 6: Process-to-Project Path Matching Too Greedy

**Session:** 3
**Symptom:** Multiple Claude processes matched to the wrong project.
**Root cause:** `startsWith` matching on paths: `/Users/nissano/premium-billing` would match `/Users/nissano` (the "home" project) because the home path is a prefix of everything.
**Fix:** Sort paths most-specific-first (longest path first) before matching.
**Lesson:** When matching paths hierarchically, always sort by specificity (length) descending. The most specific match should win.

---

## Bug 7: Double Shebang in Built CLI

**Session:** 2
**Symptom:** CLI binary had two `#!/usr/bin/env bun` lines at the top.
**Root cause:** The build script prepended a shebang, but Bun's bundler already preserves the shebang from the source TypeScript file.
**Fix:** Removed the redundant shebang addition from the build script.
**Lesson:** Bun.build preserves shebangs from source files. Don't add them in post-processing.

---

## General Debugging Lessons

1. **Claude Code data on disk is versioned implicitly** — newer versions change what gets written and when. Don't assume the format is frozen.

2. **Always verify with real data.** The stale-index bug was invisible during initial development because test data was consistent. Only discovered when checking against actual disk state.

3. **Process detection is inherently racey.** Claude processes can start/stop between `ps` and `lsof` calls. Handle gracefully.

4. **Browser caching fights you during development.** Dark mode persisted in localStorage even after switching to light-mode default. Always check browser state when debugging display issues.

5. **The dev-browser skill is invaluable for verification.** Multiple bugs were caught by launching a headless browser and taking screenshots rather than trusting the code review alone.

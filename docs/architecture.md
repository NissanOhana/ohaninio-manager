# Ohaninio Manager — Data Flow Architecture

## WebSocket Push Architecture

```mermaid
graph TB
    subgraph "Server (Bun)"
        FW["File Watcher<br/>~/.claude (recursive)"]
        PS["Process Scanner<br/>ps/lsof (every 5s)"]
        BOD["buildOverviewData()"]
        GLS["getLiveSessions()"]
        BC["broadcast()"]
        WS["WebSocket Server"]
        API["REST API<br/>/api/overview"]

        FW -->|"debounce 100ms"| BOD
        BOD -->|"{ type: overview, data }"| BC
        PS --> GLS
        GLS -->|"diff check<br/>session IDs + status"| BC
        BC -->|"{ type: live_sessions }"| WS
        BC -->|"{ type: overview }"| WS
    end

    subgraph "~/.claude"
        SI["sessions-index"]
        HJ["history.jsonl"]
        MEM["memory/"]
        JL["*.jsonl logs"]
    end

    subgraph "OS Processes"
        CP["Claude Code<br/>processes"]
    end

    subgraph "Frontend (React)"
        APP["App.tsx"]
        UO["useOverview"]
        UWS["useWebSocket"]
        UI["Dashboard UI"]

        UWS -->|"onOverviewData"| UO
        UWS -->|"onLiveSessions"| UO
        UWS -->|"onDataChanged (fallback)"| UO
        UO -->|"data"| APP
        APP --> UI
    end

    SI -->|"change event"| FW
    HJ -->|"change event"| FW
    MEM -->|"change event"| FW
    JL -->|"change event"| FW
    CP -->|"ps aux"| PS

    WS <-->|"WebSocket frames"| UWS
    API -->|"initial load + manual refresh"| UO

    style FW fill:#4a9eff,color:#fff
    style PS fill:#4a9eff,color:#fff
    style BC fill:#ff9f43,color:#fff
    style WS fill:#2ed573,color:#fff
    style UWS fill:#2ed573,color:#fff
```

## Data Flow Summary

| Trigger | Server Action | Client Receives | Client Action |
|---------|--------------|-----------------|---------------|
| Page load | — | — | REST `GET /api/overview` (one-time) |
| File change in `~/.claude` | Build full overview, broadcast | `{ type: "overview", data }` | Replace full state |
| Process scan (5s interval) | Detect Claude processes, diff | `{ type: "live_sessions", sessions }` | Partial state update |
| Manual refresh button | — | — | REST `GET /api/overview` |
| WS reconnect | — | — | Automatic via 3s retry |

## Key Design Decisions

- **No client-side polling** — server pushes all updates via WebSocket
- **Debounced file watcher** (100ms) — prevents flooding on rapid file writes
- **Diff-based process scanning** — only broadcasts when session IDs or statuses change
- **Skips scanning when no clients** — `wsClients.size === 0` check saves CPU
- **REST kept as fallback** — initial load and manual refresh still use HTTP

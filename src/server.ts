import { join, extname } from "path";
import { readFileSync, existsSync, watch } from "fs";
import { homedir } from "os";
import { handleApi, jsonResponse } from "./api/routes.js";
import { handleWsMessage, cleanupChat } from "./ws/handler.js";
import { buildOverviewData } from "./api/overview.js";
import { getLiveSessions } from "./data/sessions.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export interface ServerOptions {
  port?: number;
  devMode?: boolean;
  distDir?: string;
}

export function startServer(options: ServerOptions = {}) {
  const PORT = options.port || Number(process.env.PORT) || 4201;
  const DEV_MODE = options.devMode || process.argv.includes("--dev");
  const DIST_DIR = options.distDir || join(import.meta.dir, "..", "dist", "web");

  const wsClients = new Set<any>();

  function broadcast(data: unknown) {
    const msg = JSON.stringify(data);
    for (const ws of wsClients) {
      try {
        ws.send(msg);
      } catch {}
    }
  }

  function serveStatic(path: string): Response | null {
    let filePath = join(DIST_DIR, path === "/" ? "index.html" : path);

    if (!existsSync(filePath)) {
      // SPA fallback
      filePath = join(DIST_DIR, "index.html");
      if (!existsSync(filePath)) return null;
    }

    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const content = readFileSync(filePath);

    return new Response(content, {
      headers: { "Content-Type": mime },
    });
  }

  const server = Bun.serve({
    port: PORT,
    fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade
      if (url.pathname === "/ws") {
        if (server.upgrade(req)) return;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      // CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // API routes
      if (url.pathname.startsWith("/api/")) {
        const apiResponse = handleApi(url);
        if (apiResponse) return apiResponse;
        return jsonResponse({ error: "Not found" }, 404);
      }

      // Static files (production)
      if (!DEV_MODE) {
        const staticResponse = serveStatic(url.pathname);
        if (staticResponse) return staticResponse;
      }

      return jsonResponse({ error: "Not found" }, 404);
    },
    websocket: {
      message(ws, message) {
        try {
          const data = JSON.parse(String(message));
          handleWsMessage(ws, data, broadcast);
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
        }
      },
      open(ws) {
        console.log("[ws] Client connected");
        wsClients.add(ws);
      },
      close(ws) {
        console.log("[ws] Client disconnected");
        wsClients.delete(ws);
        cleanupChat(ws);
      },
    },
  });

  // Debounced file watcher — pushes full overview data instead of just a notification
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  try {
    const claudeDir = join(homedir(), ".claude");
    const watcher = watch(claudeDir, { recursive: true }, (event, filename) => {
      if (
        filename &&
        (filename.includes("sessions-index") ||
          filename.includes("history.jsonl") ||
          filename.includes("memory") ||
          filename.endsWith(".jsonl"))
      ) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          broadcast({ type: "overview", data: buildOverviewData() });
        }, 100);
      }
    });

    process.on("SIGINT", () => {
      watcher.close();
      if (liveScanInterval) clearInterval(liveScanInterval);
      process.exit(0);
    });
  } catch (e) {
    console.warn("[watcher] Could not watch ~/.claude:", e);
  }

  // Periodic live session scanning (process detection via ps/lsof)
  let lastLiveSessionIds = "";
  const liveScanInterval = setInterval(() => {
    if (wsClients.size === 0) return; // no clients, skip work
    const sessions = getLiveSessions();
    const key = sessions.map(s => `${s.sessionId}:${s.status}`).join("|");
    if (key !== lastLiveSessionIds) {
      lastLiveSessionIds = key;
      broadcast({ type: "live_sessions", sessions });
    }
  }, 5000);

  console.log(`\n  Ohaninio Manager running at http://localhost:${PORT}\n`);
  if (DEV_MODE) {
    console.log(`  Dev mode: frontend at http://localhost:5174\n`);
  }

  return server;
}

// Self-start when run directly
if (import.meta.main) {
  startServer();
}

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { HistoryEntry } from "./types.js";

const HISTORY_PATH = join(homedir(), ".claude", "history.jsonl");

export function readHistory(): HistoryEntry[] {
  try {
    const content = readFileSync(HISTORY_PATH, "utf-8");
    return content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as HistoryEntry);
  } catch {
    return [];
  }
}

export function getTodayHistory(): HistoryEntry[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  return readHistory().filter((entry) => entry.timestamp >= todayMs);
}

export function getHistoryByDate(dateStr: string): HistoryEntry[] {
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  const startMs = date.getTime();
  const endMs = startMs + 86400000;

  return readHistory().filter(
    (entry) => entry.timestamp >= startMs && entry.timestamp < endMs,
  );
}

export function getHistoryStats() {
  const all = readHistory();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const weekMs = todayMs - 7 * 86400000;

  return {
    total: all.length,
    today: all.filter((e) => e.timestamp >= todayMs).length,
    thisWeek: all.filter((e) => e.timestamp >= weekMs).length,
  };
}

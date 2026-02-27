import { readFileSync, existsSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { InsightsReport } from "./types.js";

const REPORT_PATH = join(
  homedir(),
  ".claude",
  "usage-data",
  "report.html",
);

export function getInsightsReport(): InsightsReport {
  if (!existsSync(REPORT_PATH)) {
    return {
      reportDate: null,
      frictionPatterns: [],
      suggestions: [],
      skillIdeas: [],
    };
  }

  const stat = statSync(REPORT_PATH);
  const html = readFileSync(REPORT_PATH, "utf-8");

  return {
    reportDate: stat.mtime.toISOString(),
    frictionPatterns: extractFrictionPatterns(html),
    suggestions: extractSuggestions(html),
    skillIdeas: extractSkillIdeas(html),
  };
}

function extractFrictionPatterns(
  html: string,
): InsightsReport["frictionPatterns"] {
  const patterns: InsightsReport["frictionPatterns"] = [];

  // Look for friction-related sections in the HTML
  // The report uses structured sections with headings and lists
  const frictionRegex =
    /(?:friction|pain\s*point|challenge|issue|problem)[^<]*<\/(?:h[2-4]|div|span)>/gi;
  const matches = html.match(frictionRegex) || [];

  // Extract structured friction data from common report patterns
  const sectionRegex =
    /<(?:h[2-4]|div)[^>]*>([^<]*(?:friction|challenge|issue)[^<]*)<\/(?:h[2-4]|div)>/gi;
  let match;

  while ((match = sectionRegex.exec(html)) !== null) {
    const name = match[1].trim().replace(/\s+/g, " ");
    if (name.length > 5 && name.length < 100) {
      patterns.push({
        name,
        severity: "medium",
        description: name,
      });
    }
  }

  // Also try to find list items near friction headings
  const listItemRegex =
    /<li[^>]*>([^<]{10,200})<\/li>/gi;
  const allItems: string[] = [];
  while ((match = listItemRegex.exec(html)) !== null) {
    allItems.push(match[1].trim());
  }

  // If we found list items but no structured friction, use top items
  if (patterns.length === 0 && allItems.length > 0) {
    const frictionItems = allItems.filter(
      (item) =>
        /error|fail|slow|confus|frustrat|repeat|debug|fix|retry/i.test(
          item,
        ),
    );
    for (const item of frictionItems.slice(0, 10)) {
      patterns.push({
        name: item.slice(0, 60),
        severity: /error|fail|crash/i.test(item) ? "high" : "medium",
        description: item,
      });
    }
  }

  return patterns.slice(0, 15);
}

function extractSuggestions(
  html: string,
): InsightsReport["suggestions"] {
  const suggestions: InsightsReport["suggestions"] = [];

  // Look for CLAUDE.md suggestion sections
  const claudeMdRegex =
    /CLAUDE\.md[^<]*(?:<[^>]*>)*([^<]{10,300})/gi;
  let match;

  while ((match = claudeMdRegex.exec(html)) !== null) {
    const text = match[1]
      .trim()
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ");
    if (text.length > 10 && text.length < 200) {
      suggestions.push({
        text,
        target: "~/.claude/CLAUDE.md",
        rationale: "From insights analysis",
      });
    }
  }

  // Look for "suggest" or "recommend" patterns
  const suggestRegex =
    /(?:suggest|recommend|consider|try)[^<]{10,200}/gi;
  while ((match = suggestRegex.exec(html)) !== null) {
    const text = match[0]
      .trim()
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ");
    if (
      text.length > 15 &&
      !suggestions.some((s) => s.text === text)
    ) {
      suggestions.push({
        text: text.slice(0, 150),
        target: "~/.claude/CLAUDE.md",
        rationale: "From insights analysis",
      });
    }
  }

  return suggestions.slice(0, 10);
}

function extractSkillIdeas(
  html: string,
): InsightsReport["skillIdeas"] {
  const ideas: InsightsReport["skillIdeas"] = [];

  // Look for skill/command/workflow suggestions
  const skillRegex =
    /(?:skill|command|workflow|hook|automation)[^<]{10,200}/gi;
  let match;

  while ((match = skillRegex.exec(html)) !== null) {
    const text = match[0]
      .trim()
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ");
    if (text.length > 15) {
      ideas.push({
        name: text.slice(0, 50),
        description: text.slice(0, 150),
      });
    }
  }

  return ideas.slice(0, 5);
}

export function getInsightsReportHtml(): string | null {
  if (!existsSync(REPORT_PATH)) return null;
  return readFileSync(REPORT_PATH, "utf-8");
}

// ---
// Summary:
// - Purpose: UI rendering utilities — header, usage stats, spinner, card-based action/observation displays.
// - Role: Wraps `consola` for status messages, `boxen` for bordered cards, custom spinner with ANSI colors.
// - Used by: index, engine, executor, commands, handlers.
// - Depends on: boxen, consola, theme (ANSI colors), types (UsageMetadata).
// ---
import boxen from "boxen";
import { consola } from "consola";
import { AMBER, BOLD, CHARCOAL, DIM, RESET, EMERALD, SAPPHIRE, SLATE } from "./theme";
import type { UsageMetadata } from "../types";

// ─── Header ───────────────────────────────────────────────────────────────────

export function printHeader(modelName: string): void {
  console.log(
    `\n${AMBER}${BOLD}GEMINI CLI :: ${modelName}${RESET}\n${DIM}${"-".repeat(50)}${RESET}\n`,
  );
}

// ─── Usage Stats ──────────────────────────────────────────────────────────────

export function printUsage(
  modelName: string,
  usage: UsageMetadata,
  sessionTotal: number,
): void {
  const {
    promptTokenCount = 0,
    candidatesTokenCount = 0,
    totalTokenCount = 0,
    thoughtsTokenCount = 0,
    cachedContentTokenCount = 0,
  } = usage;

  let parts = [
    `${promptTokenCount} prompt`,
    `${candidatesTokenCount} completion`
  ];

  if (thoughtsTokenCount > 0) parts.push(`${thoughtsTokenCount} thinking`);
  if (cachedContentTokenCount > 0) parts.push(`${cachedContentTokenCount} cached`);

  console.log(
    `\n${DIM}[${modelName}] Tokens: ${parts.join(" + ")} = ${totalTokenCount} total${RESET}`,
  );
  console.log(`${DIM}Session Total: ${sessionTotal}${RESET}`);
}

// ─── Error Display ────────────────────────────────────────────────────────────

// ─── Status Reporting ─────────────────────────────────────────────────────────

export function printError(message: string): void {
  consola.error(message);
}

export function printSuccess(message: string): void {
  consola.success(message);
}

export function printInfo(message: string): void {
  consola.info(message);
}

export function printWarn(message: string): void {
  consola.warn(message);
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export async function showSpinner(stopCondition: () => boolean, status?: string): Promise<void> {
  const chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const startTime = Date.now();

  while (!stopCondition()) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const timeStr = `${DIM}(${elapsed}s)${RESET}`;
    const statusStr = status ? ` ${DIM}${status}${RESET}` : "";

    process.stdout.write(
      `\r${AMBER}${chars[i % chars.length]}${RESET} Thinking... ${timeStr}${statusStr} `,
    );
    i++;
    await new Promise((r) => setTimeout(r, 100));
  }
  process.stdout.write("\r\x1b[K"); // Clear line
}
// ─── Visual Cards ─────────────────────────────────────────────────────────────

/**
 * Utility to strip ANSI codes to get actual visible length
 */
export function getVisibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").length;
}


function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let currentLine = "";

  // Split by actual newlines first
  const paragraphs = text.split('\n');

  for (const p of paragraphs) {
    const words = p.split(" ");
    for (const word of words) {
      const wordLen = getVisibleLength(word);
      const currentLen = getVisibleLength(currentLine);

      if (currentLen + wordLen + 1 > width) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
      currentLine = "";
    }
  }
  return lines;
}

export function printCard(options: {
  title: string;
  lines: string[];
  footer?: string;
  color?: string;
}): void {
  const { title, lines, footer, color = AMBER } = options;

  // Map ANSI colors to hex for boxen
  const colorMap: Record<string, string> = {
    [AMBER]: "#FFBF00",
    [EMERALD]: "#50C878",
    [SAPPHIRE]: "#0F52BA",
    [SLATE]: "#708090",
    "\x1b[38;2;255;85;85m": "#FF5555",
  };

  const borderColor = colorMap[color] || "#708090";

  const content = lines.join("\n");
  
  const box = boxen(content, {
    title,
    titleAlignment: "left",
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor,
    dimBorder: true,
  });

  console.log("\n" + box);
  if (footer) {
    console.log(`${DIM}  ${footer}${RESET}`);
  }
}

export function printResponse(text: string): void {
  const box = boxen(text, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 1, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "#FFBF00", // AMBER
    dimBorder: true,
  });

  console.log(box);
}

export function printAction(name: string, args: any): void {
  const entries = Object.entries(args || {});
  const argLines = entries.length > 0 
    ? entries.map(
        ([k, v]) => `${BOLD}${k}${RESET}: ${DIM}${typeof v === 'string' && v.length > 100 ? v.slice(0, 100) + '...' : JSON.stringify(v)}${RESET}`
      )
    : [`${DIM}(no arguments)${RESET}`];

  printCard({
    title: `⚡ Action: ${name}`,
    lines: argLines,
    color: SLATE,
  });
}

export function printObservation(name: string, result: any): void {
  let lines: string[] = [];
  let footer: string | undefined;

  if (result.error) {
    lines = [`${BOLD}\x1b[31mError:${RESET} ${result.error}`];
  } else if (name === "bun_search" || name === "firecrawl_search") {
    const rawResults = result.results;
    if (typeof rawResults === "string") {
      const snippets = rawResults.split("\n").filter((l) => l.trim()).slice(0, 3);
      lines = snippets.map((s) => `${DIM}🌍 ${s.slice(0, 80)}...${RESET}`);
      footer = `Found multiple results`;
    } else if (Array.isArray(rawResults)) {
      lines = rawResults.slice(0, 3).map((r: any) => `${DIM}🌍 ${r.title || r.url || JSON.stringify(r).slice(0, 80)}${RESET}`);
      footer = `Found ${rawResults.length} results`;
    } else {
      lines = [`${DIM}Complex search data returned.${RESET}`];
    }
  } else if (name === "scrape_url") {
    const content = result.content || "(No content)";
    lines = [
      `${BOLD}URL:${RESET} ${DIM}${result.url}${RESET}`,
      "",
      ...wrapText(content.slice(0, 500), process.stdout.columns - 6).map((l: string) => `${DIM}${l}${RESET}`)
    ];
    footer = `Scraped ${content.length} characters`;
  } else if (name === "read_file") {
    const contentSnippet = result.content?.slice(0, 500) || "Empty file";
    lines = [
      `${BOLD}File:${RESET} ${DIM}${result.path}${RESET}`,
      `${BOLD}Size:${RESET} ${DIM}${(result.size / 1024).toFixed(1)} KB${RESET}`,
      "",
      ...contentSnippet.split("\n").slice(0, 15).map((l: string) => `${DIM}${l.slice(0, 120)}${RESET}`),
      ...(contentSnippet.split("\n").length > 15 || result.content?.length > 500 ? [`${DIM}... (content truncated)${RESET}`] : [])
    ];
    footer = `Read from local disk`;
  } else if (name === "list_files") {
    const entries = result.entries || [];
    lines = [
      `${BOLD}Path:${RESET} ${DIM}${result.path}${RESET}`,
      `${BOLD}Contents:${RESET}`,
      ...entries.slice(0, 15).map((e: string) => `${DIM}  - ${e}${RESET}`),
      ...(entries.length > 15 ? [`${DIM}  ... and ${entries.length - 15} more${RESET}`] : [])
    ];
    footer = `Found ${result.count} entries`;
  } else if (name === "write_file") {
    lines = [
      `${BOLD}File:${RESET} ${DIM}${result.path}${RESET}`,
      `${BOLD}Mode:${RESET} ${DIM}${result.mode}${RESET}`,
      `${BOLD}Status:${RESET} ${EMERALD}Success${RESET} (${(result.size / 1024).toFixed(1)} KB wrote)`,
    ];
    footer = `Disk write complete`;
  } else if (name === "terminal_execute") {
    const output = result.output || result.error || "(No output)";
    lines = output.split("\n").slice(0, 10).map((l: string) => `${DIM}${l.slice(0, 120)}${RESET}`);
    footer = output.split("\n").length > 10 ? `... and ${output.split("\n").length - 10} more lines` : undefined;
  } else {
    lines = [`${DIM}${JSON.stringify(result).slice(0, 300)}${RESET}`];
  }

  printCard({
    title: `👁️ Observation: ${name}`,
    lines,
    footer,
    color: result.error ? "\x1b[38;2;255;85;85m" : EMERALD,
  });
}

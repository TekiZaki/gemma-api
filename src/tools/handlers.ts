// ---
// Summary:
// - Purpose: Tool implementations — actual execution logic for each built-in tool.
// - Role: terminal_execute (Bun.$), bun_search (bun-search CLI), firecrawl_search (Firecrawl API), scrape_url (fetch + HTML parsing), read_file, memorize, recall.
// - Used by: executor.ts (getToolHandlers).
// - Depends on: Bun.$, node-html-parser, ai/memory, ui/theme, ui/components, plugin-manager.
// ---
import { $ } from "bun";
import { readFileSync, existsSync } from "fs";
import { parse } from "node-html-parser";
import { AMBER, DIM, RESET } from "../ui/theme";
import { printCard } from "../ui/components";
import type { ToolResult } from "../types";
import { MemoryManager } from "../ai/memory";

// ─── Tool Implementations ─────────────────────────────────────────────────────

export const terminalExecute = async ({ command }: { command: string }): Promise<ToolResult> => {
  if (!command) return { error: "No command provided." };
  
  try {
    let result: string;
    if (process.platform === "win32") {
      // Use positional parameter to avoid quoting hell with -Command
      result = await $`powershell -NoProfile -NonInteractive -Command ${command}`.text();
    } else {
      result = await $`${{ raw: command }}`.text();
    }
    return { output: result.trim() };
  } catch (err: any) {
    return { error: err.message };
  }
};

/**
 * Custom tool for your specific CLI search
 */
export const bunSearch = async ({ query }: { query: string }): Promise<ToolResult> => {
  if (!query) return { error: "No query provided." };
  try {
    const rawResult = await $`bun-search ${query}`.quiet();
    if (rawResult.exitCode !== 0) {
      return { error: `bun-search failed: ${rawResult.stderr.toString() || 'Unknown error'}` };
    }

    // Filter out status logs if they are mixed in stdout
    let result = rawResult.stdout.toString().split("\n")
      .filter(line => 
        !line.includes("WebSocket Server") && 
        !line.includes("Chrome Extension") &&
        !line.includes("⏳") &&
        !line.includes("✅") &&
        !line.includes("🌍")
      )
      .join("\n")
      .trim();
    return { results: result };
  } catch (err: any) {
    return { error: err.message };
  }
};

export const firecrawlSearch = async ({ query }: { query: string }): Promise<ToolResult> => {
  try {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return { error: "FIRECRAWL_API_KEY not found in environment." };

    const response = await fetch("https://api.firecrawl.dev/v2/search", {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        sources: ["web"],
        limit: 5,
        scrapeOptions: {
          onlyMainContent: true,
          formats: ["markdown"]
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `Firecrawl API error: ${response.status} - ${errText}` };
    }

    const data = await response.json();
    return { results: data };
  } catch (err: any) {
    return { error: err.message };
  }
};

export const scrapeUrl = async ({ url }: { url: string }): Promise<ToolResult> => {
  if (!url) return { error: "No URL provided." };
  try {
    const rawResult = await $`bun-search --scrape ${url}`.quiet();
    if (rawResult.exitCode !== 0) {
      return { error: `scrape failed: ${rawResult.stderr.toString() || 'Unknown error'}` };
    }

    // Filter out status logs if they are mixed in stdout
    let result = rawResult.stdout.toString().split("\n")
      .filter(line => 
        !line.includes("WebSocket Server") && 
        !line.includes("Chrome Extension") &&
        !line.includes("⏳") &&
        !line.includes("✅") &&
        !line.includes("🌍")
      )
      .join("\n")
      .trim();
    
    return { url, content: result };
  } catch (err: any) {
    return { error: err.message };
  }
};

export const readFile = async ({ path }: { path: string }): Promise<ToolResult> => {
  try {
    if (!existsSync(path)) return { error: `File not found: ${path}` };
    const content = readFileSync(path, "utf-8");
    return { content };
  } catch (err: any) {
    return { error: err.message };
  }
};

export const memorize = async ({ fact, tags }: { fact: string, tags?: string[] }): Promise<ToolResult> => {
  try {
    MemoryManager.getInstance().memorize(fact, tags);
    return { output: "Memory successfully persisted." };
  } catch (err: any) {
    return { error: err.message };
  }
};

export const recall = async ({ query }: { query: string }): Promise<ToolResult> => {
  try {
    const results = MemoryManager.getInstance().recall(query);
    return { results };
  } catch (err: any) {
    return { error: err.message };
  }
};

import { createToolHandler, dynamicHandlers } from "./plugin-manager";

// ─── Tool Handlers Registry ───────────────────────────────────────────────────

const staticHandlers: Record<string, (args: any) => Promise<ToolResult>> = {
  terminal_execute: terminalExecute,
  bun_search: bunSearch,
  firecrawl_search: firecrawlSearch,
  read_file: readFile,
  scrape_url: scrapeUrl,
  create_tool: createToolHandler,
  memorize: memorize,
  recall: recall,
};

export const getToolHandlers = () => ({
  ...staticHandlers,
  ...dynamicHandlers
});

// For backward compatibility
export const toolHandlers = getToolHandlers();


import { $ } from "bun";
import { readFileSync, existsSync } from "fs";
import { parse } from "node-html-parser";
import { AMBER, RESET } from "../ui/theme";
import type { ToolResult } from "../types";

// ─── Tool Implementations ─────────────────────────────────────────────────────

export const terminalExecute = async ({ command }: { command: string }): Promise<ToolResult> => {
  try {
    console.log(`\n${AMBER}⚡ EXECUTING:${RESET} ${command}`);
    const result = await $`${{ raw: command }}`.text();
    return { output: result };
  } catch (err: any) {
    return { error: err.message };
  }
};

/**
 * Custom tool for your specific CLI search
 */
export const bunSearch = async ({ query }: { query: string }): Promise<ToolResult> => {
  try {
    console.log(`\n${AMBER}🌍 SEARCHING (BUN):${RESET} ${query}`);
    // Executes your local bun-search command
    const result = await $`bun-search ${query}`.text();
    return { results: result };
  } catch (err: any) {
    return { error: err.message };
  }
};

export const firecrawlSearch = async ({ query }: { query: string }): Promise<ToolResult> => {
  try {
    console.log(`\n${AMBER}🌍 SEARCHING (FIRECRAWL):${RESET} ${query}`);
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
  try {
    console.log(`\n${AMBER}🕷️  SCRAPING:${RESET} ${url}`);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; gemma-api/1.0)" }
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };

    const html = await res.text();
    const root = parse(html);

    // Remove noise
    root.querySelectorAll("script, style, nav, footer, header, aside").forEach(el => el.remove());

    const text = root.querySelector("main, article, #content, .content, body")
      ?.text
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000); // cap tokens

    return { url, content: text ?? "(no content found)" };
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

// ─── Tool Handlers Registry ───────────────────────────────────────────────────

export const toolHandlers: Record<string, (args: any) => Promise<ToolResult>> = {
  terminal_execute: terminalExecute,
  bun_search: bunSearch,
  firecrawl_search: firecrawlSearch,
  read_file: readFile,
  scrape_url: scrapeUrl,
};

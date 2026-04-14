// ---
// Summary:
// - Purpose: Tool implementations — actual execution logic for each built-in tool.
// - Role: terminal_execute (Bun.$), bun_search (bun-search CLI), firecrawl_search (Firecrawl API), scrape_url (fetch + HTML parsing), read_file.
// - Used by: executor.ts (getToolHandlers).
// - Depends on: Bun.$, node-html-parser, ui/theme, ui/components, plugin-manager.
// ---
import { $ } from "bun";
import { readdirSync, statSync, mkdirSync } from "fs";
import { join as pathJoin, dirname } from "path";
import { parse } from "node-html-parser";
import { AMBER, DIM, RESET } from "../ui/theme";
import { printCard } from "../ui/components";
import type { ToolResult } from "../types";

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

export const readFile = async ({ path, encoding = "utf-8" }: { path: string; encoding?: string }): Promise<ToolResult> => {
  try {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) return { error: `File not found: ${path}` };

    const size = file.size;
    if (size > 2 * 1024 * 1024) {
      return { error: `File too large (${(size / 1024).toFixed(1)} KB). Max 2 MB.` };
    }

    const content = await file.text();
    return { content, size, path };
  } catch (err: any) {
    return { error: err.message };
  }
};

export const listFiles = async ({
  path,
  recursive = false,
  show_hidden = false,
}: {
  path: string;
  recursive?: boolean;
  show_hidden?: boolean;
}): Promise<ToolResult> => {
  try {
    const stat = statSync(path);
    if (!stat.isDirectory()) return { error: `Not a directory: ${path}` };

    const walk = (dir: string, depth: number): string[] => {
      const entries = readdirSync(dir, { withFileTypes: true });
      const results: string[] = [];
      for (const entry of entries) {
        if (!show_hidden && entry.name.startsWith(".")) continue;
        const fullPath = pathJoin(dir, entry.name);
        const rel = fullPath.replace(path, "").replace(/^[\\/]/, "");
        const label = entry.isDirectory() ? `${rel}/` : rel;
        results.push(label);
        if (recursive && entry.isDirectory() && depth < 5) {
          results.push(...walk(fullPath, depth + 1));
        }
      }
      return results;
    };

    const files = walk(path, 0);
    return { path, entries: files, count: files.length };
  } catch (err: any) {
    return { error: err.message };
  }
};

export const writeFile = async ({
  path,
  content,
  mode = "overwrite",
}: {
  path: string;
  content: string;
  mode?: "overwrite" | "append" | "patch";
}): Promise<ToolResult> => {
  try {
    // Ensure parent directory exists
    mkdirSync(dirname(path), { recursive: true });

    if (mode === "append") {
      const existing = await Bun.file(path).exists()
        ? await Bun.file(path).text()
        : "";
      await Bun.write(path, existing + content);
    } else if (mode === "patch") {
      // Patch: expects content as JSON { find: string, replace: string }
      let patchArgs: { find: string; replace: string };
      try {
        patchArgs = JSON.parse(content);
      } catch {
        return { error: "mode=patch requires content to be JSON: { find, replace }" };
      }
      const existing = await Bun.file(path).text();
      if (!existing.includes(patchArgs.find)) {
        return { error: `Patch target not found in file: "${patchArgs.find}"` };
      }
      await Bun.write(path, existing.replace(patchArgs.find, patchArgs.replace));
    } else {
      // overwrite (default)
      await Bun.write(path, content);
    }

    const stat = statSync(path);
    return { path, mode, size: stat.size, success: true };
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
  list_files: listFiles,
  write_file: writeFile,
  scrape_url: scrapeUrl,
  create_tool: createToolHandler,
};

export const getToolHandlers = () => ({
  ...staticHandlers,
  ...dynamicHandlers
});

// For backward compatibility
export const toolHandlers = getToolHandlers();

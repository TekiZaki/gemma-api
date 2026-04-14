// ---
// Summary:
// - Purpose: Tool schema definitions — static tool parameter structures for the AI model.
// - Role: Declares 7 built-in tools (terminal_execute, bun_search, firecrawl_search, read_file, scrape_url, memorize, recall) + create_tool + dynamic plugins.
// - Used by: engine.ts, executor.ts.
// - Depends on: plugin-manager (createToolDefinition, dynamicDefinitions).
// ---
import { createToolDefinition, dynamicDefinitions } from "./plugin-manager";

// ─── Tool Schemas ─────────────────────────────────────────────────────────────

const staticTools = [
  {
    name: "terminal_execute",
    description: "Executes terminal commands on Windows (PowerShell/CMD). If asking for time, use 'Get-Date -Format \"yyyy-MM-dd HH:mm:ss\"'. NEVER use Unix/Bash syntax.",
    parameters: {
      type: "OBJECT",
      properties: {
        command: { type: "STRING", description: "The PowerShell/CMD command to execute." },
      },
      required: ["command"],
    },
  },
  {
    name: "bun_search",
    description: "Primary web search tool (BUN mode). Returns AI-generated summaries of search results using the internal 'bun-search' engine.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "The search query." },
      },
      required: ["query"],
    },
  },
  {
    name: "firecrawl_search",
    description: "Deep search/crawl. Returns clean markdown data.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "The search query." },
      },
      required: ["query"],
    },
  },
  {
    name: "read_file",
    description: "Reads a local file using Bun native API. Max 2 MB. Returns file content, size, and path.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Absolute or relative path to the file." },
        encoding: { type: "STRING", description: "Encoding to use (default: utf-8)." },
      },
      required: ["path"],
    },
  },
  {
    name: "list_files",
    description: "Lists files and directories in a given path using Bun/fs. Returns an array of relative paths. Directories are suffixed with '/'.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Absolute or relative path to the directory." },
        recursive: { type: "STRING", description: "Set to 'true' to list recursively (max depth 5)." },
        show_hidden: { type: "STRING", description: "Set to 'true' to include dot-files." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Writes or edits a local file using Bun.write(). Supports three modes: 'overwrite' (default, full replace), 'append' (add to end), 'patch' (find+replace via JSON { find, replace }).",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Absolute or relative path to the file." },
        content: { type: "STRING", description: "Content to write. For patch mode, pass JSON: { \"find\": \"...\", \"replace\": \"...\" }" },
        mode: { type: "STRING", description: "Write mode: 'overwrite' | 'append' | 'patch'. Default: 'overwrite'." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "scrape_url",
    description: "Extracts an AI-generated summary of the content from a URL using the 'bun-search --scrape' engine. Highly effective for complex or JS-heavy sites.",
    parameters: {
      type: "OBJECT",
      properties: {
        url: { type: "STRING", description: "The full URL to scrape." },
      },
      required: ["url"],
    },
  },
];

export const getToolDefinitions = () => [
  {
    functionDeclarations: [
      ...staticTools,
      createToolDefinition,
      ...dynamicDefinitions
    ]
  }
];

// For backward compatibility if needed, though we should transition to getToolDefinitions()
export const toolDefinitions = getToolDefinitions();


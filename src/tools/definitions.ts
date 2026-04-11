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
    description: "Reads a local file.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Path to file." },
      },
      required: ["path"],
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
  {
    name: "memorize",
    description: "Persist important information across conversations. Use this for user preferences, learned facts, or repeated instructions.",
    parameters: {
      type: "OBJECT",
      properties: {
        fact: { type: "STRING", description: "The piece of information to remember." },
        tags: { 
          type: "ARRAY", 
          items: { type: "STRING" }, 
          description: "Optional labels for organization." 
        },
      },
      required: ["fact"],
    },
  },
  {
    name: "recall",
    description: "Search long-term memory for relevant facts or preferences.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Keywords to search for in memory." },
      },
      required: ["query"],
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


// ─── Tool Schemas ─────────────────────────────────────────────────────────────

export const toolDefinitions = [
  {
    functionDeclarations: [
      {
        name: "terminal_execute",
        description: "Executes a command in the local terminal. Use 'date' to check current system time.",
        parameters: {
          type: "OBJECT",
          properties: {
            command: { type: "STRING", description: "The command to execute." },
          },
          required: ["command"],
        },
      },
      {
        name: "bun_search",
        description: "Search the web for real-time info. Note: Returns only snippets. ALWAYS follow up with 'scrape_url' on promising links to get actual facts.",
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
        description: "Advanced search and crawl engine. Use this for deep web data extraction and clean markdown results.",
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
        description: "Downloads and parses the full text content of a URL. Use this MANDATORY step after searching to read the actual articles found in search results.",
        parameters: {
          type: "OBJECT",
          properties: {
            url: { type: "STRING", description: "The full URL to scrape." },
          },
          required: ["url"],
        },
      },
    ],
  },
];

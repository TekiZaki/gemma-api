// ─── Tool Schemas ─────────────────────────────────────────────────────────────

export const toolDefinitions = [
  {
    functionDeclarations: [
      {
        name: "terminal_execute",
        description: "Executes terminal commands. Use 'date' for system time.",
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
        description: "Web search (snippets only). Must follow with 'scrape_url' for full content.",
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
        description: "Extracts full text from a URL. Mandatory step after search to read the actual content.",
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

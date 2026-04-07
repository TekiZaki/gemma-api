# Code Dump: gemma-api

## gemma-api/config.json

```json
{
  "model": "gemma-4-31b-it"
}
```

## gemma-api/history.json

```json
[
  {
    "role": "user",
    "parts": [
      {
        "text": "SYSTEM_AUTO_SYNC: The current system date/time is 4/7/2026, 7:21:42 AM."
      }
    ]
  }
]
```

## gemma-api/package.json

```json
{
  "name": "gemma-api",
  "version": "1.0.0",
  "main": "src/index.ts",
  "module": "src/index.ts",
  "bin": {
    "gemma-api": "./src/index.ts"
  },
  "type": "module",
  "scripts": {
    "start": "bun src/index.ts"
  },
  "devDependencies": {
    "@types/marked-terminal": "^6.1.1",
    "bun-types": "latest"
  },
  "peerDependencies": {
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "@google/genai": "^1.48.0",
    "marked": "^17.0.6",
    "marked-terminal": "^7.3.0",
    "node-html-parser": "^7.1.0"
  }
}

```

## gemma-api/tsconfig.json

```json
{
  "compilerOptions": {
    // Environment setup & latest features
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,

    // Bundler mode
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,

    // Best practices
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    // Some stricter flags (disabled by default)
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false
  }
}

```

## gemma-api/src/commands.ts

```typescript
import type * as readLine from "readline/promises";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { GoogleGenAI } from "@google/genai";
import { AMBER, BOLD, DIM, RESET } from "./ui/theme";
import { printError, printHeader } from "./ui/components";
import { selectModel } from "./ui/selector";
import { runTurn } from "./ai/engine";
import { HistoryManager } from "./ai/history";
import { COMMANDS, AVAILABLE_MODELS, saveConfig } from "./config";
import type { SessionStats } from "./types";
import { AppState } from "./types";

// ─── Search Feature Resolver ─────────────────────────────────────────────────

export async function resolveSearchFeature(
  prompt: string,
  rl: readLine.Interface,
): Promise<string | undefined> {
  if (/using bun-search|!bun/i.test(prompt)) return "BUN";
  if (/using firecrawl|!firecrawl/i.test(prompt)) return "FIRECRAWL";
  if (/using google search|!google/i.test(prompt)) return "GOOGLE";
  return undefined;
}

// ─── Stdin Reader ─────────────────────────────────────────────────────────────

export async function readStdin(): Promise<string | null> {
  if (process.stdin && process.stdin.isTTY) return null;
  try {
    const buffer = readFileSync(0);
    const text = buffer.toString("utf-8");
    const trimmed = text.trim();
    return trimmed || null;
  } catch (e) {
    return null;
  }
}

// ─── Command Handler ──────────────────────────────────────────────────────────

export async function handleCommand(
  cleanAnswer: string,
  ai: GoogleGenAI,
  history: HistoryManager,
  rl: readLine.Interface,
  stats: SessionStats,
): Promise<{ handled: boolean; shouldExit: boolean }> {
  const state = AppState.getInstance();
  const PROJ_ROOT = join(import.meta.dir, "..");

  // Help command
  if (["/", "/help", "help", "?"].includes(cleanAnswer.toLowerCase())) {
    console.log(`\n${AMBER}${BOLD}Available Commands:${RESET}`);
    COMMANDS.forEach((c) => {
      console.log(`${DIM}${c.cmd.padEnd(30)}${RESET} ${c.desc}`);
    });
    console.log("");
    return { handled: true, shouldExit: false };
  }

  // Exit command
  if (["exit", "quit", "\\q"].includes(cleanAnswer.toLowerCase())) {
    console.log(`\n${AMBER}Goodbye!${RESET}\n`);
    return { handled: true, shouldExit: true };
  }

  // Reset/Clear command
  if (["!clear", "/reset"].includes(cleanAnswer.toLowerCase())) {
    history.reset();
    await runTurn("SYSTEM_INIT_ACK", ai, history.getHistory(), rl, stats, {
      silent: true,
    });
    console.log(`\n${AMBER}Conversation history cleared.${RESET}\n`);
    return { handled: true, shouldExit: false };
  }

  // Model command - interactive selector or set directly
  if (
    cleanAnswer.toLowerCase().startsWith("!model") ||
    cleanAnswer.toLowerCase().startsWith("/model")
  ) {
    const parts = cleanAnswer.split(" ");
    const modelArg = parts[1];

    if (!modelArg) {
      // Interactive selector
      rl.pause();
      const selected = await selectModel(AVAILABLE_MODELS);
      rl.resume();

      if (selected && selected !== state.model) {
        state.model = selected;
        saveConfig({ model: state.model });
        printHeader(state.model);
        console.log(
          `\n${AMBER}${BOLD}Switched to ${state.model}${RESET} ${DIM}(saved)${RESET}\n`,
        );
      }
    } else if (AVAILABLE_MODELS.includes(modelArg)) {
      state.model = modelArg;
      saveConfig({ model: state.model });
      console.log(
        `\n${AMBER}${BOLD}Switched to ${state.model}${RESET} ${DIM}(saved)${RESET}\n`,
      );
    } else {
      printError(`Invalid model. Available: ${AVAILABLE_MODELS.join(", ")}`);
    }
    return { handled: true, shouldExit: false };
  }

  // Save command
  if (["!save", "/save"].includes(cleanAnswer.toLowerCase())) {
    const historyPath = join(PROJ_ROOT, "history.json");
    writeFileSync(
      historyPath,
      JSON.stringify(history.getHistory(), null, 2),
    );
    console.log(
      `\n${AMBER}Conversation history saved to ${historyPath}${RESET}\n`,
    );
    return { handled: true, shouldExit: false };
  }

  // Load command
  if (["!load", "/load"].includes(cleanAnswer.toLowerCase())) {
    const historyPath = join(PROJ_ROOT, "history.json");
    if (existsSync(historyPath)) {
      const data = readFileSync(historyPath, "utf-8");
      const parsed = JSON.parse(data);
      history.loadFromJSON(parsed);
      console.log(
        `\n${AMBER}Conversation history loaded from ${historyPath}${RESET}\n`,
      );
    } else {
      printError(`No history file found at ${historyPath}`);
    }
    return { handled: true, shouldExit: false };
  }

  // Not a command - return false
  return { handled: false, shouldExit: false };
}

```

## gemma-api/src/config.ts

```typescript
import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import type { Config, CommandDefinition } from "./types";

// ─── Paths ────────────────────────────────────────────────────────────────────

export const PROJ_ROOT = join(import.meta.dir, "..");
export const ENV_PATH = join(PROJ_ROOT, ".env");
export const CONFIG_PATH = join(PROJ_ROOT, "config.json");

// ─── Available Models ─────────────────────────────────────────────────────────

export const AVAILABLE_MODELS = [
  "gemma-4-26b-a4b-it",
  "gemini-2.5-flash-lite",
  "gemma-4-31b-it",
];

// ─── Models that support thinkingConfig ───────────────────────────────────────

const THINKING_SUPPORTED_MODELS = new Set([
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash-thinking-exp",
]);

export const supportsThinking = (model: string): boolean =>
  THINKING_SUPPORTED_MODELS.has(model) ||
  model.startsWith("gemini-2.5-pro") ||
  (model.startsWith("gemini-2.5-flash") && !model.includes("lite"));

// ─── Environment Loading ──────────────────────────────────────────────────────

export function loadEnv() {
  if (!process.env.GEMINI_API_KEY && existsSync(ENV_PATH)) {
    const envContent = readFileSync(ENV_PATH, "utf-8");
    envContent.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    });
  }
  return process.env.GEMINI_API_KEY || null;
}

// ─── Config Persistence ───────────────────────────────────────────────────────

export function loadConfig(): Config {
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.model && AVAILABLE_MODELS.includes(parsed.model)) {
        return parsed;
      }
    } catch {
      /* fall through to default */
    }
  }
  return { model: "gemma-4-31b-it" };
}

export function saveConfig(config: Config): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ─── System Prompt Manager ────────────────────────────────────────────────────

export class PromptManager {
  static getSystemPrompt(selectedSearch?: string): string {
    const now = new Date();
    const localDate = now.toLocaleDateString("en-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Jakarta",
    });
    const localTime = now.toLocaleTimeString("en-ID", {
      timeZone: "Asia/Jakarta",
    });

    let searchContext = "";
    if (selectedSearch === "BUN")
      searchContext =
        "- You MUST use 'bun_search' for any real-time factual queries.";
    if (selectedSearch === "FIRECRAWL")
      searchContext =
        "- You MUST use 'firecrawl_search' for any deep web research or markdown data extraction.";
    if (selectedSearch === "GOOGLE")
      searchContext =
        "- Google Search Grounding is ENABLED. You have direct access to Google Search.";

    return `
You are a highly capable AI assistant running on a local machine.
CONTEXT:
- Current Reality Date/Time: ${localDate} ${localTime}.
- Current Location: Indonesia.
${searchContext}

URGENT RULES:
- The date/time provided above is your ACTUAL REALITY. Never claim it is a simulation or that you are guessing the date.
- Treat years like 2024, 2025, and 2026 as the present. Never mention "training data cutoff".
- If search results provide information from these years, accept them as current events.
- Be direct and do not engage in philosophical debates about your perception of time.
- Use tools whenever necessary to verify facts in your current timeline.
- After using 'bun_search', if a result looks relevant, use 'scrape_url' on the top links to get the full article content before answering.
- Be concise by default. Give direct, to-the-point answers without unnecessary elaboration, filler phrases, or restating the question. Only provide detailed explanations when the user explicitly asks (e.g. "explain", "elaborate", "walk me through", "in detail").
- Prefer prose or minimal formatting over excessive bullet points unless structure genuinely helps.
`;
  }

  static getSystemSyncMessage(): string {
    const now = new Date();
    const localDate = now.toLocaleString("en-ID", {
      timeZone: "Asia/Jakarta",
    });
    return `SYSTEM_AUTO_SYNC: The current system date/time is ${localDate}.`;
  }
}

// ─── Command Definitions ──────────────────────────────────────────────────────

export const COMMANDS: CommandDefinition[] = [
  { cmd: "/help or /", desc: "Show this help menu" },
  { cmd: "/reset or !clear", desc: "Clear conversation history" },
  { cmd: "/model or !model [model]", desc: "Change the AI model" },
  { cmd: "/save or !save", desc: "Save conversation history" },
  { cmd: "/load or !load", desc: "Load conversation history" },
  { cmd: "!bun / !firecrawl / !google", desc: "Trigger specific search modes" },
  { cmd: "exit / quit / \\q", desc: "Exit the application" },
];

```

## gemma-api/src/index.ts

```typescript
#!/usr/bin/env bun
import { GoogleGenAI } from "@google/genai";
import * as readLine from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { loadEnv, loadConfig, AVAILABLE_MODELS } from "./config";
import { printHeader, printError } from "./ui/components";
import { runTurn } from "./ai/engine";
import { HistoryManager } from "./ai/history";
import { resolveSearchFeature, readStdin, handleCommand } from "./commands";
import { AppState, SessionStats as SessionStatsClass } from "./types";
import type { SessionStats } from "./types";
import { DIM, AMBER, RESET } from "./ui/theme";
import { readLineWithHint } from "./ui/readline";

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load environment and config
  const apiKey = loadEnv();
  const config = loadConfig();

  // Initialize state singleton
  const state = AppState.initialize(config.model);

  // Initialize session stats
  const stats = new SessionStatsClass();

  // Print header with current model
  printHeader(state.model);

  if (!apiKey) {
    printError(`GEMINI_API_KEY not found.`);
    process.exit(1);
  }

  // Check for stdin content
  const stdinContent = await readStdin();

  // Initialize AI and readline
  const ai = new GoogleGenAI({ apiKey });
  const rl = readLine.createInterface({
    input,
    output,
    completer: (line: string): [string[], string] => {
      const completions = [
        "/reset",
        "!clear",
        "/model",
        "!model",
        "/save",
        "!save",
        "/load",
        "!load",
        "!bun",
        "!firecrawl",
        "!google",
        "exit",
        "quit",
      ];
      const hits = completions.filter((c) => c.startsWith(line));
      return [hits.length ? hits : line === "/" ? completions : [], line];
    },
  });

  // Initialize history manager with time sync
  const history = new HistoryManager();
  history.initializeWithTimeSync();

  console.log(
    `${history.getHistory().length > 0 ? "Synchronizing environment..." : ""}`,
  );
  await runTurn("SYSTEM_INIT_ACK", ai, history.getHistory(), rl, stats, {
    silent: true,
  });

  // Build prompt from args
  let promptFromArgs = process.argv.slice(2).join(" ");

  if (stdinContent) {
    if (promptFromArgs) {
      promptFromArgs = `Input from stdin:\n---\n${stdinContent}\n---\n\n${promptFromArgs}`;
    } else {
      promptFromArgs = stdinContent;
    }
  }

  // Handle single-shot mode (args provided)
  if (promptFromArgs) {
    const args = process.argv.slice(2);
    const noTools = args.includes("--no-tool") || args.includes("--nt");
    const cleanPrompt = args
      .filter((arg) => arg !== "--no-tools" && arg !== "--nt")
      .join(" ");

    const selectedSearch = await resolveSearchFeature(cleanPrompt, rl);
    await runTurn(cleanPrompt, ai, history.getHistory(), rl, stats, {
      selectedSearch,
      piped: !!stdinContent,
      noTools,
    });
    rl.close();
  } else {
    // REPL mode
    console.log(
      `${DIM}Entering REPL mode. Type 'exit' or 'quit' to end.${RESET}`,
    );
    try {
      while (true) {
        const answer = await readLineWithHint(`${AMBER}?> ${RESET}`);
        const cleanAnswer = answer.trim();
        if (!cleanAnswer) continue;

        // Handle commands
        const { handled, shouldExit } = await handleCommand(
          cleanAnswer,
          ai,
          history,
          rl,
          stats,
        );

        if (shouldExit) break;
        if (handled) continue;

        // Not a command - treat as AI prompt
        const selectedSearch = await resolveSearchFeature(cleanAnswer, rl);
        await runTurn(cleanAnswer, ai, history.getHistory(), rl, stats, {
          selectedSearch,
        });
      }
    } finally {
      rl.close();
    }
  }
}

main().catch((error) => {
  printError(error.message);
  process.exit(1);
});

```

## gemma-api/src/types.ts

```typescript
// ─── Core Types ───────────────────────────────────────────────────────────────

export interface Config {
  model: string;
}

export interface ToolResult {
  output?: string;
  results?: any;
  content?: string;
  error?: string;
  url?: string;
  [key: string]: any;
}

export interface ConversationTurn {
  role: "user" | "model";
  parts: Array<{
    text?: string;
    functionCall?: {
      name: string;
      args: Record<string, any>;
      id?: string;
    };
    functionResponse?: {
      name: string;
      response: ToolResult;
      id?: string;
    };
  }>;
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface UsageAccumulator {
  p: number; // prompt tokens
  c: number; // candidate tokens
}

export interface TurnOptions {
  silent?: boolean;
  selectedSearch?: string;
  piped?: boolean;
  noTools?: boolean;
}

export interface CommandDefinition {
  cmd: string;
  desc: string;
}

// ─── Session Stats ────────────────────────────────────────────────────────────

export class SessionStats {
  private promptTokens = 0;
  private candidateTokens = 0;

  accumulate(usage: UsageMetadata) {
    this.promptTokens += usage.promptTokenCount || 0;
    this.candidateTokens += usage.candidatesTokenCount || 0;
  }

  get totalPromptTokens() {
    return this.promptTokens;
  }

  get totalCandidateTokens() {
    return this.candidateTokens;
  }

  get totalTokens() {
    return this.promptTokens + this.candidateTokens;
  }

  reset() {
    this.promptTokens = 0;
    this.candidateTokens = 0;
  }
}

// ─── State Singleton ──────────────────────────────────────────────────────────

export class AppState {
  private static instance: AppState | null = null;
  private currentModelName: string;

  private constructor(initialModel: string) {
    this.currentModelName = initialModel;
  }

  static initialize(initialModel: string): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState(initialModel);
    }
    return AppState.instance;
  }

  static getInstance(): AppState {
    if (!AppState.instance) {
      throw new Error("AppState not initialized. Call initialize() first.");
    }
    return AppState.instance;
  }

  get model(): string {
    return this.currentModelName;
  }

  set model(value: string) {
    this.currentModelName = value;
  }

  static reset() {
    AppState.instance = null;
  }
}

```

## gemma-api/src/ai/engine.ts

```typescript
import { GoogleGenAI } from "@google/genai";
import type * as readLine from "readline/promises";
import { marked } from "../ui/theme";
import { AMBER, BOLD, RESET, DIM, CHARCOAL } from "../ui/theme";
import { showSpinner } from "../ui/components";
import { printError, printUsage } from "../ui/components";
import { PromptManager, supportsThinking } from "../config";
import { handleToolCalls } from "../tools/executor";
import type { ConversationTurn, TurnOptions, UsageAccumulator, SessionStats } from "../types";
import { AppState } from "../types";

// ─── Run Turn ─────────────────────────────────────────────────────────────────

export async function runTurn(
  prompt: string,
  ai: GoogleGenAI,
  contents: ConversationTurn[],
  rl: readLine.Interface,
  stats: SessionStats,
  options: TurnOptions = {},
): Promise<void> {
  const state = AppState.getInstance();
  const { silent = false, selectedSearch, piped = false, noTools = false } = options;
  const usageAcc: UsageAccumulator = { p: 0, c: 0 };
  const now = new Date();
  const dateStr = now.toLocaleString("en-ID", { timeZone: "Asia/Jakarta" });

  try {
    const enrichedPrompt = silent
      ? prompt
      : `[SYSTEM_TIME_SYNC: ${dateStr}]\n${prompt}`;
    contents.push({ role: "user", parts: [{ text: enrichedPrompt }] });

    let spinnerRunning = true;
    const spinnerPromise = silent
      ? Promise.resolve()
      : showSpinner(() => !spinnerRunning);

    let activeTools: any[] = [];
    if (!noTools) {
      if (selectedSearch === "GOOGLE") {
        activeTools = [{ googleSearch: {} }];
      } else {
        // Import tool definitions dynamically to avoid circular deps
        const { toolDefinitions } = await import("../tools/definitions");
        activeTools = [...toolDefinitions];
      }
    }

    try {
      const stream = await ai.models.generateContentStream({
        model: state.model,
        contents,
        config: {
          tools: activeTools,
          systemInstruction: PromptManager.getSystemPrompt(selectedSearch),
          ...(supportsThinking(state.model) && {
            thinkingConfig: {
              thinkingLevel: "MINIMAL" as any,
              includeThoughts: false,
            },
          }),
        },
      });

      spinnerRunning = false;
      await spinnerPromise;

      let response: any = null;
      let hasText = false;
      let mergedParts: any[] = [];
      let streamedLines = 0;

      for await (const chunk of stream) {
        response = chunk;
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        mergedParts.push(...parts);
        const text = parts
          .filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join("");
        if (text && !silent) {
          if (!hasText) {
            process.stdout.write(`\n${AMBER}${BOLD} RESPONSE ${RESET}\n`);
            hasText = true;
          }
          process.stdout.write(text);
          streamedLines += (text.match(/\n/g) || []).length;
        }
      }

      if (hasText && !silent) {
        const fullText = mergedParts
          .filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join("");
        process.stdout.write(`\r\x1b[K`);
        for (let l = 0; l <= streamedLines + 1; l++) {
          process.stdout.write("\x1b[1A\x1b[2K");
        }
        process.stdout.write(`\n${AMBER}${BOLD} RESPONSE ${RESET}\n`);
        console.log((await marked.parse(fullText)).trim());
      }

      if (!response) return;

      if (response.usageMetadata) {
        usageAcc.p += response.usageMetadata.promptTokenCount || 0;
        usageAcc.c += response.usageMetadata.candidatesTokenCount || 0;
        stats.accumulate(response.usageMetadata);
      }

      if (response.candidates?.[0]?.content) {
        response.candidates[0].content.parts = mergedParts;
      }

      const finalResponse = await handleToolCalls(
        ai,
        contents,
        response,
        rl,
        selectedSearch,
        usageAcc,
        stats,
        piped,
        noTools,
      );

      if (finalResponse.candidates?.[0]?.content) {
        const alreadyInContents = contents.some(
          (c) => c === finalResponse.candidates[0].content,
        );
        if (!alreadyInContents) {
          contents.push(finalResponse.candidates[0].content);
        }
      }

      if (!silent) {
        printUsage(state.model, {
          promptTokenCount: usageAcc.p,
          candidatesTokenCount: usageAcc.c,
          totalTokenCount: usageAcc.p + usageAcc.c,
        }, stats.totalTokens);
      }
    } catch (innerError: any) {
      spinnerRunning = false;
      await spinnerPromise;
      throw innerError;
    }
  } catch (error: any) {
    if (!silent) printError(error.message || "An unexpected error occurred.");
  }
}

```

## gemma-api/src/ai/history.ts

```typescript
import type { ConversationTurn } from "../types";
import { PromptManager } from "../config";

// ─── Conversation History Manager ─────────────────────────────────────────────

export class HistoryManager {
  private history: ConversationTurn[];

  constructor() {
    this.history = [];
  }

  /**
   * Initialize history with the system time sync message.
   * SYSTEM_TIME_SYNC logic remains the first part of any conversation initialization.
   */
  initializeWithTimeSync(): void {
    this.history.length = 0;
    const syncMessage = PromptManager.getSystemSyncMessage();
    this.history.push({
      role: "user",
      parts: [{ text: syncMessage }],
    });
  }

  /**
   * Clear history and reinitialize with time sync.
   */
  reset(): void {
    this.initializeWithTimeSync();
  }

  /**
   * Get the current conversation history.
   */
  getHistory(): ConversationTurn[] {
    return [...this.history];
  }

  /**
   * Set the conversation history from external source.
   */
  setHistory(history: ConversationTurn[]): void {
    this.history.length = 0;
    this.history.push(...history);
  }

  /**
   * Load history from a parsed JSON array.
   */
  loadFromJSON(parsed: ConversationTurn[]): void {
    this.history.length = 0;
    this.history.push(...parsed);
  }

  /**
   * Clear all history without reinitializing.
   */
  clear(): void {
    this.history.length = 0;
  }
}

```

## gemma-api/src/tools/definitions.ts

```typescript
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
        description: "Standard search engine. Use this for general real-time web queries.",
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
        description: "Fetches and extracts the readable text content from a web page URL. Use after bun_search to read full articles.",
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

```

## gemma-api/src/tools/executor.ts

```typescript
import { GoogleGenAI } from "@google/genai";
import type * as readLine from "readline/promises";
import { AMBER, BOLD, CHARCOAL, DIM, RESET } from "../ui/theme";
import { marked } from "../ui/theme";
import { showSpinner } from "../ui/components";
import { PromptManager, supportsThinking } from "../config";
import { toolHandlers } from "./handlers";
import { toolDefinitions } from "./definitions";
import type { ConversationTurn, UsageAccumulator, SessionStats } from "../types";
import { AppState } from "../types";

// ─── Tool Call Executor ───────────────────────────────────────────────────────

export async function handleToolCalls(
  ai: GoogleGenAI,
  contents: ConversationTurn[],
  response: any,
  rl: readLine.Interface,
  selectedSearch?: string,
  usageAcc: UsageAccumulator = { p: 0, c: 0 },
  stats?: SessionStats,
  piped = false,
  noTools = false,
): Promise<any> {
  if (response.usageMetadata) {
    usageAcc.p += response.usageMetadata.promptTokenCount || 0;
    usageAcc.c += response.usageMetadata.candidatesTokenCount || 0;
    if (stats) stats.accumulate(response.usageMetadata);
  }

  const partsFromResponse = response.candidates?.[0]?.content?.parts || [];
  const functionCalls =
    (typeof response.functionCalls === "function"
      ? response.functionCalls()
      : response.functionCalls) ||
    partsFromResponse
      .filter((p: any) => p.functionCall)
      .map((p: any) => p.functionCall);

  if (!functionCalls || functionCalls.length === 0) return response;

  contents.push(response.candidates[0].content);

  const parts: any[] = [];
  const interactiveCalls = functionCalls.filter(
    (c: any) => c.name === "terminal_execute",
  );
  const nonInteractiveCalls = functionCalls.filter(
    (c: any) => c.name !== "terminal_execute",
  );

  const nonInteractiveResults = await Promise.all(
    nonInteractiveCalls.map(async (call: any) => {
      const { name, args, id } = call;
      const handler = toolHandlers[name];
      if (!handler) {
        return {
          functionResponse: {
            name,
            response: { error: `Tool ${name} not found.` },
            id,
          },
        };
      }
      const result = await handler(args);
      const argSummary = JSON.stringify(args).slice(0, 80);
      console.log(
        `\n${CHARCOAL}\x1b[48;2;255;191;0m OBSERVED \x1b[0m ${DIM}${name}(${argSummary})${RESET}`,
      );
      return { functionResponse: { name, response: result, id } };
    }),
  );
  parts.push(...nonInteractiveResults.filter(Boolean));

  for (const call of interactiveCalls) {
    const { name, args, id } = call;
    const handler = toolHandlers[name];
    if (!handler) continue;
    process.stdout.write(`\r\x1b[K`);
    console.log(
      `\n${AMBER}${BOLD}⚡ CALLING TOOL...${RESET}\n${DIM}Tool:${RESET} ${name}\n${DIM}Args:${RESET} ${JSON.stringify(args, null, 2)}`,
    );

    let authorized = false;
    if (piped) {
      console.log(`${DIM}(Auto-approved because input was piped)${RESET}`);
      authorized = true;
    } else {
      const answer = await rl.question(
        `${AMBER}${BOLD}Authorize execution?${RESET} ${DIM}[y/N]${RESET} `,
      );
      if (answer.trim().toLowerCase() === "y") {
        authorized = true;
      }
    }

    if (!authorized) {
      parts.push({
        functionResponse: {
          name,
          response: { error: "User denied permission." },
          id,
        },
      });
      continue;
    }
    const result = await handler(args);
    console.log(
      `\n${CHARCOAL}\x1b[48;2;255;191;0m OBSERVED \x1b[0m ${DIM}${name}${RESET}\n`,
    );
    parts.push({ functionResponse: { name, response: result, id } });
  }

  contents.push({ role: "user", parts });

  let activeTools: any[] = [];
  if (!noTools) {
    if (selectedSearch === "GOOGLE") {
      activeTools = [{ googleSearch: {} }];
    } else {
      activeTools = [...toolDefinitions];
    }
  }

  const state = AppState.getInstance();

  let spinnerRunning = true;
  const spinnerPromise = showSpinner(() => !spinnerRunning);

  try {
    const stream = await ai.models.generateContentStream({
      model: state.model,
      contents,
      config: {
        tools: activeTools,
        systemInstruction: PromptManager.getSystemPrompt(selectedSearch),
        ...(supportsThinking(state.model) && {
          thinkingConfig: { thinkingLevel: "MINIMAL" as any, includeThoughts: false },
        }),
      },
    });

    spinnerRunning = false;
    await spinnerPromise;

    let chunkResponse: any = null;
    let hasText = false;
    let mergedParts: any[] = [];
    let streamedLines = 0;

    for await (const chunk of stream) {
      chunkResponse = chunk;
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      mergedParts.push(...parts);
      const text = parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join("");
      if (text) {
        if (!hasText) {
          process.stdout.write(`\n${AMBER}${BOLD} RESPONSE ${RESET}\n`);
          hasText = true;
        }
        process.stdout.write(text);
        streamedLines += (text.match(/\n/g) || []).length;
      }
    }
    if (hasText) {
      const fullText = mergedParts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join("");
      process.stdout.write(`\r\x1b[K`);
      for (let l = 0; l <= streamedLines + 1; l++) {
        process.stdout.write("\x1b[1A\x1b[2K");
      }
      process.stdout.write(`\n${AMBER}${BOLD} RESPONSE ${RESET}\n`);
      console.log((await marked.parse(fullText)).trim());
    }
    if (!chunkResponse) return response;

    if (chunkResponse.candidates?.[0]?.content) {
      chunkResponse.candidates[0].content.parts = mergedParts;
    }
    return handleToolCalls(
      ai,
      contents,
      chunkResponse,
      rl,
      selectedSearch,
      usageAcc,
      stats,
      piped,
      noTools,
    );
  } catch (error: any) {
    spinnerRunning = false;
    await spinnerPromise;
    throw error;
  }
}

```

## gemma-api/src/tools/handlers.ts

```typescript
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

```

## gemma-api/src/ui/components.ts

```typescript
import { AMBER, BOLD, CHARCOAL, DIM, RESET } from "./theme";
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
  } = usage;

  console.log(
    `\n${DIM}[${modelName}] Tokens: ${promptTokenCount} prompt + ${candidatesTokenCount} completion = ${totalTokenCount} total${RESET}`,
  );
  console.log(`${DIM}Session Total: ${sessionTotal}${RESET}`);
}

// ─── Error Display ────────────────────────────────────────────────────────────

export function printError(message: string): void {
  console.error(
    `\n${CHARCOAL}\x1b[48;2;255;85;85m ERROR ${RESET} ${message}\n`,
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export async function showSpinner(stopCondition: () => boolean): Promise<void> {
  const chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;

  while (!stopCondition()) {
    process.stdout.write(
      `\r${AMBER}${chars[i % chars.length]}${RESET} Thinking... `,
    );
    i++;
    await new Promise((r) => setTimeout(r, 80));
  }
  process.stdout.write("\r\x1b[K"); // Clear line
}

```

## gemma-api/src/ui/readline.ts

```typescript
import { AMBER, DIM, RESET } from "./theme";

function getVisibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").length;
}

const COMPLETIONS = [
  "/help",
  "/reset",
  "/model",
  "/save",
  "/load",
  "!clear",
  "!model",
  "!bun",
  "!firecrawl",
  "!google",
  "exit",
  "quit",
];

function getSuggestion(input: string): string {
  if (!input || input.startsWith(" ")) return "";
  const match = COMPLETIONS.find((c) => c.startsWith(input) && c !== input);
  return match ? match.slice(input.length) : "";
}

export async function readLineWithHint(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    let lastRelativeCursorRow = 0;

    const render = () => {
      const hint = getSuggestion(buf);
      const cols = process.stdout.columns || 80;
      const visiblePromptLen = getVisibleLength(prompt);

      // Calculate where the cursor IS currently relative to the start of the prompt
      if (lastRelativeCursorRow > 0) {
        process.stdout.write(`\x1b[${lastRelativeCursorRow}A`);
      }
      process.stdout.write("\r"); // Back to start of line
      process.stdout.write("\x1b[J"); // Clear everything below the cursor

      // Print full line (Prompt + Buffer + Hint)
      const fullOutput = `${prompt}${buf}${DIM}${hint}${RESET}`;
      process.stdout.write(fullOutput);

      // Calculate new cursor position
      const totalVisibleLen = visiblePromptLen + buf.length;
      const totalContentLen = totalVisibleLen + hint.length;

      const currentCursorRow = Math.floor(totalVisibleLen / cols);
      const totalRows = Math.floor(totalContentLen / cols);

      // Move cursor back from the end of the HINT to the end of the BUF
      const rowsToMoveUp = totalRows - currentCursorRow;
      if (rowsToMoveUp > 0) {
        process.stdout.write(`\x1b[${rowsToMoveUp}A`);
      }

      // Restore horizontal position
      const currentCol = totalVisibleLen % cols;
      process.stdout.write("\r");
      if (currentCol > 0) {
        process.stdout.write(`\x1b[${currentCol}C`);
      }

      lastRelativeCursorRow = currentCursorRow;
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (key: string) => {
      // Handle Ctrl+V / Pasting (Bun/Node typically delivers this as a chunk)
      if (key.length > 1 && !key.startsWith("\x1b")) {
        buf += key.replace(/[\r\n]/g, ""); // Strip newlines from paste
        render();
        return;
      }

      if (key === "\r" || key === "\n") {
        const hint = getSuggestion(buf);
        if ((hint && buf.startsWith("/")) || buf.startsWith("!")) buf += hint;
        process.stdout.write("\n");
        cleanup();
        resolve(buf);
        return;
      }

      if (key === "\t") {
        const hint = getSuggestion(buf);
        if (hint) {
          buf += hint;
          render();
        }
        return;
      }

      if (key === "\x03") {
        // Ctrl-C
        process.stdout.write("\n");
        cleanup();
        process.exit(0);
      }

      if (key === "\x7f" || key === "\b") {
        // Backspace
        if (buf.length > 0) {
          buf = buf.slice(0, -1);
          render();
        }
        return;
      }

      if (key >= " " && key.length === 1) {
        buf += key;
        render();
      }
    };

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    process.stdin.on("data", onData);
    render();
  });
}

```

## gemma-api/src/ui/selector.ts

```typescript
import { AMBER, BOLD, DIM, RESET } from "./theme";
import { AppState } from "../types";

export async function selectModel(models: string[]): Promise<string | null> {
  const state = AppState.getInstance();
  let idx = models.indexOf(state.model);
  if (idx === -1) idx = 0;

  let firstRender = true;

  // Hide cursor
  process.stdout.write("\x1b[?25l");

  process.stdout.write(
    `\n${AMBER}${BOLD}Select Model${RESET} ${DIM}(↑↓ navigate, Enter confirm, Esc cancel)${RESET}\n`,
  );

  const drawMenu = () => {
    // If not the first time, move cursor up to the start of the list
    if (!firstRender) {
      process.stdout.write(`\x1b[${models.length}A`);
    }

    for (let i = 0; i < models.length; i++) {
      const selected = i === idx;
      const line = selected
        ? `${AMBER}${BOLD}❯ ${models[i]}${RESET}`
        : `${DIM}  ${models[i]}${RESET}`;

      // \r moves to start of line, \x1b[2K clears the line
      process.stdout.write(`\r\x1b[2K${line}\n`);
    }
    firstRender = false;
  };

  drawMenu();

  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve) => {
    const cleanup = (chosen: string | null) => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();

      // Move up to include the "Select Model" header (list length + 1)
      process.stdout.write(`\x1b[${models.length + 1}A`);

      // Clear the header and the entire list
      for (let i = 0; i < models.length + 1; i++) {
        process.stdout.write("\r\x1b[2K\n");
      }

      // Move cursor back to where the header was
      process.stdout.write(`\x1b[${models.length + 1}A`);

      if (chosen) {
        process.stdout.write(
          `\r\x1b[2K${AMBER}${BOLD}Model:${RESET} ${chosen}\n`,
        );
      } else {
        process.stdout.write(
          `\r\x1b[2K${DIM}Model selection cancelled.${RESET}\n`,
        );
      }

      // Show cursor again
      process.stdout.write("\x1b[?25h");
      resolve(chosen);
    };

    const onData = (data: Buffer) => {
      const key = data.toString();

      if (key === "\x1b[A") {
        // Up arrow
        idx = (idx - 1 + models.length) % models.length;
        drawMenu();
      } else if (key === "\x1b[B") {
        // Down arrow
        idx = (idx + 1) % models.length;
        drawMenu();
      } else if (key === "\r" || key === "\n") {
        // Enter
        cleanup(models[idx] || null);
      } else if (key === "\x1b" || key === "\x03") {
        // Esc or Ctrl+C
        cleanup(null);
      }
    };

    process.stdin.on("data", onData);
  });
}

```

## gemma-api/src/ui/theme.ts

```typescript
import { Marked } from "marked";
import TerminalRenderer from "marked-terminal";

// ─── ANSI Colors (Deep Minimalist Amber/Charcoal theme) ───────────────────────

export const AMBER = "\x1b[38;2;255;191;0m";
export const CHARCOAL = "\x1b[38;2;40;40;40m";
export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";

// ─── Markdown Renderer Configuration ─────────────────────────────────────────

export const marked = new Marked();
marked.setOptions({
  renderer: new TerminalRenderer({
    firstHeading: (text: string) =>
      `\x1b[38;2;255;191;0m\x1b[1m${text}\x1b[0m\n`,
    strong: (text: string) => `\x1b[1m\x1b[38;2;255;255;255m${text}\x1b[0m`,
    em: (text: string) => `\x1b[3m${text}\x1b[0m`,
    codespan: (text: string) =>
      `\x1b[48;2;40;40;40m\x1b[38;2;255;191;0m ${text} \x1b[0m`,
    code: (text: string) =>
      `\n\x1b[48;2;30;30;30m\x1b[38;2;200;200;200m${text}\x1b[0m\n`,
    link: (href: string) => `\x1b[38;2;0;255;255m\x1b[4m${href}\x1b[0m`,
  }) as any,
});

```


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

  // OpenRouter model list
  "qwen/qwen3.6-plus:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "minimax/minimax-m2.5:free",
  "stepfun/step-3.5-flash:free",
  "arcee-ai/trinity-large-preview:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "arcee-ai/trinity-mini:free",
  "z-ai/glm-4.5-air:free",
];

export const isOpenRouterModel = (model: string): boolean => model.includes("/");

// ─── Models that support thinkingConfig ───────────────────────────────────────

const THINKING_SUPPORTED_MODELS = new Set([
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash-thinking-exp",
]);

export const supportsThinking = (model: string): boolean =>
  THINKING_SUPPORTED_MODELS.has(model) ||
  model.startsWith("gemini-2.5-pro") ||
  (model.startsWith("gemini-2.5-flash") && !model.includes("lite")) ||
  model.startsWith("gemma-4");

// ─── Environment Loading ──────────────────────────────────────────────────────

export function loadEnv() {
  if (existsSync(ENV_PATH)) {
    const envContent = readFileSync(ENV_PATH, "utf-8");
    envContent.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    });
  }
  return {
    gemini: process.env.GEMINI_API_KEY || null,
    openrouter: process.env.OPENROUTER_API_KEY || null,
  };
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

CORE RESEARCH PROTOCOL:
1. DEEP SEARCH: If a query is factual or news-oriented, perform at least 2-3 distinct searches with different keywords to capture a broad perspective.
2. MANDATORY SCRAPE: Search results often contain only snippets. You MUST use 'scrape_url' on the top 2-3 most relevant links to read full articles before providing a final answer.
3. ITERATE: If the scraped content is insufficient or refers to other sources, continue searching and scraping until you have high-confidence data.
4. VALIDATION: Cross-reference facts between different scraped sources.

URGENT RULES:
- The date/time provided above is your ACTUAL REALITY. Treat years like 2024-2026 as the present.
- Be direct and concise. Use minimal formatting unless detail is explicitly requested.
- If 'bun_search' returns technical logs or empty results, try alternative search queries immediately.
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

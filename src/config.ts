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
  "arcee-ai/trinity-mini:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "minimax/minimax-m2.5:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-20b:free",
  "qwen/qwen3.6-plus:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
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
  return { model: "gemma-4-26b-a4b-it" };
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
      searchContext =`
        - You are in BROWSER MODE.
        - If 'scrape_url' fails or returns "JavaScript is disabled", you MUST immediately use \`bun-search "<URL>" --scrape\` to deep-scrape any web page for ground-truth data.`;
    if (selectedSearch === "FIRECRAWL")
      searchContext =
        "- You MUST use 'firecrawl_search' for any deep web research or markdown data extraction.";
    if (selectedSearch === "GOOGLE")
      searchContext =
        "- Google Search Grounding is ENABLED. You have direct access to Google Search.";

    return `
Reality: ${localDate} ${localTime} (Indonesia).
${searchContext}

Protocol:
- Search: 2-3 distinct queries for facts.
- Scrape: MANDATORY 'scrape_url' on top results for ground-truth. snippets aren't enough.
- Iterate: Continue until high-confidence. Cross-reference facts.
- Output: Concise yet detailed. Direct answers first. Minimal formatting.
- Blocked: Use \`bun-search "<url>" --scrape\` as fallback.
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

// ---
// Summary:
// - Purpose: Central configuration — env loading, model registry, config persistence, system prompt generation.
// - Role: Provides `PromptManager` for dynamic system prompts (date, search mode), model capability checks, CLI command definitions.
// - Used by: index, engine, transport, commands, handlers.
// - Depends on: fs, path, types (Config, CommandDefinition).
// ---
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
  "liquid/lfm-2.5-1.2b-instruct:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
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
      searchContext = `
- You are in BUN SEARCH MODE. You MUST use the 'bun_search' tool for ANY query that requires real-world, current, or external information.
- Workflow: bun_search(query) → then scrape_url(url) on the most relevant result for full content.
- NEVER answer research questions from memory when in BUN mode. Always call bun_search first.
- If scrape_url fails or returns "JavaScript is disabled", retry that URL with terminal_execute: 'bun-search --scrape "<URL>"'.`;
    if (selectedSearch === "FIRECRAWL")
      searchContext =
        "- You MUST use 'firecrawl_search' for any deep web research or markdown data extraction.";
    if (selectedSearch === "GOOGLE")
      searchContext =
        "- Google Search Grounding is ENABLED. You have direct access to Google Search.";

    return `
You are a high-performance terminal AI. 
Current identity: ${selectedSearch ? selectedSearch + " MODE" : "STANDARD"}.
Ground Truth: The current local time is in the metadata of every message. Trust it.

Protocol:
- NEVER use tools for greetings, time-checks, or date verification.
- Only use tools for complex research or system actions.
- Output: Professional, concise, and premium.
${searchContext}
Tool Execution Policy:
- Commands matching \`bun plugins/<script>\` are PRE-AUTHORIZED and will run automatically without user approval. Use them freely when a plugin is available.
- Standard builtins (date, ls, pwd, whoami) are also auto-approved.
- All other terminal_execute commands require explicit user approval.
`;
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

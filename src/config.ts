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
  // Gemini models
  "gemma-4-31b-it",
  "gemma-4-26b-a4b-it", // default
  "gemini-2.5-flash-lite",
  "gemini-3.1-flash-lite-preview",

  // OpenRouter models
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

    let extraInstructions = "";
    const gemmaMdPath = join(PROJ_ROOT, "gemma.md");
    if (existsSync(gemmaMdPath)) {
      try {
        extraInstructions = readFileSync(gemmaMdPath, "utf-8") + "\n\n";
      } catch (e) {
        // Fallback to empty if read fails
      }
    }

    let searchContext = "";
    if (selectedSearch === "BUN")
      searchContext = `
- You are in BUN SEARCH MODE. You MUST use 'bun_search' for any current or external facts.
- **EFFICIENCY RULE**: Use 'bun_search' ONCE. It returns an 'AI OVERVIEW' (SGE result) and multiple snippets. These are often sufficient alone.
- Do NOT loop. If you have the answer in the first search, stop and synthesize.
- Only use 'scrape_url' if the search snippets are clearly missing the specific detail you need.
- DO NOT perform more than 2 sequential searches for a single request. If still unsure, state what you found and what is missing.`;
    if (selectedSearch === "FIRECRAWL")
      searchContext =
        "- You MUST use 'firecrawl_search' for any deep web research or markdown data extraction.";
    if (selectedSearch === "GOOGLE")
      searchContext =
        "- Google Search Grounding is ENABLED. You have direct access to Google Search.";

    return `
${extraInstructions}High-performance terminal AI. ID: ${selectedSearch || "STD"}.
Current Date: ${localDate} ${localTime}.
OS: Windows Native. Shell: PowerShell. No WSL.
Env: Project linked in current directory.

Capabilities & Rules:
- Native PS ONLY (Get-Date, etc). NO Bash/Unix.
- Professional & concise.
- NEVER call 'terminal_execute' for current date/time (provided above).
- You have custom plugins in './plugins/'. Use 'list_files path="plugins"' to see them if unsure.
- Tools like 'check_weather' are optimized for specific locations (e.g. Bojongsoang). Prefer these over generic searches if they match the user's intent.
${searchContext}
- CMDS 'bun run plugins/*' & 'bun plugins/*' & standard builtins (ls, pwd, etc) AUTO-APPROVED.
- Other terminal commands need explicit user confirmation.
`;
  }

}

// ─── Command Definitions ──────────────────────────────────────────────────────

export const COMMANDS: CommandDefinition[] = [
  { cmd: "/help or /", desc: "Show this help menu" },
  { cmd: "/reset or !clear", desc: "Clear conversation history" },
  { cmd: "/model or !model [model]", desc: "Change the AI model" },
  { cmd: "/summarize", desc: "Summarize old history" },
  { cmd: "!bun / !firecrawl / !google", desc: "Search modes" },
  { cmd: "exit / quit / \\q", desc: "Exit" },
];

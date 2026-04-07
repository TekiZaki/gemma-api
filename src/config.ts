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

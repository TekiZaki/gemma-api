// ---
// Summary:
// - Purpose: CLI command parser and search mode resolver for REPL interactions.
// - Role: Handles `/model`, `/save`, `/load`, `/reset`, exit commands; detects `!bun/!firecrawl/!google` search flags.
// - Used by: index.ts (REPL loop).
// - Depends on: config, ui/theme, ui/components, ui/selector, ai/engine, ai/history, types.
// ---
import type * as readLine from "readline/promises";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { GoogleGenAI } from "@google/genai";
import { AMBER, BOLD, DIM, RESET } from "./ui/theme";
import { printError, printHeader, printSuccess, printInfo } from "./ui/components";
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
  const state = AppState.getInstance();
  
  if (/using bun-search|!bun/i.test(prompt)) {
    state.searchMode = "BUN";
    return "BUN";
  }
  if (/using firecrawl|!firecrawl/i.test(prompt)) {
    state.searchMode = "FIRECRAWL";
    return "FIRECRAWL";
  }
  if (/using google search|!google/i.test(prompt)) {
    state.searchMode = "GOOGLE";
    return "GOOGLE";
  }
  
  // No prefix found - use existing state if available
  return state.searchMode;
}

export function stripSearchFlags(prompt: string): string {
  return prompt
    .replace(/!bun/gi, "")
    .replace(/!firecrawl/gi, "")
    .replace(/!google/gi, "")
    .replace(/using bun-search/gi, "")
    .replace(/using firecrawl/gi, "")
    .replace(/using google search/gi, "")
    .trim();
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
    state.searchMode = undefined;
    await runTurn("SYSTEM_INIT_ACK", ai, history.getHistory(), rl, stats, {
      silent: true,
    });
    printSuccess("Conversation history cleared.");
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
      const selected = await selectModel(AVAILABLE_MODELS);

      if (selected && selected !== state.model) {
        state.model = selected;
        saveConfig({ model: state.model });
        history.reset(); // RESET HISTORY on model switch
        printHeader(state.model);
        printSuccess(`Switched to ${state.model} (saved)`);
        printInfo("Context cleared to prevent cross-model behavior.");
      }
    } else if (AVAILABLE_MODELS.includes(modelArg)) {
      state.model = modelArg;
      saveConfig({ model: state.model });
      history.reset();
      printSuccess(`Switched to ${state.model} (saved)`);
      printInfo("Context cleared to prevent cross-model behavior.");
    } else {
      printError(`Invalid model. Available: ${AVAILABLE_MODELS.join(", ")}`);
    }
    return { handled: true, shouldExit: false };
  }

  // Summarize command
  if (cleanAnswer.toLowerCase() === "/summarize") {
    const currentHistory = history.getHistory();
    if (currentHistory.length < 5) {
      printInfo("History too short to summarize efficiently.");
      return { handled: true, shouldExit: false };
    }

    printInfo("Summarizing old conversation turns...");
    const toSummarize = currentHistory.slice(0, -2); // Summarize all but last 2
    const summaryPrompt = `Summarize the following conversation history briefly and objectively. Maintain key facts but strip nuance. Output ONLY the summary text.\n\n${JSON.stringify(toSummarize)}`;
    
    // We execute this as a separate AI turn without updating history yet
    try {
      const response = await ai.models.generateContent({
        model: state.model,
        contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
      });
      
      const summaryText = response.text || "";
      
      history.squash(summaryText, toSummarize.length);
      printSuccess("History summarized and squashed.");
    } catch (e: any) {
      printError("Summarization failed: " + e.message);
    }
    return { handled: true, shouldExit: false };
  }

  // Not a command - return false
  return { handled: false, shouldExit: false };
}

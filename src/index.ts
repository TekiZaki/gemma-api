#!/usr/bin/env bun
// ---
// Summary:
// - Purpose: Application entry point — bootstraps env, config, AI client, and routes to REPL or single-shot mode.
// - Role: Orchestrates initialization (plugins, history, stats, model sync) and runs the main event loop.
// - Used by: CLI bin (`gemma-api` command).
// - Depends on: config, ai/engine, ai/history, commands, ui/components, ui/input, tools/plugin-manager.
// ---
import { GoogleGenAI } from "@google/genai";
import * as readLine from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { loadEnv, loadConfig, AVAILABLE_MODELS, isOpenRouterModel, PromptManager } from "./config";

import { printHeader, printError, printInfo } from "./ui/components";
import { runTurn } from "./ai/engine";
import { HistoryManager } from "./ai/history";
import { resolveSearchFeature, readStdin, handleCommand, stripSearchFlags } from "./commands";
import { AppState, SessionStats as SessionStatsClass } from "./types";
import type { SessionStats } from "./types";
import { DIM, AMBER, RESET } from "./ui/theme";
import { loadPlugins } from "./tools/plugin-manager";
import { readInputWithSuggestions } from "./ui/input";



// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load environment and config
  const apiKeys = loadEnv();
  const config = loadConfig();

  // Initialize state singleton
  const state = AppState.initialize(config.model);

  // Load dynamic plugins
  await loadPlugins();


  // Initialize session stats
  const stats = new SessionStatsClass();

  // Print header with current model
  printHeader(state.model);

  const isOR = isOpenRouterModel(state.model);
  if (isOR && !apiKeys.openrouter) {
    printError(`OPENROUTER_API_KEY not found.`);
    process.exit(1);
  }
  if (!isOR && !apiKeys.gemini) {
    printError(`GEMINI_API_KEY not found.`);
    process.exit(1);
  }

  // Check for stdin content
  const stdinContent = await readStdin();

  // Initialize AI and readline
  const ai = new GoogleGenAI({ apiKey: apiKeys.gemini || "" });
  const rl = readLine.createInterface({
    input,
    output,
  });

  // Initialize history manager
  const history = new HistoryManager();
  
  // No startup sync turns (prevents token bloat).

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
    const cleanPromptWithNoFlags = stripSearchFlags(cleanPrompt);
    await runTurn(cleanPromptWithNoFlags, ai, history.getHistory(), rl, stats, {
      selectedSearch,
      piped: !!stdinContent,
      noTools,
    });
    rl.close();
  } else {
    // REPL mode
    printInfo("Entering REPL mode. Type 'exit' or 'quit' to end.");
    console.log(`${DIM}Session Total: ${stats.totalTokens}${RESET}`);
    try {
      while (true) {
        const answer = await readInputWithSuggestions(`${AMBER}?> ${RESET}`);

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

        const selectedSearch = await resolveSearchFeature(cleanAnswer, rl);
        const cleanPromptWithNoFlags = stripSearchFlags(cleanAnswer);
        await runTurn(cleanPromptWithNoFlags, ai, history.getHistory(), rl, stats, {
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

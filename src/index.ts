#!/usr/bin/env bun
import { GoogleGenAI } from "@google/genai";
import * as readLine from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { loadEnv, loadConfig, AVAILABLE_MODELS, isOpenRouterModel, PromptManager } from "./config";

import { printHeader, printError } from "./ui/components";
import { runTurn } from "./ai/engine";
import { HistoryManager } from "./ai/history";
import { resolveSearchFeature, readStdin, handleCommand } from "./commands";
import { AppState, SessionStats as SessionStatsClass } from "./types";
import type { SessionStats } from "./types";
import { DIM, AMBER, RESET } from "./ui/theme";
import { loadPlugins } from "./tools/plugin-manager";



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
    completer: (line: string): [string[], string] => {
      const commands = [
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

      // Handle model autocomplete
      if (line.startsWith("/model ") || line.startsWith("!model ")) {
        const prefix = line.substring(0, 7); // "/model " or "!model "
        const search = line.substring(7).trim();
        const modelHits = AVAILABLE_MODELS.filter((m) => m.startsWith(search));
        return [modelHits.map((m) => prefix + m), line];
      }

      // Handle standard command autocomplete
      const hits = commands.filter((c) => c.startsWith(line));
      return [hits.length ? hits : line === "/" ? commands : [], line];
    },
  });

  // Initialize history manager
  const history = new HistoryManager();
  
  // Combine time sync and init into one turn to avoid double user roles
  const initPrompt = `${PromptManager.getSystemSyncMessage()}\n\nSYSTEM_INIT_SYNC_REQUEST`;
  
  await runTurn(initPrompt, ai, history.getHistory(), rl, stats, {
    silent: true,
    noTools: true,
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
        const answer = await rl.question(`${AMBER}?> ${RESET}`);

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

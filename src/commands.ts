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

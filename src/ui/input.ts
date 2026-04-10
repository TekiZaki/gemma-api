// ---
// Summary:
// - Purpose: Custom raw stdin reader with tab-completion, history navigation, and inline command/model suggestions.
// - Role: Bypasses readline for full control; renders suggestions below prompt, tracks cursor position, manages global history.
// - Used by: index.ts (REPL input loop).
// - Depends on: readline (keypress events), theme, config (AVAILABLE_MODELS).
// ---
import * as readLine from "readline";
import { AMBER, RESET, DIM, BOLD } from "./theme";
import { AVAILABLE_MODELS } from "../config";
import { getVisibleLength } from "./components";

const COMMANDS = [
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

let globalHistory: string[] = [];
let historyIndex = -1;

export async function readInputWithSuggestions(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    let currentInput = "";
    let lastSuggestionCount = 0;
    let cursorPosition = 0;

    const clearSuggestions = () => {
      // Clear from current cursor position to end of screen
      process.stdout.write("\x1b[0J");
      lastSuggestionCount = 0;
    };

    const render = () => {
      // 1. Move to start of line and clear everything from here down
      process.stdout.write("\r\x1b[0J");

      // 2. Write prompt + current input
      process.stdout.write(`${prompt}${currentInput}`);

      // 3. Move cursor back to the correct position within the input
      const moveLeft = currentInput.length - cursorPosition;
      if (moveLeft > 0) {
        process.stdout.write(`\x1b[${moveLeft}D`);
      }

      // 4. Calculate suggestions
      let suggestions: string[] = [];
      if (currentInput.startsWith("/") || currentInput.startsWith("!")) {
        if (currentInput.startsWith("/model ") || currentInput.startsWith("!model ")) {
          const prefix = currentInput.substring(0, 7);
          const search = currentInput.substring(7).trim();
          suggestions = AVAILABLE_MODELS.filter((m) => m.startsWith(search)).map(
            (m) => prefix + m
          );
        } else {
          suggestions = COMMANDS.filter((cmd) => cmd.startsWith(currentInput));
        }
      }

      // 5. Render suggestions if any
      if (suggestions.length > 0) {
        const visibleSuggestions = suggestions.slice(0, 8);
        for (const s of visibleSuggestions) {
          process.stdout.write(`\n\x1b[2K${DIM}  ${s}${RESET}`);
        }

        // 6. Move cursor back UP to the prompt line
        process.stdout.write(`\x1b[${visibleSuggestions.length}A`);

        // 7. Restore horizontal position
        const visiblePromptLen = getVisibleLength(prompt);
        const cursorCol = visiblePromptLen + cursorPosition;
        process.stdout.write(`\r\x1b[${cursorCol}C`);
        
        lastSuggestionCount = visibleSuggestions.length;
      }
    };

    const onKeypress = (str: string, key: any) => {
      if (key.name === "return") {
        clearSuggestions();
        process.stdout.write("\n");
        cleanup();
        const trimmed = currentInput.trim();
        if (trimmed && globalHistory[0] !== trimmed) {
           globalHistory.unshift(trimmed);
        }
        historyIndex = -1;
        resolve(trimmed);
      } else if (key.ctrl && key.name === "c") {
        clearSuggestions();
        process.stdout.write("\n");
        process.exit();
      } else if (key.name === "backspace") {
        if (cursorPosition > 0) {
          currentInput =
            currentInput.slice(0, cursorPosition - 1) +
            currentInput.slice(cursorPosition);
          cursorPosition--;
          render();
        }
      } else if (key.name === "delete") {
        if (cursorPosition < currentInput.length) {
          currentInput =
            currentInput.slice(0, cursorPosition) +
            currentInput.slice(cursorPosition + 1);
          render();
        }
      } else if (key.name === "left") {
        if (cursorPosition > 0) {
          cursorPosition--;
          render();
        }
      } else if (key.name === "right") {
        if (cursorPosition < currentInput.length) {
          cursorPosition++;
          render();
        }
      } else if (key.name === "up") {
        if (historyIndex < globalHistory.length - 1) {
          historyIndex++;
          currentInput = globalHistory[historyIndex] ?? "";
          cursorPosition = currentInput.length;
          render();
        }
      } else if (key.name === "down") {
        if (historyIndex > 0) {
          historyIndex--;
          currentInput = globalHistory[historyIndex] ?? "";
          cursorPosition = currentInput.length;
          render();
        } else if (historyIndex === 0) {
          historyIndex = -1;
          currentInput = "";
          cursorPosition = 0;
          render();
        }
      } else if (key.name === "tab") {
        // Complete first suggestion
        let suggestions: string[] = [];
        if (currentInput.startsWith("/") || currentInput.startsWith("!")) {
          if (currentInput.startsWith("/model ") || currentInput.startsWith("!model ")) {
            const prefix = currentInput.substring(0, 7);
            const search = currentInput.substring(7).trim();
            suggestions = AVAILABLE_MODELS.filter((m) => m.startsWith(search)).map(
              (m) => prefix + m
            );
          } else {
            suggestions = COMMANDS.filter((cmd) => cmd.startsWith(currentInput));
          }
        }
        if (suggestions.length > 0) {
          currentInput = suggestions[0] ?? "";
          cursorPosition = currentInput.length;
          render();
        }
      } else if (str && !key.ctrl && !key.meta) {
        currentInput =
          currentInput.slice(0, cursorPosition) +
          str +
          currentInput.slice(cursorPosition);
        cursorPosition += str.length;
        render();
      }
    };

    const cleanup = () => {
      process.stdin.removeListener("keypress", onKeypress);
      // NOTE: do NOT call stdin.pause() here — readline's rl.question() needs
      // stdin to stay open. Raw mode is disabled so readline can take over.
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
    };

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    readLine.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", onKeypress);

    render();
  });
}

/**
 * Single-keypress yes/no prompt that stays in raw mode throughout.
 * Avoids all readline ownership conflicts — never disables raw mode,
 * never hands stdin to a readline instance.
 *
 * Returns true only when the user presses 'y' / 'Y'.
 * Any other key (including Enter / N / Esc / Ctrl-C) → false.
 */
export async function askYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Ensure raw mode is active (it should already be, but be explicit).
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    readLine.emitKeypressEvents(process.stdin);

    process.stdout.write(question);

    const onKey = (str: string, key: any) => {
      process.stdin.removeListener("keypress", onKey);

      const ch = (str || "").toLowerCase();

      // Echo the pressed character and move to next line.
      process.stdout.write(`${ch}\n`);

      // Ctrl-C → exit immediately, consistent with rest of app.
      if (key?.ctrl && key?.name === "c") {
        process.exit();
      }

      resolve(ch === "y");
    };

    process.stdin.on("keypress", onKey);
  });
}

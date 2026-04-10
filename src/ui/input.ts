import * as readLine from "readline";
import { AMBER, RESET, DIM, BOLD } from "./theme";
import { AVAILABLE_MODELS } from "../config";

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
      if (lastSuggestionCount > 0) {
        // Since we used \x1b8 in the previous render, we are already back at the prompt.
        // We just need to clear everything below the current line.
        process.stdout.write("\x1b7");      // Save current position
        process.stdout.write("\n\x1b[J");   // Move to next line and clear to bottom of screen
        process.stdout.write("\x1b8");      // Restore position to the prompt line
        lastSuggestionCount = 0;
      }
    };

    const render = () => {
      // 1. Clear previous suggestions
      clearSuggestions();

      // 2. Clear current line and write prompt + input
      process.stdout.write("\r\x1b[2K");
      process.stdout.write(`${prompt}${currentInput}`);

      // 3. Move cursor to correct position
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

      // 5. Render suggestions
      if (suggestions.length > 0) {
        // Save cursor position
        process.stdout.write("\x1b7");

        process.stdout.write("\n");
        const visibleSuggestions = suggestions.slice(0, 8); // Show top 8
        for (const s of visibleSuggestions) {
          process.stdout.write(`${DIM}  ${s}${RESET}\n`);
        }
        
        lastSuggestionCount = visibleSuggestions.length + 1;

        // Restore cursor position
        process.stdout.write("\x1b8");
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
          currentInput = globalHistory[historyIndex];
          cursorPosition = currentInput.length;
          render();
        }
      } else if (key.name === "down") {
        if (historyIndex > 0) {
          historyIndex--;
          currentInput = globalHistory[historyIndex];
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
          currentInput = suggestions[0];
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
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
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

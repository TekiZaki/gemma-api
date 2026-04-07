import * as readline from "node:readline";
import { AMBER, DIM, RESET } from "./theme";

function getVisibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").length;
}

const COMPLETIONS = [
  "/help", "/reset", "/model", "/save", "/load",
  "!clear", "!model", "!bun", "!firecrawl", "!google",
  "exit", "quit",
];

function getSuggestion(input: string): string {
  if (!input || input.startsWith(" ")) return "";
  const match = COMPLETIONS.find((c) => c.startsWith(input) && c !== input);
  return match ? match.slice(input.length) : "";
}

export async function readLineWithHint(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    let buf = "";
    let lastRelativeCursorRow = 0;

    const render = () => {
      const cols = process.stdout.columns || 80;
      const visiblePromptLen = getVisibleLength(prompt);
      const hint = getSuggestion(buf);
      const fullContent = `${prompt}${buf}${DIM}${hint}${RESET}`;

      // 1. Move cursor back to the start of the prompt block
      if (lastRelativeCursorRow > 0) {
        readline.moveCursor(process.stdout, 0, -lastRelativeCursorRow);
      }
      readline.cursorTo(process.stdout, 0);

      // 2. Clear everything from that point down to erase previous prompt
      readline.clearScreenDown(process.stdout);

      // 3. Print the new content
      process.stdout.write(fullContent);

      // 4. Calculate where the cursor should sit (end of user buffer, before hint)
      const currentPos = visiblePromptLen + buf.length;

      // Correct row/col for terminal line wrapping.
      // When currentPos is exactly a multiple of cols, the cursor is at the
      // start of the NEXT row (col 0), not at col 0 of the current row.
      const currentRow = Math.floor(currentPos / cols);
      const currentCol = currentPos % cols;

      // 5. Calculate total height of what we just printed
      const totalLen = visiblePromptLen + buf.length + hint.length;
      // totalRows is the index of the last row (0-based)
      const totalRows = totalLen > 0 ? Math.floor((totalLen - 1) / cols) : 0;

      // 6. Move cursor back from the end of the total text to the user's cursor position
      const rowsToMoveUp = totalRows - currentRow;
      if (rowsToMoveUp > 0) {
        readline.moveCursor(process.stdout, 0, -rowsToMoveUp);
      }

      // 7. Reset horizontal position to the correct column
      readline.cursorTo(process.stdout, currentCol);

      lastRelativeCursorRow = currentRow;
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (key: string) => {
      // Handle Pasting
      if (key.length > 1 && !key.startsWith("\x1b")) {
        buf += key.replace(/[\r\n]/g, ""); 
        render();
        return;
      }

      if (key === "\r" || key === "\n") {
        const hint = getSuggestion(buf);
        if ((hint && buf.startsWith("/")) || buf.startsWith("!")) buf += hint;
        process.stdout.write("\n");
        cleanup();
        resolve(buf);
        return;
      }

      if (key === "\t") {
        const hint = getSuggestion(buf);
        if (hint) {
          buf += hint;
          render();
        }
        return;
      }

      if (key === "\x03") { // Ctrl+C
        process.stdout.write("\n");
        cleanup();
        process.exit(0);
      }

      if (key === "\x7f" || key === "\b") { // Backspace
        if (buf.length > 0) {
          buf = buf.slice(0, -1);
          render();
        }
        return;
      }

      if (key >= " " && key.length === 1) {
        buf += key;
        render();
      }
    };

    const cleanup = () => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    process.stdin.on("data", onData);
    render();
  });
}
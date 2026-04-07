import { AMBER, DIM, RESET } from "./theme";

function getVisibleLength(str: string): number {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").length;
}

const COMPLETIONS = [
  "/help",
  "/reset",
  "/model",
  "/save",
  "/load",
  "!clear",
  "!model",
  "!bun",
  "!firecrawl",
  "!google",
  "exit",
  "quit",
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
      const hint = getSuggestion(buf);
      const cols = process.stdout.columns || 80;
      const visiblePromptLen = getVisibleLength(prompt);

      // Calculate where the cursor IS currently relative to the start of the prompt
      if (lastRelativeCursorRow > 0) {
        process.stdout.write(`\x1b[${lastRelativeCursorRow}A`);
      }
      process.stdout.write("\r"); // Back to start of line
      process.stdout.write("\x1b[J"); // Clear everything below the cursor

      // Print full line (Prompt + Buffer + Hint)
      const fullOutput = `${prompt}${buf}${DIM}${hint}${RESET}`;
      process.stdout.write(fullOutput);

      // Calculate new cursor position
      const totalVisibleLen = visiblePromptLen + buf.length;
      const totalContentLen = totalVisibleLen + hint.length;

      const currentCursorRow = Math.floor(totalVisibleLen / cols);
      const totalRows = Math.floor(totalContentLen / cols);

      // Move cursor back from the end of the HINT to the end of the BUF
      const rowsToMoveUp = totalRows - currentCursorRow;
      if (rowsToMoveUp > 0) {
        process.stdout.write(`\x1b[${rowsToMoveUp}A`);
      }

      // Restore horizontal position
      const currentCol = totalVisibleLen % cols;
      process.stdout.write("\r");
      if (currentCol > 0) {
        process.stdout.write(`\x1b[${currentCol}C`);
      }

      lastRelativeCursorRow = currentCursorRow;
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const onData = (key: string) => {
      // Handle Ctrl+V / Pasting (Bun/Node typically delivers this as a chunk)
      if (key.length > 1 && !key.startsWith("\x1b")) {
        buf += key.replace(/[\r\n]/g, ""); // Strip newlines from paste
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

      if (key === "\x03") {
        // Ctrl-C
        process.stdout.write("\n");
        cleanup();
        process.exit(0);
      }

      if (key === "\x7f" || key === "\b") {
        // Backspace
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

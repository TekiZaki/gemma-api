import { AMBER, BOLD, DIM, RESET } from "./theme";
import { AppState } from "../types";

export async function selectModel(models: string[]): Promise<string | null> {
  const state = AppState.getInstance();
  let idx = models.indexOf(state.model);
  if (idx === -1) idx = 0;

  let firstRender = true;

  // Hide cursor
  process.stdout.write("\x1b[?25l");

  process.stdout.write(
    `\n${AMBER}${BOLD}Select Model${RESET} ${DIM}(↑↓ navigate, Enter confirm, Esc cancel)${RESET}\n`,
  );

  const drawMenu = () => {
    // If not the first time, move cursor up to the start of the list
    if (!firstRender) {
      process.stdout.write(`\x1b[${models.length}A`);
    }

    for (let i = 0; i < models.length; i++) {
      const selected = i === idx;
      const line = selected
        ? `${AMBER}${BOLD}❯ ${models[i]}${RESET}`
        : `${DIM}  ${models[i]}${RESET}`;

      // \r moves to start of line, \x1b[2K clears the line
      process.stdout.write(`\r\x1b[2K${line}\n`);
    }
    firstRender = false;
  };

  drawMenu();

  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve) => {
    const cleanup = (chosen: string | null) => {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();

      // Move up to include the "Select Model" header (list length + 1)
      process.stdout.write(`\x1b[${models.length + 1}A`);

      // Clear the header and the entire list
      for (let i = 0; i < models.length + 1; i++) {
        process.stdout.write("\r\x1b[2K\n");
      }

      // Move cursor back to where the header was
      process.stdout.write(`\x1b[${models.length + 1}A`);

      if (chosen) {
        process.stdout.write(
          `\r\x1b[2K${AMBER}${BOLD}Model:${RESET} ${chosen}\n`,
        );
      } else {
        process.stdout.write(
          `\r\x1b[2K${DIM}Model selection cancelled.${RESET}\n`,
        );
      }

      // Show cursor again
      process.stdout.write("\x1b[?25h");
      resolve(chosen);
    };

    const onData = (data: Buffer) => {
      const key = data.toString();

      if (key === "\x1b[A") {
        // Up arrow
        idx = (idx - 1 + models.length) % models.length;
        drawMenu();
      } else if (key === "\x1b[B") {
        // Down arrow
        idx = (idx + 1) % models.length;
        drawMenu();
      } else if (key === "\r" || key === "\n") {
        // Enter
        cleanup(models[idx] || null);
      } else if (key === "\x1b" || key === "\x03") {
        // Esc or Ctrl+C
        cleanup(null);
      }
    };

    process.stdin.on("data", onData);
  });
}

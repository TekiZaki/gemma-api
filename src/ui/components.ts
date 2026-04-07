import { AMBER, BOLD, CHARCOAL, DIM, RESET } from "./theme";
import type { UsageMetadata } from "../types";

// ─── Header ───────────────────────────────────────────────────────────────────

export function printHeader(modelName: string): void {
  console.log(
    `\n${AMBER}${BOLD}GEMINI CLI :: ${modelName}${RESET}\n${DIM}${"-".repeat(50)}${RESET}\n`,
  );
}

// ─── Usage Stats ──────────────────────────────────────────────────────────────

export function printUsage(
  modelName: string,
  usage: UsageMetadata,
  sessionTotal: number,
): void {
  const {
    promptTokenCount = 0,
    candidatesTokenCount = 0,
    totalTokenCount = 0,
  } = usage;

  console.log(
    `\n${DIM}[${modelName}] Tokens: ${promptTokenCount} prompt + ${candidatesTokenCount} completion = ${totalTokenCount} total${RESET}`,
  );
  console.log(`${DIM}Session Total: ${sessionTotal}${RESET}`);
}

// ─── Error Display ────────────────────────────────────────────────────────────

export function printError(message: string): void {
  console.error(
    `\n${CHARCOAL}\x1b[48;2;255;85;85m ERROR ${RESET} ${message}\n`,
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export async function showSpinner(stopCondition: () => boolean): Promise<void> {
  const chars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;

  while (!stopCondition()) {
    process.stdout.write(
      `\r${AMBER}${chars[i % chars.length]}${RESET} Thinking... `,
    );
    i++;
    await new Promise((r) => setTimeout(r, 80));
  }
  process.stdout.write("\r\x1b[K"); // Clear line
}

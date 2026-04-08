import { GoogleGenAI } from "@google/genai";
import type * as readLine from "readline/promises";
import { marked } from "../ui/theme";
import { AMBER, BOLD, RESET, DIM, CHARCOAL } from "../ui/theme";
import { showSpinner, getLineHeight } from "../ui/components";
import { printError, printUsage } from "../ui/components";
import { AppState } from "../types";
import { getStream } from "./transport";
import { handleToolCalls } from "../tools/executor";
import type {
  ConversationTurn,
  TurnOptions,
  UsageAccumulator,
  SessionStats,
} from "../types";


// ─── Run Turn ─────────────────────────────────────────────────────────────────

export async function runTurn(
  prompt: string,
  ai: GoogleGenAI,
  contents: ConversationTurn[],
  rl: readLine.Interface,
  stats: SessionStats,
  options: TurnOptions = {},
): Promise<void> {
  const state = AppState.getInstance();
  const {
    silent = false,
    selectedSearch,
    piped = false,
    noTools = false,
  } = options;
  const usageAcc: UsageAccumulator = { p: 0, c: 0 };
  const now = new Date();
  const dateStr = now.toLocaleString("en-ID", { timeZone: "Asia/Jakarta" });
  let spinnerRunning = true;
  let spinnerPromise: Promise<void> = Promise.resolve();

  try {
    contents.push({ role: "user", parts: [{ text: prompt }] });

    spinnerPromise = silent
      ? Promise.resolve()
      : showSpinner(() => !spinnerRunning);

    let activeTools: any[] = [];
    if (!noTools) {
      if (selectedSearch === "GOOGLE") {
        activeTools = [{ googleSearch: {} }];
      } else {
        // Import tool definitions dynamically to avoid circular deps
        const { toolDefinitions } = await import("../tools/definitions");
        activeTools = [...toolDefinitions];
      }
    }
    try {
      const stream = getStream(state.model, contents, {
        ai,
        activeTools,
        selectedSearch,
      });

      spinnerRunning = false;
      await spinnerPromise;

      let response: any = null;
      let hasText = false;
      let mergedParts: any[] = [];

      for await (const chunk of stream) {
        response = chunk;
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        mergedParts.push(...parts);
        const text = parts
          .filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join("");
        if (text && !silent) {
          if (!hasText) {
            process.stdout.write(`\n${AMBER}${BOLD} RESPONSE ${RESET}\n`);
            hasText = true;
          }
          process.stdout.write(text);
        }
      }

      if (hasText && !silent) {
        const fullText = mergedParts
          .filter((p: any) => p.text)
          .map((p: any) => p.text)
          .join("");

        const terminalWidth = process.stdout.columns || 80;
        // Calculate actual rows taken by the "RESPONSE" header and the streamed text
        const totalRows = getLineHeight(
          `${AMBER}${BOLD} RESPONSE ${RESET}\n` + fullText,
          terminalWidth,
        );

        process.stdout.write(`\r\x1b[K`);
        // Move up the actual number of visual rows used
        for (let l = 0; l < totalRows; l++) {
          process.stdout.write("\x1b[1A\x1b[2K");
        }

        process.stdout.write(`\n${AMBER}${BOLD} RESPONSE ${RESET}\n`);
        console.log((await marked.parse(fullText)).trim());
      }

      if (!response) return;

      if (response.usageMetadata) {
        usageAcc.p += response.usageMetadata.promptTokenCount || 0;
        usageAcc.c += response.usageMetadata.candidatesTokenCount || 0;
        stats.accumulate(response.usageMetadata);
      }

      if (response.candidates?.[0]?.content) {
        response.candidates[0].content.parts = mergedParts;
      }

      const finalResponse = await handleToolCalls(
        ai,
        contents,
        response,
        rl,
        selectedSearch,
        usageAcc,
        stats,
        piped,
        noTools,
      );

      if (finalResponse.candidates?.[0]?.content) {
        const alreadyInContents = contents.some(
          (c) => c === finalResponse.candidates[0].content,
        );
        if (!alreadyInContents) {
          contents.push(finalResponse.candidates[0].content);
        }
      }

      if (!silent) {
        printUsage(
          state.model,
          {
            promptTokenCount: usageAcc.p,
            candidatesTokenCount: usageAcc.c,
            totalTokenCount: usageAcc.p + usageAcc.c,
          },
          stats.totalTokens,
        );
      }
    } catch (innerError: any) {
      spinnerRunning = false;
      await spinnerPromise;
      throw innerError;
    }
  } catch (error: any) {
    if (!silent) printError(error.message || "An unexpected error occurred.");
  }
}

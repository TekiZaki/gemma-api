// ---
// Summary:
// - Purpose: Core AI turn orchestration — streams responses, injects session context, delegates tool execution.
// - Role: Bridges transport (streaming), session clock (time events), and tools (executor);
//          renders markdown output and usage stats.
// - Used by: index.ts (main loop), commands.ts (reset ack), executor.ts (recursive tool turns).
// - Depends on: transport, session, tools/executor, ui/components, ui/theme, types.
// ---
import { GoogleGenAI } from "@google/genai";
import type * as readLine from "readline/promises";
import { marked } from "../ui/theme";
import { AMBER, BOLD, RESET, DIM } from "../ui/theme";
import { showSpinner } from "../ui/components";

import { printError, printUsage, printResponse } from "../ui/components";
import { AppState } from "../types";
import { getStream } from "./transport";
import { handleToolCalls } from "../tools/executor";
import type {
  ConversationTurn,
  TurnOptions,
  UsageAccumulator,
  SessionStats,
} from "../types";
import { SessionClock } from "./session";
import { isOpenRouterModel, PromptManager } from "../config";


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
    // ─── Session Boundary Events ──────────────────────────────────────────────
    const sessionClock = SessionClock.getInstance();

    if (sessionClock.hasDateChanged(now)) {
      // Day rolled over — model must know the date context shifted
      contents.push({
        role: "user",
        parts: [{
          text: [
            `[SYSTEM_EVENT::SESSION_BOUNDARY]`,
            `type: date_change`,
            `from: ${sessionClock.fmt(sessionClock.getLast()!)}`,
            `to:   ${sessionClock.fmt(now)}`,
          ].join("\n"),
        }],
      });
    } else if (sessionClock.hasIdleGap(now, 60)) {
      // Long idle (≥ 1 h) — remind model the user is resuming after a gap
      const diffMin = Math.round(
        (now.getTime() - sessionClock.getLast()!.getTime()) / 60_000
      );
      contents.push({
        role: "user",
        parts: [{
          text: [
            `[SYSTEM_EVENT::IDLE_RESUME]`,
            `type: idle_gap`,
            `elapsed: ${diffMin} minutes`,
            `resumed: ${sessionClock.fmt(now)}`,
          ].join("\n"),
        }],
      });
    }

    // Advance the clock *after* all event checks
    sessionClock.update(now);

    const timeStr = now.toLocaleDateString("en-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Jakarta",
    });

    const contextPrefix = `[Context: Time=${timeStr}, OS=Windows]\n\n`;

    contents.push({
      role: "user",
      parts: [{ text: `${contextPrefix}${prompt}` }],
    });


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
      // --- TOKEN OPTIMIZATION ---
      // Deep clone and prune the history for the API payload so we don't send 
      // massive, old scrape data on every subsequent turn.
      const optimizedContents = contents.map((turn, index) => {
        // Only prune if it's an older turn (not the current interaction)
        if (index < contents.length - 2) {
          return {
            ...turn,
            parts: turn.parts.map(part => {
              // 1. Prune massive tool outputs (scrape_url, etc)
              if (part.functionResponse && part.functionResponse.response) {
                const res = part.functionResponse.response;
                if (typeof res.content === 'string' && res.content.length > 300) {
                  return {
                    ...part,
                    functionResponse: {
                      ...part.functionResponse,
                      response: { 
                        ...res, 
                        content: res.content.slice(0, 200) + "... [Truncated]" 
                      }
                    }
                  };
                }
              }
              // 2. Prune massive text blocks (user or assistant)
              if (part.text && part.text.length > 500) {
                return {
                  ...part,
                  text: part.text.slice(0, 300) + "... [Text truncated to save tokens]"
                };
              }
              return part;
            })
          };
        }
        return turn;
      });
      
      let tokenStatus = "";
      if (!isOpenRouterModel(state.model)) {
        try {
          const countResponse = await ai.models.countTokens({
            model: state.model,
            contents: optimizedContents,
            config: {
              tools: activeTools,
              systemInstruction: PromptManager.getSystemPrompt(selectedSearch),
            },
          });
          if (countResponse && countResponse.totalTokens) {
            tokenStatus = `(${countResponse.totalTokens} tokens)`;
          }
        } catch (e) {
          // Ignore failures
        }
      }

      spinnerPromise = silent
        ? Promise.resolve()
        : showSpinner(() => !spinnerRunning, tokenStatus);

      const stream = getStream(state.model, optimizedContents, {
        ai,
        activeTools,
        selectedSearch,
      });

      let response: any = null;
      let mergedParts: any[] = [];

      for await (const chunk of stream) {
        response = chunk;
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        mergedParts.push(...parts);
      }


      spinnerRunning = false;
      await spinnerPromise;

      const fullText = mergedParts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join("");

      if (fullText && !silent) {
        const rendered = (await marked.parse(fullText)).trim();
        printResponse(rendered);
      }


      if (!response) return;

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
            thoughtsTokenCount: usageAcc.t,
            cachedContentTokenCount: usageAcc.cc,
            totalTokenCount: usageAcc.p + usageAcc.c + (usageAcc.t || 0) + (usageAcc.cc || 0),
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

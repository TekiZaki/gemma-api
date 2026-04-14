// ---
// Summary:
// - Purpose: Tool call router — dispatches function calls to handlers, manages authorization, recursive turn continuation.
// - Role: Separates interactive tools (require user approval) from non-interactive; streams next AI turn after tool results.
// - Used by: engine.ts (post-response tool check).
// - Depends on: handlers, definitions, transport, ui/components, ui/theme, config, types.
// ---
import { GoogleGenAI } from "@google/genai";
import type * as readLine from "readline/promises";
import { AMBER, BOLD, RESET, DIM } from "../ui/theme";

import { marked } from "../ui/theme";
import {
  showSpinner,
  printCard,
  printAction,
  printObservation,
  printResponse,
  printInfo,
} from "../ui/components";

import { PromptManager, supportsThinking } from "../config";
import { getStream } from "../ai/transport";
import { getToolHandlers } from "./handlers";
import { getToolDefinitions } from "./definitions";
import { loadPlugins } from "./plugin-manager";
import type { ConversationTurn, UsageAccumulator, SessionStats } from "../types";
import { AppState } from "../types";
import { askYesNo } from "../ui/input";



// ─── Tool Call Executor ───────────────────────────────────────────────────────

export async function handleToolCalls(
  ai: GoogleGenAI,
  contents: ConversationTurn[],
  response: any,
  rl: readLine.Interface,
  selectedSearch?: string,
  usageAcc: UsageAccumulator = { p: 0, c: 0 },
  stats?: SessionStats,
  piped = false,
  noTools = false,
  depth = 0,
): Promise<any> {
  const MAX_DEPTH = 3;
  if (depth >= MAX_DEPTH) {
    printInfo(`Search/Tool depth limit reached. Synthesizing available data.`);
    return response;
  }

  if (response.usageMetadata) {
    usageAcc.p += response.usageMetadata.promptTokenCount || 0;
    usageAcc.c += response.usageMetadata.candidatesTokenCount || 0;
    usageAcc.t = (usageAcc.t || 0) + (response.usageMetadata.thoughtsTokenCount || 0);
    usageAcc.cc = (usageAcc.cc || 0) + (response.usageMetadata.cachedContentTokenCount || 0);

    if (stats) stats.accumulate(response.usageMetadata);
  }

  const partsFromResponse = response.candidates?.[0]?.content?.parts || [];
  const functionCalls =
    (typeof response.functionCalls === "function"
      ? response.functionCalls()
      : response.functionCalls) ||
    partsFromResponse
      .filter((p: any) => p.functionCall)
      .map((p: any) => p.functionCall);

  if (!functionCalls || functionCalls.length === 0) return response;

  contents.push(response.candidates[0].content);

  const parts: any[] = [];
  const SAFE_COMMANDS = new Set(["date", "whoami", "pwd", "ls", "dir", "time"]);

  /** Returns true for commands that should never require user approval. */
  const isAutoApproved = (call: any): boolean => {
    if (call.name !== "terminal_execute") return false;
    const cmd = (call.args?.command || "").trim();
    const base = cmd.toLowerCase().split(" ")[0];
    // Safe builtins
    if (SAFE_COMMANDS.has(base)) return true;
    // Running plugin scripts: `bun plugins/<anything>`
    if (/^bun\s+plugins\//i.test(cmd)) return true;
    return false;
  };

  const interactiveCalls = functionCalls.filter((c: any) => {
    if (c.name === "create_tool") return true;
    if (c.name === "terminal_execute") return !isAutoApproved(c);
    return false;
  });

  const autoApprovableCalls = functionCalls.filter((c: any) => isAutoApproved(c));


  const nonInteractiveCalls = functionCalls.filter(
    (c: any) =>
      c.name !== "terminal_execute" &&
      c.name !== "create_tool" &&
      !autoApprovableCalls.includes(c),
  );


  const nonInteractiveResults = await Promise.all(
    [...nonInteractiveCalls, ...autoApprovableCalls].map(async (call: any) => {
      const { name, args, id } = call;
      const handlers = getToolHandlers();
      const handler = handlers[name];
      if (!handler) {
        return {
          functionResponse: {
            name,
            response: { error: `Tool ${name} not found.` },
            id,
          },
        };
      }
      printAction(name, args);
      const result = await handler(args);
      printObservation(name, result);
      return { functionResponse: { name, response: result, id } };
    }),
  );
  parts.push(...nonInteractiveResults.filter(Boolean));

  for (const call of interactiveCalls) {
    const { name, args, id } = call;
    const handlers = getToolHandlers();
    const handler = handlers[name];
    if (!handler) continue;
    printCard({
      title: "Action Required",
      lines: [
        `${BOLD}Tool:${RESET} ${name}`,
        `${BOLD}Args:${RESET} ${JSON.stringify(args, null, 2)}`
      ],
      color: AMBER
    });

    let authorized = false;
    if (piped) {
      console.log(`${DIM}(Auto-approved because input was piped)${RESET}`);
      authorized = true;
    } else {
      // Single-keypress prompt — stays in raw mode, no readline ownership transfer.
      authorized = await askYesNo(
        `${AMBER}${BOLD}Authorize execution?${RESET} ${DIM}[y/N]${RESET} `,
      );
    }

    if (!authorized) {
      parts.push({
        functionResponse: {
          name,
          response: { error: "User denied permission." },
          id,
        },
      });
      continue;
    }
    const result = await handler(args);
    printObservation(name, result);
    parts.push({ functionResponse: { name, response: result, id } });
  }

  contents.push({ role: "user", parts });

  let activeTools: any[] = [];
  if (!noTools) {
    if (selectedSearch === "GOOGLE") {
      activeTools = [{ googleSearch: {} }];
    } else {
      activeTools = getToolDefinitions();
    }
  }

  const state = AppState.getInstance();

  let spinnerRunning = true;
  const spinnerPromise = showSpinner(() => !spinnerRunning);

  try {
    const stream = getStream(state.model, contents, {
      ai,
      activeTools,
      selectedSearch,
    });

    let chunkResponse: any = null;
    let mergedParts: any[] = [];

    for await (const chunk of stream) {
      chunkResponse = chunk;
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      mergedParts.push(...parts);
    }

    spinnerRunning = false;
    await spinnerPromise;

    const fullText = mergedParts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join("");

    if (fullText) {
      const rendered = (await marked.parse(fullText)).trim();
      printResponse(rendered);
    }

    if (!chunkResponse) return response;

    if (chunkResponse.candidates?.[0]?.content) {
      chunkResponse.candidates[0].content.parts = mergedParts;
    }
    return handleToolCalls(
      ai,
      contents,
      chunkResponse,
      rl,
      selectedSearch,
      usageAcc,
      stats,
      piped,
      noTools,
      depth + 1,
    );
  } catch (error: any) {
    spinnerRunning = false;
    await spinnerPromise;
    throw error;
  }
}

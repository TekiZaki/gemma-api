import { GoogleGenAI } from "@google/genai";
import type * as readLine from "readline/promises";
import { AMBER, BOLD, CHARCOAL, DIM, RESET } from "../ui/theme";
import { marked } from "../ui/theme";
import { showSpinner, printCard, printAction, printObservation } from "../ui/components";
import { PromptManager, supportsThinking } from "../config";
import { toolHandlers } from "./handlers";
import { toolDefinitions } from "./definitions";
import type { ConversationTurn, UsageAccumulator, SessionStats } from "../types";
import { AppState } from "../types";

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
): Promise<any> {
  if (response.usageMetadata) {
    usageAcc.p += response.usageMetadata.promptTokenCount || 0;
    usageAcc.c += response.usageMetadata.candidatesTokenCount || 0;
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
  const interactiveCalls = functionCalls.filter(
    (c: any) => c.name === "terminal_execute",
  );
  const nonInteractiveCalls = functionCalls.filter(
    (c: any) => c.name !== "terminal_execute",
  );

  const nonInteractiveResults = await Promise.all(
    nonInteractiveCalls.map(async (call: any) => {
      const { name, args, id } = call;
      const handler = toolHandlers[name];
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
    const handler = toolHandlers[name];
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
      const answer = await rl.question(
        `${AMBER}${BOLD}Authorize execution?${RESET} ${DIM}[y/N]${RESET} `,
      );
      if (answer.trim().toLowerCase() === "y") {
        authorized = true;
      }
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
      activeTools = [...toolDefinitions];
    }
  }

  const state = AppState.getInstance();

  let spinnerRunning = true;
  const spinnerPromise = showSpinner(() => !spinnerRunning);

  try {
    const stream = await ai.models.generateContentStream({
      model: state.model,
      contents,
      config: {
        tools: activeTools,
        systemInstruction: PromptManager.getSystemPrompt(selectedSearch),
        ...(supportsThinking(state.model) && {
          thinkingConfig: { thinkingLevel: "MINIMAL" as any, includeThoughts: false },
        }),
      },
    });

    spinnerRunning = false;
    await spinnerPromise;

    let chunkResponse: any = null;
    let hasText = false;
    let mergedParts: any[] = [];
    let streamedLines = 0;

    for await (const chunk of stream) {
      chunkResponse = chunk;
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      mergedParts.push(...parts);
      const text = parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join("");
      if (text) {
        if (!hasText) {
          process.stdout.write(`\n${AMBER}${BOLD} RESPONSE ${RESET}\n`);
          hasText = true;
        }
        process.stdout.write(text);
        streamedLines += (text.match(/\n/g) || []).length;
      }
    }
    if (hasText) {
      const fullText = mergedParts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join("");
      process.stdout.write(`\r\x1b[K`);
      for (let l = 0; l <= streamedLines + 1; l++) {
        process.stdout.write("\x1b[1A\x1b[2K");
      }
      process.stdout.write(`\n${AMBER}${BOLD} RESPONSE ${RESET}\n`);
      console.log((await marked.parse(fullText)).trim());
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
    );
  } catch (error: any) {
    spinnerRunning = false;
    await spinnerPromise;
    throw error;
  }
}

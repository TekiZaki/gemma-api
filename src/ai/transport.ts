// ---
// Summary:
// - Purpose: Dual transport layer — unified streaming for Google GenAI and OpenRouter APIs.
// - Role: `getStream()` abstracts provider differences; OpenRouter path handles SSE parsing, tool-call mapping, and JSON argument rescue.
// - Used by: engine.ts, executor.ts.
// - Depends on: config (PromptManager, supportsThinking, isOpenRouterModel, loadEnv), types.
// ---
import { GoogleGenAI } from "@google/genai";
import { PromptManager, supportsThinking, isOpenRouterModel, loadEnv } from "../config";
import type { ConversationTurn } from "../types";

// ─── Schema Mapping ───────────────────────────────────────────────────────────

function fixSchema(schema: any): any {
  if (!schema) return schema;
  const newSchema = { ...schema };
  if (newSchema.type === "OBJECT") newSchema.type = "object";
  if (newSchema.type === "STRING") newSchema.type = "string";
  if (newSchema.properties) {
    for (const key in newSchema.properties) {
      newSchema.properties[key] = fixSchema(newSchema.properties[key]);
    }
  }
  return newSchema;
}

function mapToolsToOpenRouter(tools: any[]) {
  const openRouterTools: any[] = [];
  for (const tool of tools) {
    if (tool.functionDeclarations) {
      for (const fd of tool.functionDeclarations) {
        openRouterTools.push({
          type: "function",
          function: {
            name: fd.name,
            description: fd.description,
            parameters: fixSchema(fd.parameters),
          },
        });
      }
    }
  }
  return openRouterTools;
}

function mapToOpenRouterMessages(contents: ConversationTurn[], systemPrompt: string) {
  const messages: any[] = [{ role: "system", content: systemPrompt }];
  
  for (const turn of contents) {
    const role = turn.role === "model" ? "assistant" : "user";
    
    // Check if it's a tool response turn
    if (turn.parts.some(p => p.functionResponse)) {
      for (const part of turn.parts) {
        if (part.functionResponse) {
          messages.push({
            role: "tool",
            tool_call_id: part.functionResponse.id || "unknown",
            content: JSON.stringify(part.functionResponse.response)
          });
        }
      }
      continue;
    }

    // Regular turn
    const contentParts: any[] = [];
    const toolCalls: any[] = [];

    for (const p of turn.parts) {
      if (p.text) contentParts.push({ type: "text", text: p.text });
      if (p.functionCall) {
        toolCalls.push({
          id: p.functionCall.id || "unknown",
          type: "function",
          function: {
            name: p.functionCall.name,
            arguments: typeof p.functionCall.args === "string" 
              ? p.functionCall.args 
              : JSON.stringify(p.functionCall.args)
          }
        });
      }
    }

    const message: any = { role };
    if (contentParts.length > 0) {
      message.content = contentParts.map(cp => cp.text).join("");
    }
    if (toolCalls.length > 0) {
      message.tool_calls = toolCalls;
      // Some providers require content to be null if tool_calls is present
      if (message.content === undefined) {
          message.content = null;
      }
    }
    messages.push(message);
  }
  return messages;
}

// ─── OpenRouter Transport ──────────────────────────────────────────────────────

async function* callOpenRouter(
  model: string,
  contents: ConversationTurn[],
  activeTools: any[],
  selectedSearch?: string,
): AsyncGenerator<any, void, unknown> {
  const keys = loadEnv();
  const systemPrompt = PromptManager.getSystemPrompt(selectedSearch);
  const tools = mapToolsToOpenRouter(activeTools);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${keys.openrouter}`,
      "HTTP-Referer": "https://github.com/dzaki/gemma-api",
      "X-OpenRouter-Title": "Gemma CLI",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: mapToOpenRouterMessages(contents, systemPrompt),
      ...(tools.length > 0 && { tools }),
      // Removed context-compression as it can cause instability with some providers
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    if (response.status === 404 && err.includes("tool use")) {
      // Retry without tools
      return yield* callOpenRouter(model, contents, [], selectedSearch);
    }
    throw new Error(`OpenRouter Error: ${response.status} ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";
  const toolCallsAcc: any[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const cleanLine = line.trim();
      if (!cleanLine) continue;
      if (cleanLine.startsWith("data: ")) {
        const data = cleanLine.slice(6).trim();
        if (data === "[DONE]") {
          // Final check for tool calls if any
          if (toolCallsAcc.length > 0) {
            const parts = toolCallsAcc
              .filter(tc => tc && tc.name)
              .map((tc, idx) => {
                let parsedArgs = {};
                const raw = (tc.args || "").trim();
                
                try {
                  parsedArgs = JSON.parse(raw || "{}");
                } catch (e) {
                  // Strategy 1: Remove leading/trailing quotes
                  let rescued = raw;
                  if (rescued.startsWith('"') && rescued.endsWith('"')) {
                    rescued = rescued.substring(1, rescued.length - 1).replace(/\\"/g, '"');
                  }
                  
                  // Strategy 2: Missing closing }
                  if (rescued.startsWith('{') && !rescued.endsWith('}')) {
                    rescued += '}';
                  }

                  try {
                    parsedArgs = JSON.parse(rescued);
                  } catch (e2) {
                    // Fallback to raw string conversion
                    if (tc.name === "bun_search" || tc.name === "firecrawl_search") {
                        parsedArgs = { query: rescued };
                    } else if (tc.name === "terminal_execute") {
                        parsedArgs = { command: rescued };
                    } else if (tc.name === "scrape_url") {
                         parsedArgs = { url: rescued };
                    } else {
                        parsedArgs = { __raw: rescued, error: "Malformed JSON" };
                    }
                  }
                }

                return {
                  functionCall: {
                    name: tc.name,
                    args: parsedArgs,
                    id: tc.id || `call_${Date.now()}_${idx}`
                  }
                };
              });

            if (parts.length > 0) {
              yield { candidates: [{ content: { parts } }] };
            }
          }
          return;

        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          const content = delta?.content || "";
          const tcDeltas = delta?.tool_calls;
          const usage = parsed.usage;

          if (tcDeltas) {
            for (const tc of tcDeltas) {
              if (tc.index === undefined) continue;
              if (!toolCallsAcc[tc.index]) {
                toolCallsAcc[tc.index] = { id: tc.id, name: tc.function?.name, args: "" };
              }
              const entry = toolCallsAcc[tc.index];
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.name = tc.function.name;
              if (tc.function?.arguments) {
                const args = tc.function.arguments;
                entry.args += typeof args === "string" ? args : JSON.stringify(args);
              }

            }
          }


          if (content || usage) {
            yield {
              candidates: content
                ? [{ content: { parts: [{ text: content }] } }]
                : [],
              usageMetadata: usage
                ? {
                    promptTokenCount: usage.prompt_tokens,
                    candidatesTokenCount: usage.completion_tokens,
                    totalTokenCount: usage.total_tokens,
                  }
                : undefined,
            };
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }
}

// ─── Unified Stream Generator ────────────────────────────────────────────────

export async function* getStream(
  model: string,
  contents: ConversationTurn[],
  options: {
    ai: GoogleGenAI;
    activeTools: any[];
    selectedSearch?: string;
  }
) {
  if (isOpenRouterModel(model)) {
    yield* callOpenRouter(model, contents, options.activeTools, options.selectedSearch);
  } else {
    const stream = await options.ai.models.generateContentStream({
      model,
      contents,
      config: {
        tools: options.activeTools,
        systemInstruction: PromptManager.getSystemPrompt(options.selectedSearch),
        ...(supportsThinking(model) && {
          thinkingConfig: {
            thinkingLevel: "MINIMAL" as any,
            includeThoughts: false,
          },
        }),
      },
    });
    for await (const chunk of stream) {
      yield chunk;
    }
  }
}

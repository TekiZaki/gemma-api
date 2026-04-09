import { join } from "path";
import { writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import type { ToolResult } from "../types";

const PLUGINS_DIR = join(process.cwd(), "plugins");

// Ensure directory exists
if (!existsSync(PLUGINS_DIR)) {
  mkdirSync(PLUGINS_DIR, { recursive: true });
}

export const dynamicHandlers: Record<string, (args: any) => Promise<ToolResult>> = {};
export const dynamicDefinitions: any[] = [];

/**
 * Hot-loads all .ts files in the plugins directory
 */
export async function loadPlugins(): Promise<void> {
  // Clear existing to allow hot-reloading
  dynamicDefinitions.length = 0;
  for (const key in dynamicHandlers) delete dynamicHandlers[key];

  if (!existsSync(PLUGINS_DIR)) return;

  const files = readdirSync(PLUGINS_DIR).filter(f => f.endsWith(".ts"));

  for (const file of files) {
    try {
      // Append timestamp to bypass Bun/Node module cache for hot-reloading
      const modulePath = join(PLUGINS_DIR, file);
      // Bun supports direct import of .ts files
      const plugin = await import(`${modulePath}?t=${Date.now()}`);
      
      if (plugin.definition && plugin.handler) {
        dynamicDefinitions.push(plugin.definition);
        dynamicHandlers[plugin.definition.name] = plugin.handler;
      }
    } catch (err: any) {
      console.error(`Failed to load plugin ${file}: ${err.message}`);
    }
  }
}

/**
 * The tool the AI uses to write a new tool
 */
export const createToolHandler = async ({ name, description, code }: { name: string, description: string, code: string }): Promise<ToolResult> => {
  try {
    // Basic validation to ensure the code exports 'definition' and 'handler'
    const hasDefinition = /export\s+(const|let|var)\s+definition/.test(code);
    const hasHandler = /export\s+(async\s+)?function\s+handler/.test(code) || /export\s+(const|let|var)\s+handler/.test(code);

    if (!hasDefinition || !hasHandler) {
      return { error: "Code must export a 'definition' object and a 'handler' function. (e.g., 'export const definition = ...' and 'export async function handler(args) { ... }')" };
    }


    const filePath = join(PLUGINS_DIR, `${name}.ts`);
    writeFileSync(filePath, code);
    
    // Immediately load the new plugin into memory
    await loadPlugins();
    
    return { output: `Successfully created and loaded tool: ${name}. You can now use it.` };
  } catch (err: any) {
    return { error: `Failed to create tool: ${err.message}` };
  }
};

// The schema definition for the AI to know how to use this tool
export const createToolDefinition = {
  name: "create_tool",
  description: "Writes a new TypeScript tool/plugin for the CLI. The code MUST export a 'definition' object and an async 'handler' function. Example: 'export const definition = { ... }; export async function handler(args) { ... }'.",
  parameters: {
    type: "OBJECT",
    properties: {
      name: { type: "STRING", description: "The internal name of the tool (snake_case)." },
      description: { type: "STRING", description: "What the tool does." },
      code: { type: "STRING", description: "The complete TypeScript code for the tool. Use Bun's built-in 'fetch' if needed. Do not import 'node-fetch'." }
    },
    required: ["name", "description", "code"],
  },
};


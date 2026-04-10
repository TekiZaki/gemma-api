// ---
// Summary:
// - Purpose: Interactive model selector — `@clack/prompts`-based dropdown for switching AI models.
// - Role: Presents available models with current model preselected; returns chosen model name or null on cancel.
// - Used by: commands.ts (`/model` handler).
// - Depends on: @clack/prompts, theme, types (AppState).
// ---
import * as p from "@clack/prompts";
import { AMBER, BOLD, DIM, RESET } from "./theme";
import { AppState } from "../types";

export async function selectModel(models: string[]): Promise<string | null> {
  const state = AppState.getInstance();
  
  const selected = await p.select({
    message: `${AMBER}${BOLD}Select Model${RESET}`,
    initialValue: state.model,
    options: models.map((m) => ({
      value: m,
      label: m,
      hint: m === state.model ? "(current)" : undefined,
    })),
  });

  if (p.isCancel(selected)) {
    console.log(`${DIM}Model selection cancelled.${RESET}\n`);
    return null;
  }

  return selected as string;
}

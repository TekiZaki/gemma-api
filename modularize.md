# Refactoring Prompt: Modularizing `gemma-api`

**Objective:** Refactor the provided `gemma-api` codebase from a single-file heavy structure into a modular, maintainable TypeScript project using Bun.

### 1. Proposed Directory Structure
Please reorganize the code into the following structure:
* `src/index.ts` - Clean entry point.
* `src/config.ts` - Environment variables, `config.json` persistence, and constant definitions (models, prompts).
* `src/ui/`
    * `theme.ts` - ANSI color constants and `marked` configuration.
    * `components.ts` - Headers, usage printers, and spinners.
    * `selector.ts` - The interactive model selection logic.
* `src/ai/`
    * `engine.ts` - Core Gemini SDK initialization and `runTurn` orchestration.
    * `history.ts` - Managing the conversation history array and persistence.
* `src/tools/`
    * `definitions.ts` - Tool JSON schemas.
    * `handlers.ts` - Implementation of terminal, search, and scrape functions.
    * `executor.ts` - The `handleToolCalls` logic.
* `src/commands.ts` - Logic for REPL commands (`/reset`, `/model`, `/save`, etc.).

### 2. Refactoring Requirements
* **Types & Interfaces:** Create a `types.ts` or export interfaces for the `Config`, `ToolResult`, and `ConversationTurn`.
* **Dependency Injection:** Ensure the AI engine and UI components don't have circular dependencies. Pass the `ai` instance and `rl` (readline) interface as arguments where needed.
* **Encapsulation:** * Move the `getSystemPrompt` logic into a dedicated configuration manager.
    * Wrap the token tracking into a `SessionStats` class or object.
* **State Management:** Create a clean way to update `currentModelName` across modules without relying on a global mutable variable (e.g., a `State` singleton or a config provider).
* **Error Handling:** Ensure `printError` is used consistently across all modules.

### 3. Functional Logic Preservations
* Keep the **Bun-specific** features (e.g., `import.meta.dir`, `$` shell execution).
* Maintain the **Deep Minimalist Amber/Charcoal** theme.
* Keep the complex "no-flicker" raw mode logic in the model selector.
* Ensure the `SYSTEM_TIME_SYNC` logic remains the first part of any conversation initialization.

### 4. Output Request
Provide the refactored code for each new file, ensuring all imports and exports are correctly mapped.

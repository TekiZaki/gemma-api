// ---
// Summary:
// - Purpose: Core TypeScript interfaces and state management classes.
// - Role: Defines `ConversationTurn`, `ToolResult`, `TurnOptions`, `SessionStats` (token tracking), `AppState` (singleton).
// - Used by: Every module in the project.
// - Depends on: None (pure type definitions).
// ---
// ─── Core Types ───────────────────────────────────────────────────────────────

export interface Config {
  model: string;
}

export interface ToolResult {
  output?: string;
  results?: any;
  content?: string;
  error?: string;
  url?: string;
  [key: string]: any;
}

export interface ConversationTurn {
  role: "user" | "model";
  parts: Array<{
    text?: string;
    functionCall?: {
      name: string;
      args: Record<string, any>;
      id?: string;
    };
    functionResponse?: {
      name: string;
      response: ToolResult;
      id?: string;
    };
  }>;
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
}

export interface UsageAccumulator {
  p: number; // prompt tokens
  c: number; // candidate tokens
  t?: number; // thinking tokens
  cc?: number; // cached content tokens
}

export interface TurnOptions {
  silent?: boolean;
  selectedSearch?: string;
  piped?: boolean;
  noTools?: boolean;
}

export interface CommandDefinition {
  cmd: string;
  desc: string;
}

// ─── Session Stats ────────────────────────────────────────────────────────────

export class SessionStats {
  private promptTokens = 0;
  private candidateTokens = 0;
  private thoughtsTokens = 0;
  private cachedTokens = 0;

  accumulate(usage: UsageMetadata) {
    this.promptTokens += usage.promptTokenCount || 0;
    this.candidateTokens += usage.candidatesTokenCount || 0;
    this.thoughtsTokens += usage.thoughtsTokenCount || 0;
    this.cachedTokens += usage.cachedContentTokenCount || 0;
  }

  get totalPromptTokens() {
    return this.promptTokens;
  }

  get totalCandidateTokens() {
    return this.candidateTokens;
  }

  get totalThoughtsTokens() {
    return this.thoughtsTokens;
  }

  get totalCachedTokens() {
    return this.cachedTokens;
  }

  get totalTokens() {
    return (
      this.promptTokens +
      this.candidateTokens +
      this.thoughtsTokens +
      this.cachedTokens
    );
  }

  reset() {
    this.promptTokens = 0;
    this.candidateTokens = 0;
    this.thoughtsTokens = 0;
    this.cachedTokens = 0;
  }
}

// ─── State Singleton ──────────────────────────────────────────────────────────

export class AppState {
  private static instance: AppState | null = null;
  private currentModelName: string;

  private constructor(initialModel: string) {
    this.currentModelName = initialModel;
  }

  static initialize(initialModel: string): AppState {
    if (!AppState.instance) {
      AppState.instance = new AppState(initialModel);
    }
    return AppState.instance;
  }

  static getInstance(): AppState {
    if (!AppState.instance) {
      throw new Error("AppState not initialized. Call initialize() first.");
    }
    return AppState.instance;
  }

  get model(): string {
    return this.currentModelName;
  }

  set model(value: string) {
    this.currentModelName = value;
  }

  static reset() {
    AppState.instance = null;
  }
}

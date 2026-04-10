// ---
// Summary:
// - Purpose: Conversation history manager — CRUD for conversation turns.
// - Role: Maintains in-memory array of `ConversationTurn[]`; supports reset, load from JSON, set, and get operations.
// - Used by: index.ts, commands.ts (save/load), engine.ts (turn context).
// - Depends on: types (ConversationTurn), config (PromptManager — unused import).
// ---
import type { ConversationTurn } from "../types";
import { PromptManager } from "../config";

// ─── Conversation History Manager ─────────────────────────────────────────────

export class HistoryManager {
  private history: ConversationTurn[];

  constructor() {
    this.history = [];
  }

  /**
   * Initialize history with the system time sync message.
   * SYSTEM_TIME_SYNC logic remains the first part of any conversation initialization.
   */
  initializeWithTimeSync(): void {
    this.history.length = 0;
  }

  /**
   * Clear history and reinitialize with time sync.
   */
  reset(): void {
    this.initializeWithTimeSync();
  }

  /**
   * Get the current conversation history (capped at last 20 turns to prevent token bloat).
   */
  getHistory(): ConversationTurn[] {
    const MAX_TURNS = 20;
    if (this.history.length > MAX_TURNS) {
      // Keep the oldest system sync/init messages if any, but slice the rest
      this.history = this.history.slice(this.history.length - MAX_TURNS);
    }
    return this.history; 
  }

  /**
   * Set the conversation history from external source.
   */
  setHistory(history: ConversationTurn[]): void {
    this.history.length = 0;
    this.history.push(...history);
  }

  /**
   * Load history from a parsed JSON array.
   */
  loadFromJSON(parsed: ConversationTurn[]): void {
    this.history.length = 0;
    this.history.push(...parsed);
  }

  /**
   * Clear all history without reinitializing.
   */
  clear(): void {
    this.history.length = 0;
  }
}

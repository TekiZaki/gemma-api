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
    const syncMessage = PromptManager.getSystemSyncMessage();
    this.history.push({
      role: "user",
      parts: [{ text: syncMessage }],
    });
  }

  /**
   * Clear history and reinitialize with time sync.
   */
  reset(): void {
    this.initializeWithTimeSync();
  }

  /**
   * Get the current conversation history.
   */
  getHistory(): ConversationTurn[] {
    return this.history; // ← return the real array, not a copy
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

// ---
// Summary:
// - Purpose: Deterministic session-time tracking — detects date changes and long idle gaps between turns.
// - Role: Singleton that the engine queries before each turn to inject structured system events into the
//         conversation context, keeping the model time-aware without relying on inference.
// - Used by: engine.ts (pre-turn context injection).
// - Depends on: nothing (pure TS).
// ---

const TZ = "Asia/Jakarta";

export class SessionClock {
  private static instance: SessionClock;
  private lastInteraction: Date | null = null;

  private constructor() {}

  public static getInstance(): SessionClock {
    if (!SessionClock.instance) {
      SessionClock.instance = new SessionClock();
    }
    return SessionClock.instance;
  }

  /** True if the calendar date has changed since the last recorded interaction. */
  public hasDateChanged(now: Date): boolean {
    if (!this.lastInteraction) return false;

    const prev = this.lastInteraction;
    return (
      now.getFullYear() !== prev.getFullYear() ||
      now.getMonth()    !== prev.getMonth()    ||
      now.getDate()     !== prev.getDate()
    );
  }

  /**
   * True if more than `minutes` have passed since the last interaction.
   * Default threshold: 60 minutes.
   */
  public hasIdleGap(now: Date, minutes = 60): boolean {
    if (!this.lastInteraction) return false;
    const diffMin = (now.getTime() - this.lastInteraction.getTime()) / 60_000;
    return diffMin >= minutes;
  }

  /** Advance the clock to `now`. Must be called after all event checks for this turn. */
  public update(now: Date): void {
    this.lastInteraction = now;
  }

  /** Returns the timestamp of the last recorded interaction, or null on first turn. */
  public getLast(): Date | null {
    return this.lastInteraction;
  }

  /** Formatted locale string for a given date, using the app timezone. */
  public fmt(date: Date): string {
    return date.toLocaleString("en-ID", { timeZone: TZ });
  }
}

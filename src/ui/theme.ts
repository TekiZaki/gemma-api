// ---
// Summary:
// - Purpose: Visual theme layer — ANSI color constants and `marked` markdown-to-terminal renderer.
// - Role: Defines Amber/Charcoal palette, configures `marked-terminal` with custom heading, code, link styling.
// - Used by: All UI files, engine (markdown output), handlers (action/observation display).
// - Depends on: marked, marked-terminal.
// ---
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

// ─── ANSI Colors (Deep Minimalist Amber/Charcoal theme) ───────────────────────
export const AMBER = "\x1b[38;2;255;191;0m";
export const CHARCOAL = "\x1b[38;2;40;40;40m";
export const EMERALD = "\x1b[38;2;80;200;120m";
export const SAPPHIRE = "\x1b[38;2;15;82;186m";
export const SLATE = "\x1b[38;2;112;128;144m";
export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";

export const marked = new Marked();

// Use the terminal plugin with your custom overrides
marked.use(markedTerminal({
  firstHeading: (text: string) => `\x1b[38;2;255;191;0m\x1b[1m${text}\x1b[0m\n`,
  strong: (text: string) => `\x1b[1m\x1b[38;2;255;255;255m${text}\x1b[0m`,
  em: (text: string) => `\x1b[3m${text}\x1b[0m`,
  codespan: (text: string) => `\x1b[48;2;40;40;40m\x1b[38;2;255;191;0m ${text} \x1b[0m`,
  code: (text: string) => `\n\x1b[48;2;30;30;30m\x1b[38;2;200;200;200m${text}\x1b[0m\n`,
  link: (href: string) => `\x1b[38;2;0;255;255m\x1b[4m${href}\x1b[0m`,
}) as any);



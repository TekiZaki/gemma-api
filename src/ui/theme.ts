import { Marked } from "marked";
import TerminalRenderer from "marked-terminal";

// ─── ANSI Colors (Deep Minimalist Amber/Charcoal theme) ───────────────────────

export const AMBER = "\x1b[38;2;255;191;0m";
export const CHARCOAL = "\x1b[38;2;40;40;40m";
export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";

// ─── Markdown Renderer Configuration ─────────────────────────────────────────

export const marked = new Marked();
marked.setOptions({
  renderer: new TerminalRenderer({
    firstHeading: (text: string) =>
      `\x1b[38;2;255;191;0m\x1b[1m${text}\x1b[0m\n`,
    strong: (text: string) => `\x1b[1m\x1b[38;2;255;255;255m${text}\x1b[0m`,
    em: (text: string) => `\x1b[3m${text}\x1b[0m`,
    codespan: (text: string) =>
      `\x1b[48;2;40;40;40m\x1b[38;2;255;191;0m ${text} \x1b[0m`,
    code: (text: string) =>
      `\n\x1b[48;2;30;30;30m\x1b[38;2;200;200;200m${text}\x1b[0m\n`,
    link: (href: string) => `\x1b[38;2;0;255;255m\x1b[4m${href}\x1b[0m`,
  }) as any,
});

import { createInterface } from "node:readline";
import {
  bold,
  cyan,
  dim,
  displayWidth,
  green,
  pad,
  terminalWidth,
  truncate,
} from "./ui";

/**
 * Keyboard-driven prompts: arrow keys to move, space to tick, enter to accept.
 *
 * Everything here needs a real terminal. Callers check `canPrompt()` first and
 * fall back to flags when the CLI is being piped or scripted, so nothing ever
 * hangs waiting for a keypress that cannot come.
 */
export function canPrompt(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

const CURSOR_HIDE = "\u001b[?25l";
const CURSOR_SHOW = "\u001b[?25h";
const CLEAR_BELOW = "\u001b[J";
const up = (lines: number) => (lines > 0 ? `\u001b[${lines}A` : "");

export type Key = { name: string; text: string };

export function parseKey(chunk: string): Key {
  switch (chunk) {
    case "\u001b[A":
      return { name: "up", text: chunk };
    case "\u001b[B":
      return { name: "down", text: chunk };
    case "\u001b[C":
      return { name: "right", text: chunk };
    case "\u001b[D":
      return { name: "left", text: chunk };
    case "\u001b[5~":
      return { name: "pageup", text: chunk };
    case "\u001b[6~":
      return { name: "pagedown", text: chunk };
    case "\u001b[H":
      return { name: "home", text: chunk };
    case "\u001b[F":
      return { name: "end", text: chunk };
    case "\r":
    case "\n":
      return { name: "enter", text: chunk };
    case " ":
      return { name: "space", text: chunk };
    case "\t":
      return { name: "tab", text: chunk };
    case "\u0003":
      return { name: "ctrl-c", text: chunk };
    case "\u001b":
      return { name: "escape", text: chunk };
    case "\u007f":
    case "\b":
      return { name: "backspace", text: chunk };
    default:
      return { name: "char", text: chunk };
  }
}

/**
 * Where a key moves the cursor, or null when it is not a movement key.
 * Shared so every list in the CLI wraps and jumps the same way.
 */
export function navigate(
  key: Key,
  index: number,
  length: number,
): number | null {
  if (length === 0) return null;
  if (key.name === "up" || key.text === "k") {
    return (index + length - 1) % length;
  }
  if (key.name === "down" || key.text === "j") return (index + 1) % length;
  if (key.name === "home") return 0;
  if (key.name === "end") return length - 1;
  if (key.name === "pageup") return Math.max(0, index - 10);
  if (key.name === "pagedown") return Math.min(length - 1, index + 10);
  return null;
}

/** True for the keys that mean "back out of this". */
export function isCancel(key: Key): boolean {
  return key.name === "escape" || key.name === "ctrl-c";
}

/** What a key handler decides should happen next. */
export type Step = "done" | "cancel" | "redraw" | "ignore";

/**
 * Draws `render()` and redraws it in place on every keypress until the handler
 * says it is finished. Lines are clipped to the terminal width because a
 * wrapped line would throw off the cursor arithmetic that redraws it.
 */
export async function liveScreen(
  render: () => string[],
  handle: (key: Key) => Step,
): Promise<boolean> {
  const input = process.stdin;
  let painted = 0;

  const paint = () => {
    const width = terminalWidth();
    const lines = render().map((line) => truncate(line, width));
    process.stdout.write(`${up(painted)}\r${CLEAR_BELOW}${lines.join("\n")}\n`);
    painted = lines.length;
  };

  const wasRaw = input.isRaw === true;
  input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");
  process.stdout.write(CURSOR_HIDE);
  paint();

  try {
    return await new Promise<boolean>((resolve) => {
      const onData = (chunk: string) => {
        const step = handle(parseKey(chunk));
        if (step === "done" || step === "cancel") {
          input.off("data", onData);
          resolve(step === "done");
          return;
        }
        if (step === "redraw") paint();
      };
      input.on("data", onData);
    });
  } finally {
    // Wipe the interface: the caller prints whatever should remain on screen.
    process.stdout.write(`${up(painted)}\r${CLEAR_BELOW}${CURSOR_SHOW}`);
    input.setRawMode(wasRaw);
    input.pause();
  }
}

export type Choice<T> = {
  value: T;
  label: string;
  /** Dimmed text after the label — a date, a count, a status. */
  hint?: string;
};

/** How many rows a list may use, leaving room for the title and the footer. */
function windowSize(): number {
  return Math.max(3, Math.min(14, (process.stdout.rows ?? 24) - 6));
}

/** The slice of a long list to show, keeping the cursor inside it. */
export function listWindow(
  index: number,
  total: number,
  size: number,
): { start: number; end: number } {
  const start = Math.max(
    0,
    Math.min(index - Math.floor(size / 2), total - size),
  );
  return {
    start: Math.max(0, start),
    end: Math.min(total, Math.max(0, start) + size),
  };
}

function listLines<T>(
  choices: Choice<T>[],
  index: number,
  marked: (choice: Choice<T>, position: number) => string,
): string[] {
  const size = windowSize();
  const { start, end } = listWindow(index, choices.length, size);
  const lines: string[] = [];

  if (start > 0) lines.push(dim(`   ↑ อีก ${start} รายการ`));
  const hintColumn = Math.max(
    ...choices.slice(start, end).map((choice) => displayWidth(choice.label)),
  );
  for (let position = start; position < end; position++) {
    const choice = choices[position];
    const body = choice.hint
      ? `${pad(choice.label, hintColumn)}  ${dim(choice.hint)}`
      : choice.label;
    lines.push(marked(choice, position) + body);
  }
  if (end < choices.length) {
    lines.push(dim(`   ↓ อีก ${choices.length - end} รายการ`));
  }
  return lines;
}

/** One choice from a list: ↑↓ to move, Enter to pick, Esc to back out. */
export async function select<T>(options: {
  title: string;
  choices: Choice<T>[];
  initial?: number;
}): Promise<T | null> {
  const { title, choices } = options;
  if (choices.length === 0) return null;

  let index = Math.max(0, Math.min(options.initial ?? 0, choices.length - 1));

  const ok = await liveScreen(
    () => [
      `${bold(title)}`,
      ...listLines(choices, index, (_choice, position) =>
        position === index ? cyan("❯ ") : "  ",
      ),
      dim("↑↓ เลื่อน · Enter เลือก · Esc ยกเลิก"),
    ],
    (key) => {
      const moved = navigate(key, index, choices.length);
      if (moved !== null) {
        index = moved;
        return "redraw";
      }
      if (key.name === "enter") return "done";
      if (isCancel(key) || key.text === "q") return "cancel";
      return "ignore";
    },
  );

  return ok ? choices[index].value : null;
}

/** Several choices: Space ticks, `a` ticks everything, Enter confirms. */
export async function multiSelect<T>(options: {
  title: string;
  choices: Choice<T>[];
  selected?: T[];
}): Promise<T[] | null> {
  const { title, choices } = options;
  if (choices.length === 0) return [];

  let index = 0;
  const picked = new Set<T>(options.selected ?? []);

  const ok = await liveScreen(
    () => [
      `${bold(title)}`,
      ...listLines(choices, index, (choice, position) => {
        const cursor = position === index ? cyan("❯") : " ";
        const box = picked.has(choice.value) ? green("◉") : dim("◯");
        return `${cursor} ${box} `;
      }),
      dim(
        "↑↓ เลื่อน · Space เลือก · a เลือกทั้งหมด · Enter ยืนยัน · Esc ยกเลิก",
      ),
    ],
    (key) => {
      const moved = navigate(key, index, choices.length);
      if (moved !== null) {
        index = moved;
        return "redraw";
      }
      if (key.name === "space") {
        const value = choices[index].value;
        if (picked.has(value)) picked.delete(value);
        else picked.add(value);
        return "redraw";
      }
      if (key.text === "a") {
        if (picked.size === choices.length) picked.clear();
        else for (const choice of choices) picked.add(choice.value);
        return "redraw";
      }
      if (key.name === "enter") return "done";
      if (key.name === "escape" || key.name === "ctrl-c") return "cancel";
      return "ignore";
    },
  );

  return ok
    ? choices.filter((c) => picked.has(c.value)).map((c) => c.value)
    : null;
}

/** Yes or no: ←→ or y/n, Enter accepts what is highlighted. */
export async function confirm(
  message: string,
  initial = false,
): Promise<boolean | null> {
  let yes = initial;

  const ok = await liveScreen(
    () => [
      `${bold(message)}  ${yes ? green("[ ใช่ ]") : dim("ใช่")}  ${yes ? dim("ไม่") : cyan("[ ไม่ ]")}`,
      dim("←→ เลือก · Enter ยืนยัน · Esc ยกเลิก"),
    ],
    (key) => {
      if (key.name === "left" || key.name === "right" || key.name === "tab") {
        yes = !yes;
        return "redraw";
      }
      if (key.text === "y") {
        yes = true;
        return "done";
      }
      if (key.text === "n") {
        yes = false;
        return "done";
      }
      if (key.name === "enter") return "done";
      if (isCancel(key)) return "cancel";
      return "ignore";
    },
  );

  return ok ? yes : null;
}

/** A line of text. Readline owns the terminal here, so editing keys work. */
export function textInput(
  message: string,
  initial = "",
): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(`${bold(message)} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
    rl.on("SIGINT", () => {
      rl.close();
      process.stdout.write("\n");
      resolve(null);
    });
    if (initial) rl.write(initial);
  });
}

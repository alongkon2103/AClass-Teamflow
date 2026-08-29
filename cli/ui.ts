import { TaskStatus, Priority } from "@prisma/client";
import { richTextToPlain, type RichTextDoc } from "@/lib/rich-text";

const COLOUR =
  process.env.NO_COLOR === undefined && process.stdout.isTTY === true;

const ESC = "\u001b[";

const wrap = (open: number, close: number) => (text: string) =>
  COLOUR ? `${ESC}${open}m${text}${ESC}${close}m` : text;

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const red = wrap(31, 39);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const blue = wrap(34, 39);
export const magenta = wrap(35, 39);
export const cyan = wrap(36, 39);

const ANSI = /\u001b\[\d+m/g;

/**
 * Thai vowels and tone marks stack onto the preceding consonant and take no
 * width of their own, so counting code points would over-pad every Thai cell.
 */
const ZERO_WIDTH = /[ัิ-ฺ็-๎]/g;

export function displayWidth(text: string): number {
  return [...text.replace(ANSI, "").replace(ZERO_WIDTH, "")].length;
}

export function pad(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - displayWidth(text)));
}

export function padStart(text: string, width: number): string {
  return " ".repeat(Math.max(0, width - displayWidth(text))) + text;
}

export function truncate(text: string, width: number): string {
  if (displayWidth(text) <= width) return text;

  let out = "";
  for (const char of text) {
    if (displayWidth(out + char) > width - 1) break;
    out += char;
  }
  return `${out}…`;
}

export type Column = { header: string; align?: "left" | "right" };

/** Prints an aligned table; the last column gives up width when the terminal is narrow. */
export function table(columns: Column[], rows: string[][]): void {
  if (rows.length === 0) return;

  const widths = columns.map((column, index) =>
    Math.max(
      displayWidth(column.header),
      ...rows.map((row) => displayWidth(row[index] ?? "")),
    ),
  );

  const terminal = process.stdout.columns ?? 100;
  const last = widths.length - 1;
  const fixed = widths.slice(0, last).reduce((sum, w) => sum + w + 2, 0);
  widths[last] = Math.max(8, Math.min(widths[last], terminal - fixed - 1));

  const render = (cells: string[]) =>
    columns
      .map((column, index) => {
        const cell = truncate(cells[index] ?? "", widths[index]);
        return column.align === "right"
          ? padStart(cell, widths[index])
          : pad(cell, widths[index]);
      })
      .join("  ")
      .trimEnd();

  console.log(dim(render(columns.map((column) => column.header))));
  for (const row of rows) console.log(render(row));
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "ต้องทำ",
  DOING: "กำลังทำ",
  REVIEW: "รอส่งตรวจ",
  DONE: "เสร็จสิ้น",
};

export function paintStatus(status: TaskStatus): string {
  const label = STATUS_LABEL[status];
  switch (status) {
    case TaskStatus.TODO:
      return blue(label);
    case TaskStatus.DOING:
      return yellow(label);
    case TaskStatus.REVIEW:
      return magenta(label);
    case TaskStatus.DONE:
      return green(label);
  }
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  NORMAL: "ปกติ",
  IMPORTANT: "สำคัญ",
  URGENT: "ด่วน",
};

export function paintPriority(priority: Priority): string {
  if (priority === Priority.URGENT) return red(PRIORITY_LABEL[priority]);
  if (priority === Priority.IMPORTANT) return yellow(PRIORITY_LABEL[priority]);
  return dim(PRIORITY_LABEL[priority]);
}

/** A stored document as terminal text, with every mention tinted. */
export function docToTerminal(doc: unknown, indent = ""): string {
  return richTextToPlain(doc as RichTextDoc | null)
    .split("\n")
    .map((line) => indent + line.replace(/@\S+/g, (match) => cyan(match)))
    .join("\n");
}

export function heading(text: string): void {
  console.log(`\n${bold(text)}`);
}

export function info(text: string): void {
  console.log(dim(text));
}

export function success(text: string): void {
  console.log(green(`✓ ${text}`));
}

export function fail(text: string): void {
  console.error(red(`✗ ${text}`));
}

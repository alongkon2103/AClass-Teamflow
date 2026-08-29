import { TaskStatus, Priority } from "@prisma/client";
import { richTextToPlain, type RichTextDoc } from "@/lib/rich-text";
import { daysBetween, formatThaiDate } from "@/lib/format";

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

export type Column = {
  header: string;
  align?: "left" | "right";
  /** The column that gives up room first when the terminal is narrow. */
  flex?: boolean;
};

const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  teeDown: "┬",
  teeUp: "┴",
  teeRight: "├",
  teeLeft: "┤",
  cross: "┼",
} as const;

/**
 * How wide the output may be. COLUMNS is honoured first so the width survives
 * a pipe, where stdout reports nothing.
 */
export function terminalWidth(): number {
  const declared = Number(process.env.COLUMNS);
  if (Number.isFinite(declared) && declared > 20) return declared;
  return process.stdout.columns ?? 100;
}

/**
 * A bordered table. Borders are dimmed so the eye lands on the content, and
 * the flexible column (or the widest one) absorbs whatever the terminal cannot
 * fit rather than letting a row wrap and break the grid.
 */
export function table(columns: Column[], rows: string[][]): void {
  if (rows.length === 0) return;

  const widths = columns.map((column, index) =>
    Math.max(
      displayWidth(column.header),
      ...rows.map((row) => displayWidth(row[index] ?? "")),
    ),
  );

  // Borders and padding: "│ " + cell + " " per column, plus the closing "│".
  const chrome = columns.length * 3 + 1;
  let overflow =
    widths.reduce((sum, w) => sum + w, 0) + chrome - terminalWidth();
  if (overflow > 0) {
    const order = columns
      .map((column, index) => ({ index, flex: column.flex === true }))
      .sort((a, b) => Number(b.flex) - Number(a.flex));

    for (const { index } of order) {
      if (overflow <= 0) break;
      const give = Math.min(overflow, Math.max(0, widths[index] - 8));
      widths[index] -= give;
      overflow -= give;
    }
  }

  const border = (left: string, join: string, right: string) =>
    dim(
      left +
        widths.map((width) => BOX.horizontal.repeat(width + 2)).join(join) +
        right,
    );

  const line = (cells: string[]) => {
    const bar = dim(BOX.vertical);
    return (
      bar +
      columns
        .map((column, index) => {
          const cell = truncate(cells[index] ?? "", widths[index]);
          const padded =
            column.align === "right"
              ? padStart(cell, widths[index])
              : pad(cell, widths[index]);
          return ` ${padded} `;
        })
        .join(bar) +
      bar
    );
  };

  console.log(border(BOX.topLeft, BOX.teeDown, BOX.topRight));
  console.log(line(columns.map((column) => bold(column.header))));
  console.log(border(BOX.teeRight, BOX.cross, BOX.teeLeft));
  for (const row of rows) console.log(line(row));
  console.log(border(BOX.bottomLeft, BOX.teeUp, BOX.bottomRight));
}

/** A labelled horizontal rule, for separating sections of a report. */
export function rule(label?: string): void {
  const width = Math.min(terminalWidth(), 100);
  if (!label) {
    console.log(dim(BOX.horizontal.repeat(width)));
    return;
  }
  const tail = Math.max(0, width - displayWidth(label) - 3);
  console.log(
    `${dim(BOX.horizontal.repeat(2))} ${bold(label)} ${dim(BOX.horizontal.repeat(tail))}`,
  );
}

/** An aligned label/value block, for the facts about one record. */
export function keyValues(pairs: [string, string][]): void {
  const width = Math.max(...pairs.map(([label]) => displayWidth(label)));
  for (const [label, value] of pairs) {
    console.log(`  ${dim(pad(`${label}`, width))}  ${value}`);
  }
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "ต้องทำ",
  DOING: "กำลังทำ",
  REVIEW: "รอส่งตรวจ",
  DONE: "เสร็จสิ้น",
};

const STATUS_PAINT: Record<TaskStatus, (text: string) => string> = {
  TODO: blue,
  DOING: yellow,
  REVIEW: magenta,
  DONE: green,
};

export function paintStatus(status: TaskStatus): string {
  return STATUS_PAINT[status](STATUS_LABEL[status]);
}

/**
 * A dot carries the colour even where the label is padded, which keeps a
 * column of statuses scannable without reading a word of it.
 */
export function statusBadge(status: TaskStatus): string {
  const paint = STATUS_PAINT[status];
  return `${paint("●")} ${paint(STATUS_LABEL[status])}`;
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

/** Only the two levels that need acting on get an arrow; normal stays quiet. */
export function priorityBadge(priority: Priority): string {
  if (priority === Priority.URGENT) return red(`▲ ${PRIORITY_LABEL[priority]}`);
  if (priority === Priority.IMPORTANT) {
    return yellow(`▲ ${PRIORITY_LABEL[priority]}`);
  }
  return dim(`· ${PRIORITY_LABEL[priority]}`);
}

/** A filled bar for a percentage, coloured by how far along it is. */
export function progressBar(percent: number, width = 12): string {
  const filled = Math.round((percent / 100) * width);
  const paint = percent === 100 ? green : percent >= 50 ? yellow : blue;
  return `${paint("█".repeat(filled))}${dim("░".repeat(width - filled))} ${padStart(`${percent}%`, 4)}`;
}

/** A stored document as terminal text, with every mention tinted. */
export function docToTerminal(doc: unknown, indent = ""): string {
  return richTextToPlain(doc as RichTextDoc | null)
    .split("\n")
    .map((line) => indent + line.replace(/@\S+/g, (match) => cyan(match)))
    .join("\n");
}

/**
 * A due date the way a person reads one: the Thai date, plus how far off it is,
 * coloured by whether it is a problem.
 */
export function dueLabel(dueISO: string | null, todayISO: string): string {
  if (!dueISO) return dim("—");

  const days = daysBetween(todayISO, dueISO);
  const date = formatThaiDate(dueISO);
  if (days < 0) return red(`${date} (เลย ${-days} วัน)`);
  if (days === 0) return yellow(`${date} (วันนี้)`);
  if (days <= 3) return yellow(`${date} (อีก ${days} วัน)`);
  return `${date} ${dim(`(อีก ${days} วัน)`)}`;
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

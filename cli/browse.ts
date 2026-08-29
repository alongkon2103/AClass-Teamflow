import type { PrismaClient } from "@prisma/client";
import { TaskStatus } from "@prisma/client";
import type { Actor } from "@/lib/permissions";
import { TASK_STATUS_ORDER } from "@/lib/constants";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { listBoardTasks, moveTask } from "@/server/services/task";
import { createProgress } from "@/server/services/progress";
import { createProgressSchema } from "@/lib/validators/progress";
import { textToRichText } from "./mentions";
import {
  canPrompt,
  isCancel,
  liveScreen,
  navigate,
  select,
  textInput,
  type Choice,
  type Key,
} from "./prompt";
import { renderTask } from "./commands/tasks";
import {
  bold,
  cyan,
  dim,
  displayWidth,
  dueLabel,
  fail,
  green,
  info,
  pad,
  paintStatus,
  priorityBadge,
  statusBadge,
  success,
  terminalWidth,
  truncate,
} from "./ui";

type Row = Awaited<ReturnType<typeof listBoardTasks>>[number];

export type BrowseAction = "open" | "move" | "log" | "quit";

/**
 * What a key means on the board, apart from moving the cursor. Kept separate
 * from the drawing so the shortcuts can be tested without a terminal.
 */
export function browseAction(key: Key): BrowseAction | "toggle-done" | null {
  if (key.name === "enter" || key.name === "space") return "open";
  if (key.text === "m") return "move";
  if (key.text === "l") return "log";
  if (key.text === "d") return "toggle-done";
  if (isCancel(key) || key.text === "q") return "quit";
  return null;
}

/**
 * The keyboard-driven board: arrows to move through the tasks, Enter to open
 * one, single letters for the things done most often. Everything it changes
 * goes through the same services as the flag-driven commands.
 */
export async function browse(db: PrismaClient, actor: Actor): Promise<void> {
  if (!canPrompt()) {
    throw new Error(
      "โหมดโต้ตอบต้องรันใน terminal จริง — ใช้ `teamflow ls` แทนเมื่อส่งผลลัพธ์ต่อ",
    );
  }

  const today = formatCalendarDate(todayInBangkok());
  let tasks = await load(db, actor);
  let showDone = false;
  let index = 0;

  for (;;) {
    const visible = tasks.filter(
      (task) => showDone || task.status !== TaskStatus.DONE,
    );
    if (visible.length === 0) {
      info("ไม่มีงานที่แสดงได้");
      return;
    }
    index = Math.min(index, visible.length - 1);

    // Held on an object because TypeScript stops narrowing a plain `let` that
    // is only ever assigned from inside the key handler.
    const chosen: { action: BrowseAction } = { action: "quit" };

    const confirmed = await liveScreen(
      () => screen(visible, index, today, showDone),
      (key) => {
        const moved = navigate(key, index, visible.length);
        if (moved !== null) {
          index = moved;
          return "redraw";
        }

        const action = browseAction(key);
        if (action === "toggle-done") {
          showDone = !showDone;
          index = 0;
          return "redraw";
        }
        if (action === "quit") return "cancel";
        if (action === null) return "ignore";

        chosen.action = action;
        return "done";
      },
    );

    if (!confirmed) return;
    const task = visible[index];

    if (chosen.action === "open") {
      await renderTask(db, task.id);
      await pause();
    }

    if (chosen.action === "move") {
      const status = await select<TaskStatus>({
        title: `ย้าย "${truncate(task.title, 50)}" ไปที่`,
        choices: TASK_STATUS_ORDER.map((value) => ({
          value,
          label: statusBadge(value),
        })),
        initial: TASK_STATUS_ORDER.indexOf(task.status),
      });

      if (status && status !== task.status) {
        const column = await db.task.count({
          where: { archivedAt: null, status },
        });
        try {
          await moveTask(db, actor, {
            taskId: task.id,
            status,
            toIndex: column,
            boardUserId: null,
          });
          success(`ย้ายไปที่ ${paintStatus(status)} แล้ว`);
        } catch (error) {
          fail(error instanceof Error ? error.message : String(error));
        }
        tasks = await load(db, actor);
      }
    }

    if (chosen.action === "log") {
      console.log(
        dim(`บันทึกความคืบหน้าของ "${task.title}" — ใส่ @ชื่อ เพื่อ mention`),
      );
      const text = await textInput("ความคืบหน้า:");
      if (text) {
        const members = await db.user.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        });
        const parsed = createProgressSchema.safeParse({
          taskId: task.id,
          entryDate: today,
          body: textToRichText(text, members),
          imageUrls: [],
        });
        if (!parsed.success) {
          fail(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
        } else {
          try {
            await createProgress(db, actor, parsed.data);
            success("บันทึกความคืบหน้าแล้ว");
          } catch (error) {
            fail(error instanceof Error ? error.message : String(error));
          }
          tasks = await load(db, actor);
        }
      }
    }
  }
}

async function load(db: PrismaClient, actor: Actor): Promise<Row[]> {
  const rows = await listBoardTasks(db, actor, null);
  return rows.sort(
    (a, b) =>
      TASK_STATUS_ORDER.indexOf(a.status) -
        TASK_STATUS_ORDER.indexOf(b.status) || a.sortOrder - b.sortOrder,
  );
}

/** Waits for any key, so a detail view is not swept away immediately. */
function pause(): Promise<void> {
  return liveScreen(
    () => [dim("\nกดปุ่มใดก็ได้เพื่อกลับไปที่รายการ")],
    () => "done",
  ).then(() => undefined);
}

function screen(
  tasks: Row[],
  index: number,
  today: string,
  showDone: boolean,
): string[] {
  const rows = Math.max(5, (process.stdout.rows ?? 24) - 7);
  const start = Math.max(
    0,
    Math.min(index - Math.floor(rows / 2), tasks.length - rows),
  );
  const end = Math.min(tasks.length, start + rows);
  const slice = tasks.slice(start, end);

  // Columns are sized against what is on screen, so the list never jitters
  // sideways more than the visible rows demand.
  const statusWidth = Math.max(
    ...slice.map((task) => displayWidth(statusBadge(task.status))),
  );
  const titleWidth = Math.max(
    12,
    Math.min(
      Math.max(...slice.map((task) => displayWidth(task.title))),
      terminalWidth() - statusWidth - 34,
    ),
  );

  const lines = [
    bold("  งานของทีม") +
      dim(
        `  ${index + 1}/${tasks.length}${showDone ? " · รวมงานที่เสร็จแล้ว" : ""}`,
      ),
    "",
  ];

  if (start > 0) lines.push(dim(`    ↑ อีก ${start} งาน`));

  for (const [offset, task] of slice.entries()) {
    const current = start + offset === index;
    const due = task.dueDate ? formatCalendarDate(task.dueDate) : null;
    const body = [
      pad(statusBadge(task.status), statusWidth),
      pad(truncate(task.title, titleWidth), titleWidth),
      pad(priorityBadge(task.priority), 8),
      due && task.status !== TaskStatus.DONE ? dueLabel(due, today) : dim("—"),
    ].join("  ");

    lines.push(current ? `${cyan("❯")} ${body}` : `  ${body}`);
  }

  if (end < tasks.length)
    lines.push(dim(`    ↓ อีก ${tasks.length - end} งาน`));

  lines.push(
    "",
    dim("↑↓ เลื่อน · ") +
      green("Enter") +
      dim(" เปิดดู · ") +
      green("m") +
      dim(" ย้ายสถานะ · ") +
      green("l") +
      dim(" บันทึกความคืบหน้า · ") +
      green("d") +
      dim(" สลับงานที่เสร็จ · ") +
      green("q") +
      dim(" ออก"),
  );
  return lines;
}

/** A picker for the times a task reference matches more than one task. */
export async function pickTask(
  candidates: { id: string; title: string }[],
): Promise<string | null> {
  const choices: Choice<string>[] = candidates.map((task) => ({
    value: task.id,
    label: task.title,
    hint: task.id.slice(0, 8),
  }));
  return select({ title: "ตรงกับหลายงาน เลือกงานที่ต้องการ", choices });
}

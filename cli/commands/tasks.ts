import type { PrismaClient } from "@prisma/client";
import { TaskStatus as Status } from "@prisma/client";
import type { Actor } from "@/lib/permissions";
import { TASK_STATUS_ORDER } from "@/lib/constants";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { deliveryState, DELIVERY_META } from "@/lib/delivery";
import {
  listBoardTasks,
  createTask,
  moveTask,
  archiveTask,
} from "@/server/services/task";
import { listProgressForTask } from "@/server/services/progress";
import { taskFormSchema } from "@/lib/validators/task";
import type { Args } from "../args";
import { flagValue, hasFlag } from "../args";
import {
  parsePriority,
  parseStatus,
  resolveMember,
  resolveTask,
} from "../resolve";
import {
  bold,
  cyan,
  dim,
  docToTerminal,
  fail,
  green,
  heading,
  info,
  paintPriority,
  paintStatus,
  red,
  success,
  table,
  yellow,
} from "../ui";

const today = () => formatCalendarDate(todayInBangkok());

/** `teamflow ls` — the board as a list. */
export async function listCommand(
  db: PrismaClient,
  actor: Actor,
  args: Args,
): Promise<void> {
  const user = flagValue(args, "user");
  const boardUserId = user ? (await resolveMember(db, user)).id : null;

  let tasks = await listBoardTasks(db, actor, boardUserId);

  const status = flagValue(args, "status");
  if (status) {
    const wanted = parseStatus(status);
    tasks = tasks.filter((task) => task.status === wanted);
  }
  // Finished work is noise on a working list unless it is asked for.
  if (!hasFlag(args, "all") && !status) {
    tasks = tasks.filter((task) => task.status !== Status.DONE);
  }

  if (tasks.length === 0) {
    info("ไม่มีงานที่ตรงกับเงื่อนไข");
    return;
  }

  const now = today();
  const rows = tasks
    .slice()
    .sort(
      (a, b) =>
        TASK_STATUS_ORDER.indexOf(a.status) -
          TASK_STATUS_ORDER.indexOf(b.status) || a.sortOrder - b.sortOrder,
    )
    .map((task) => {
      const due = task.dueDate ? formatCalendarDate(task.dueDate) : "";
      const state = deliveryState({
        status: task.status,
        dueDate: due || null,
        completedAt: task.completedAt
          ? formatCalendarDate(task.completedAt)
          : null,
        today: now,
      });
      const paintedDue =
        state === "missed" ? red(due) : state === "late" ? yellow(due) : due;

      return [
        dim(task.id.slice(0, 8)),
        paintStatus(task.status),
        paintPriority(task.priority),
        task.title,
        task.assignees.map((row) => row.user.name).join(", ") || dim("—"),
        paintedDue || dim("—"),
        task._count.progress > 0 ? `${task._count.progress}` : dim("0"),
      ];
    });

  table(
    [
      { header: "ID" },
      { header: "สถานะ" },
      { header: "ระดับ" },
      { header: "ชื่องาน" },
      { header: "ผู้รับผิดชอบ" },
      { header: "กำหนดส่ง" },
      { header: "อัปเดต", align: "right" },
    ],
    rows,
  );
  info(`\n${tasks.length} งาน`);
}

/** `teamflow show <ref>` — one task with its whole progress thread. */
export async function showCommand(
  db: PrismaClient,
  actor: Actor,
  args: Args,
): Promise<void> {
  const reference = args.positional[0];
  if (!reference) throw new Error("ใช้: teamflow show <งาน>");

  const found = await resolveTask(db, actor, reference);
  const task = await db.task.findUniqueOrThrow({
    where: { id: found.id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      startDate: true,
      dueDate: true,
      completedAt: true,
      gameNote: true,
      createdBy: { select: { name: true } },
      game: { select: { name: true } },
      assignees: { select: { user: { select: { name: true } } } },
    },
  });

  console.log(`\n${bold(task.title)}  ${dim(task.id)}`);
  const facts = [
    ["สถานะ", paintStatus(task.status)],
    ["ความสำคัญ", paintPriority(task.priority)],
    ["ผู้รับผิดชอบ", task.assignees.map((a) => a.user.name).join(", ") || "—"],
    ["เริ่ม", formatCalendarDate(task.startDate)],
    ["กำหนดส่ง", task.dueDate ? formatCalendarDate(task.dueDate) : "ไม่กำหนด"],
    ["เกม", task.game?.name ?? task.gameNote ?? "—"],
    ["สร้างโดย", task.createdBy.name],
  ];
  for (const [label, value] of facts) {
    console.log(`  ${dim(`${label}:`)} ${value}`);
  }

  if (task.dueDate) {
    const state = deliveryState({
      status: task.status,
      dueDate: formatCalendarDate(task.dueDate),
      completedAt: task.completedAt
        ? formatCalendarDate(task.completedAt)
        : null,
      today: today(),
    });
    console.log(`  ${dim("การส่งงาน:")} ${DELIVERY_META[state].label}`);
  }

  if (task.description) {
    heading("รายละเอียด");
    console.log(
      task.description
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n"),
    );
  }

  const entries = await listProgressForTask(db, task.id);
  heading(`ความคืบหน้า (${entries.length})`);
  if (entries.length === 0) {
    info("  ยังไม่มีการอัปเดต");
    return;
  }

  for (const entry of entries) {
    const when = formatCalendarDate(entry.entryDate);
    console.log(`\n  ${cyan(when)}  ${bold(entry.author.name)}`);
    console.log(docToTerminal(entry.body, "    "));
    if (entry.imageUrls.length > 0) {
      info(`    (แนบรูป ${entry.imageUrls.length} รูป)`);
    }
    for (const comment of entry.comments) {
      console.log(`    ${dim("↳")} ${bold(comment.author.name)}`);
      console.log(docToTerminal(comment.body, "      "));
    }
  }
}

/** `teamflow new "<title>"` */
export async function newCommand(
  db: PrismaClient,
  actor: Actor,
  args: Args,
): Promise<void> {
  const title = args.positional.join(" ").trim();
  if (!title) throw new Error('ใช้: teamflow new "<ชื่องาน>" [--assign ชื่อ]');

  const assignNames = (flagValue(args, "assign") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const assigneeIds: string[] = [];
  for (const name of assignNames) {
    assigneeIds.push((await resolveMember(db, name)).id);
  }
  // A task nobody owns helps nobody, so an unflagged one lands on you.
  if (assigneeIds.length === 0) assigneeIds.push(actor.id);

  const parsed = taskFormSchema.safeParse({
    title,
    description: flagValue(args, "desc"),
    status: flagValue(args, "status")
      ? parseStatus(flagValue(args, "status") as string)
      : Status.TODO,
    priority: flagValue(args, "priority")
      ? parsePriority(flagValue(args, "priority") as string)
      : "NORMAL",
    startDate: flagValue(args, "start") ?? today(),
    dueDate: flagValue(args, "due"),
    assigneeIds,
    gameNote: flagValue(args, "game"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง");
  }

  const task = await createTask(db, actor, parsed.data);
  success(`สร้างงาน "${task.title}" แล้ว  ${dim(task.id.slice(0, 8))}`);
}

/** `teamflow move <ref> <status>` */
export async function moveCommand(
  db: PrismaClient,
  actor: Actor,
  args: Args,
): Promise<void> {
  const [reference, statusWord] = args.positional;
  if (!reference || !statusWord) {
    throw new Error("ใช้: teamflow move <งาน> <todo|doing|review|done>");
  }

  const task = await resolveTask(db, actor, reference);
  const status = parseStatus(statusWord);

  // The bottom of the destination column, which is where a card dropped from
  // elsewhere would land on the board.
  const column = await db.task.count({
    where: { archivedAt: null, status },
  });

  await moveTask(db, actor, {
    taskId: task.id,
    status,
    toIndex: column,
    boardUserId: null,
  });
  success(`ย้าย "${task.title}" ไปที่ ${paintStatus(status)} แล้ว`);
}

/** `teamflow archive <ref>` */
export async function archiveCommand(
  db: PrismaClient,
  actor: Actor,
  args: Args,
): Promise<void> {
  const reference = args.positional[0];
  if (!reference) throw new Error("ใช้: teamflow archive <งาน>");

  const task = await resolveTask(db, actor, reference);
  if (!hasFlag(args, "yes")) {
    fail(`จะเก็บงาน "${task.title}" เข้าคลัง — ยืนยันด้วย --yes`);
    return;
  }

  await archiveTask(db, actor, task.id);
  success(`เก็บงาน "${task.title}" เข้าคลังแล้ว`);
}

/** `teamflow team` — who is carrying how much. */
export async function teamCommand(db: PrismaClient): Promise<void> {
  const { loadWorkload } = await import("@/server/services/dashboard");
  const rows = await loadWorkload(db);

  table(
    [
      { header: "ชื่อ" },
      { header: "ตำแหน่ง" },
      { header: "งาน", align: "right" },
      { header: "เสร็จ", align: "right" },
      { header: "ความคืบหน้า" },
    ],
    rows.map((member) => [
      member.name,
      member.jobTitle ?? dim("—"),
      String(member.total),
      String(member.done),
      bar(member.percent),
    ]),
  );
}

function bar(percent: number): string {
  const filled = Math.round((percent / 100) * 12);
  const painted = percent === 100 ? green : percent >= 50 ? yellow : dim;
  return `${painted("█".repeat(filled))}${dim("░".repeat(12 - filled))} ${percent}%`;
}

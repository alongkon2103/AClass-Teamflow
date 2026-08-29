import type { PrismaClient } from "@prisma/client";
import { TaskStatus as Status } from "@prisma/client";
import type { Actor } from "@/lib/permissions";
import { TASK_STATUS_ORDER } from "@/lib/constants";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
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
  dueLabel,
  fail,
  heading,
  info,
  keyValues,
  paintStatus,
  priorityBadge,
  progressBar,
  rule,
  statusBadge,
  success,
  table,
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
  const ordered = tasks
    .slice()
    .sort(
      (a, b) =>
        TASK_STATUS_ORDER.indexOf(a.status) -
          TASK_STATUS_ORDER.indexOf(b.status) || a.sortOrder - b.sortOrder,
    );

  const rows = ordered.map((task) => {
    const due = task.dueDate ? formatCalendarDate(task.dueDate) : null;
    const state = deliveryState({
      status: task.status,
      dueDate: due,
      completedAt: task.completedAt
        ? formatCalendarDate(task.completedAt)
        : null,
      today: now,
    });

    return [
      dim(task.id.slice(0, 8)),
      statusBadge(task.status),
      priorityBadge(task.priority),
      task.title,
      task.assignees.map((row) => row.user.name).join(", ") || dim("—"),
      // A finished task is judged on how it landed, not on how far off it is.
      task.status === Status.DONE
        ? due
          ? DELIVERY_META[state].label
          : dim("—")
        : dueLabel(due, now),
      task._count.progress > 0 ? `${task._count.progress}` : dim("0"),
    ];
  });

  table(
    [
      { header: "ID" },
      { header: "สถานะ" },
      { header: "ระดับ" },
      { header: "ชื่องาน", flex: true },
      { header: "ผู้รับผิดชอบ" },
      { header: "กำหนดส่ง" },
      { header: "อัปเดต", align: "right" },
    ],
    rows,
  );

  const counts = TASK_STATUS_ORDER.map((status) => {
    const total = ordered.filter((task) => task.status === status).length;
    return total > 0 ? `${paintStatus(status)} ${total}` : null;
  }).filter(Boolean);
  console.log(
    `  ${dim(`${ordered.length} งาน ·`)} ${counts.join(dim("  ·  "))}`,
  );
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

  const now = today();
  const due = task.dueDate ? formatCalendarDate(task.dueDate) : null;

  console.log("");
  rule(task.title);
  console.log("");

  const facts: [string, string][] = [
    ["สถานะ", statusBadge(task.status)],
    ["ความสำคัญ", priorityBadge(task.priority)],
    [
      "ผู้รับผิดชอบ",
      task.assignees.map((a) => a.user.name).join(", ") || dim("—"),
    ],
    ["เริ่ม", formatThaiDate(formatCalendarDate(task.startDate))],
    ["กำหนดส่ง", due ? dueLabel(due, now) : dim("ไม่กำหนด")],
  ];

  if (due) {
    const state = deliveryState({
      status: task.status,
      dueDate: due,
      completedAt: task.completedAt
        ? formatCalendarDate(task.completedAt)
        : null,
      today: now,
    });
    facts.push(["การส่งงาน", DELIVERY_META[state].label]);
  }
  facts.push(["เกม", task.game?.name ?? task.gameNote ?? dim("—")]);
  facts.push(["สร้างโดย", task.createdBy.name]);
  facts.push(["ID", dim(task.id)]);
  keyValues(facts);

  if (task.description) {
    heading("รายละเอียด");
    console.log(
      task.description
        .split("\n")
        .map((line) => `  ${dim("│")} ${line}`)
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
    const when = formatThaiDate(formatCalendarDate(entry.entryDate));
    console.log(`\n  ${cyan("●")} ${bold(entry.author.name)}  ${dim(when)}`);
    console.log(docToTerminal(entry.body, `  ${dim("│")} `));
    if (entry.imageUrls.length > 0) {
      console.log(
        `  ${dim("│")} ${dim(`แนบรูป ${entry.imageUrls.length} รูป`)}`,
      );
    }
    for (const comment of entry.comments) {
      console.log(`  ${dim("│")}   ${dim("↳")} ${bold(comment.author.name)}`);
      console.log(docToTerminal(comment.body, `  ${dim("│")}     `));
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
      { header: "ตำแหน่ง", flex: true },
      { header: "งาน", align: "right" },
      { header: "เสร็จ", align: "right" },
      { header: "ความคืบหน้า" },
    ],
    rows.map((member) => [
      member.name,
      member.jobTitle ?? dim("—"),
      String(member.total),
      String(member.done),
      progressBar(member.percent),
    ]),
  );
}

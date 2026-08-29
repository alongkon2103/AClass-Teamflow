import type { PrismaClient } from "@prisma/client";
import { TaskStatus } from "@prisma/client";
import type { Actor } from "@/lib/permissions";
import { formatCalendarDate, todayInBangkok } from "@/lib/date";
import { listBoardTasks } from "@/server/services/task";
import { listMeetings } from "@/server/services/meeting";
import { listNotifications } from "@/server/services/notification";
import { formatThaiDate } from "@/lib/format";
import {
  bold,
  cyan,
  dim,
  dueLabel,
  info,
  priorityBadge,
  red,
  rule,
  statusBadge,
  table,
  yellow,
} from "../ui";

/**
 * `teamflow today` — the one command worth running each morning: what is due,
 * what is late, what you are in the middle of, and what is waiting for you.
 */
export async function todayCommand(
  db: PrismaClient,
  actor: Actor & { name: string },
): Promise<void> {
  const now = formatCalendarDate(todayInBangkok());
  const [tasks, meetings, inbox] = await Promise.all([
    listBoardTasks(db, actor, null),
    listMeetings(db),
    listNotifications(db, actor),
  ]);

  const open = tasks.filter((task) => task.status !== TaskStatus.DONE);
  const withDue = open.filter((task) => task.dueDate !== null);

  const overdue = withDue.filter(
    (task) => formatCalendarDate(task.dueDate as Date) < now,
  );
  const dueToday = withDue.filter(
    (task) => formatCalendarDate(task.dueDate as Date) === now,
  );
  const doing = open.filter((task) => task.status === TaskStatus.DOING);
  const today = meetings.filter(
    (meeting) => formatCalendarDate(meeting.meetingAt) === now,
  );

  console.log("");
  rule(`สวัสดี ${actor.name}`);
  console.log(
    `  ${dim(formatThaiDate(now))}  ${dim("·")}  ${summary(overdue.length, dueToday.length, doing.length, inbox.unreadCount)}\n`,
  );

  if (overdue.length > 0) {
    console.log(red(`  เลยกำหนดส่ง (${overdue.length})`));
    table(
      [
        { header: "ID" },
        { header: "กำหนดส่ง" },
        { header: "ระดับ" },
        { header: "ชื่องาน", flex: true },
      ],
      overdue.map((task) => [
        dim(task.id.slice(0, 8)),
        dueLabel(formatCalendarDate(task.dueDate as Date), now),
        priorityBadge(task.priority),
        task.title,
      ]),
    );
    console.log("");
  }

  if (dueToday.length > 0) {
    console.log(yellow(`  ครบกำหนดวันนี้ (${dueToday.length})`));
    table(
      [
        { header: "ID" },
        { header: "สถานะ" },
        { header: "ระดับ" },
        { header: "ชื่องาน", flex: true },
      ],
      dueToday.map((task) => [
        dim(task.id.slice(0, 8)),
        statusBadge(task.status),
        priorityBadge(task.priority),
        task.title,
      ]),
    );
    console.log("");
  }

  console.log(bold(`  กำลังทำอยู่ (${doing.length})`));
  if (doing.length === 0) {
    info("  ไม่มีงานที่กำลังทำ\n");
  } else {
    table(
      [
        { header: "ID" },
        { header: "ชื่องาน", flex: true },
        { header: "กำหนดส่ง" },
        { header: "อัปเดต", align: "right" },
      ],
      doing.map((task) => [
        dim(task.id.slice(0, 8)),
        task.title,
        dueLabel(task.dueDate ? formatCalendarDate(task.dueDate) : null, now),
        task._count.progress > 0
          ? `${task._count.progress} ครั้ง`
          : dim("ยังไม่เคย"),
      ]),
    );
    console.log("");
  }

  if (today.length > 0) {
    console.log(bold(`  ประชุมวันนี้ (${today.length})`));
    for (const meeting of today) {
      console.log(
        `  ${cyan("●")} ${cyan(meeting.startTime ?? "ทั้งวัน")}  ${meeting.title}`,
      );
    }
    console.log("");
  }

  if (inbox.unreadCount > 0) {
    info(
      `  มีแจ้งเตือนใหม่ ${inbox.unreadCount} รายการ — ดูด้วย \`teamflow inbox\``,
    );
  }

  if (
    overdue.length === 0 &&
    dueToday.length === 0 &&
    doing.length === 0 &&
    inbox.unreadCount === 0
  ) {
    info("  วันนี้ไม่มีอะไรค้าง");
  }
}

/** The whole day in one line, for someone who reads nothing else. */
function summary(
  overdue: number,
  dueToday: number,
  doing: number,
  unread: number,
): string {
  const parts = [
    overdue > 0 ? red(`เลยกำหนด ${overdue}`) : null,
    dueToday > 0 ? yellow(`ครบกำหนดวันนี้ ${dueToday}`) : null,
    doing > 0 ? `กำลังทำ ${doing}` : null,
    unread > 0 ? cyan(`แจ้งเตือน ${unread}`) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(dim("  ·  ")) : dim("ไม่มีอะไรค้าง");
}
